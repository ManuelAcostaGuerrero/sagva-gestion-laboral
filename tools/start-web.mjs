import express from 'express';
import helmet from 'helmet';
import http from 'node:http';
import https from 'node:https';
import {X509Certificate,createPrivateKey} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function mobileHttpsOptions(configPath=path.join(root,'.local/mobile-https.json')) {
  if(!fs.existsSync(configPath))return null;
  const config=JSON.parse(fs.readFileSync(configPath,'utf8').replace(/^\uFEFF/,''));
  if(config.enabled!==true)return null;
  if(config.port!==5180)throw new Error('El HTTPS móvil debe usar el puerto 5180.');
  const cert=fs.readFileSync(config.certPath),key=fs.readFileSync(config.keyPath);
  const certificate=new X509Certificate(cert);
  if(!certificate.checkPrivateKey(createPrivateKey(key)))throw new Error('La clave y el certificado HTTPS no coinciden.');
  if(Date.parse(certificate.validTo)<=Date.now() || Date.parse(certificate.validFrom)>Date.now())throw new Error('El certificado HTTPS móvil no es vigente.');
  if(!certificate.checkIP(config.lanIp))throw new Error('El certificado HTTPS móvil no corresponde a la IP configurada.');
  return {cert,key,port:config.port,lanIp:config.lanIp};
}
const hopHeaders=['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade'];
export function createWebApp({distDir=path.join(root,'client/dist'),apiTarget='http://127.0.0.1:4000'}={}) {
  const app=express(),target=new URL(apiTarget);
  app.disable('x-powered-by');app.use(helmet());
  // Only compiled public files are served. Never expose the source workspace.
  app.use((req,res,next)=>/^\/(?:@|\.|server(?:\/|$)|tools(?:\/|$)|data(?:\/|$))/.test(req.path)?res.sendStatus(404):next());
  app.use('/api',(req,res)=>{
    res.setHeader('Cache-Control', 'no-store');
    const headers={...req.headers,host:target.host};
    for(const key of [...hopHeaders,'origin']) delete headers[key];
    // Same-origin frontend requests are proxied locally; bearer/terminal tokens
    // remain checked by the backend. No permissive cross-origin headers added.
    const upstream=http.request({hostname:target.hostname,port:target.port || 80,path:req.originalUrl,method:req.method,headers},response=>{
      const outgoing={...response.headers};for(const key of [...hopHeaders,'access-control-allow-origin','access-control-allow-credentials']) delete outgoing[key];
      res.writeHead(response.statusCode,outgoing);response.pipe(res);
    });
    upstream.setTimeout(30000,()=>upstream.destroy(new Error('API timeout')));
    upstream.on('error',()=>{if(!res.headersSent)res.status(502).json({message:'El servidor de asistencia no responde. Revisa Estado.bat.'});else res.destroy();});
    req.on('aborted',()=>upstream.destroy());
    res.on('close',()=>{if(!res.writableEnded)upstream.destroy();});
    req.pipe(upstream);
  });
  app.use((req,res,next)=>{
    if (req.path === '/' || req.path === '/index.html' || req.path === '/sw.js') res.setHeader('Cache-Control','no-store');
    next();
  });
  app.use(express.static(distDir,{dotfiles:'deny',index:false}));
  app.get('/',(_req,res)=>res.sendFile(path.join(distDir,'index.html')));
  app.use((_req,res)=>res.sendStatus(404));
  return app;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(!fs.existsSync(path.join(root,'client/dist/index.html')))throw new Error('Falta la pantalla compilada. Ejecuta Actualizar.bat.');
  const options=mobileHttpsOptions();
  const app=createWebApp();
  if(options){const secure=https.createServer({cert:options.cert,key:options.key},app).listen(options.port,'0.0.0.0',()=>console.log(`Celular: https://${options.lanIp}:${options.port}`));secure.on('error',error=>{console.error(`HTTPS móvil: ${error.code}`);process.exit(1);});}
  const server=app.listen(5173,'0.0.0.0',()=>console.log('Asistencia web compilada: http://localhost:5173 (API por /api).'));
  server.on('error',error=>{console.error(`No se pudo iniciar el puerto 5173: ${error.code}`);process.exitCode=1;});
}
