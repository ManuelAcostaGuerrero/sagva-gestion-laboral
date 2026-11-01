// Physical-camera acceptance with synthetic in-memory data. Never load .env.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import https from 'node:https';import express from 'express';import QRCode from 'qrcode';
process.env.SQLITE_PATH=':memory:';process.env.JWT_SECRET=crypto.randomBytes(48).toString('hex');
const {app}=await import('../server/src/app.js');const {pool}=await import('../server/src/db.js');const {runMigrations}=await import('../server/src/migrations.js');const {createWebApp,mobileHttpsOptions}=await import('./start-web.mjs');
const tls=mobileHttpsOptions();if(!tls)throw new Error('Configura primero el certificado HTTPS móvil.');
await runMigrations();const [company]=await pool.execute("INSERT INTO company_profiles(legal_name) VALUES('EMPRESA SINTÉTICA')");const [person]=await pool.execute("INSERT INTO employees(full_name) VALUES('TRABAJADOR PILOTO')");
await pool.execute('INSERT INTO employee_files(employee_id,company_id) VALUES(?,?)',[person.insertId,company.insertId]);
const hash=value=>crypto.createHash('sha256').update(value).digest('hex'),random=()=>crypto.randomBytes(32).toString('base64url');
const token='at_'+random(),activationCode=random();await pool.execute('INSERT INTO worker_tokens(employee_id,token_hash) VALUES(?,?)',[person.insertId,hash(token)]);
await pool.execute("INSERT INTO attendance_terminals(name,company_id,activation_hash,activation_expires) VALUES('CELULAR DE ENSAYO',?,?,?)",[company.insertId,hash(activationCode),Date.now()+10*60000]);
const dir=path.resolve(import.meta.dirname,'../.local/qr-mobile-test');fs.mkdirSync(dir,{recursive:true});
const qr=await QRCode.toDataURL('asistencia:'+token,{width:360,margin:3});
fs.writeFileSync(path.join(dir,'prueba.html'),`<!doctype html><meta charset="utf-8"><title>Prueba QR ficticia</title><h1>TRABAJADOR PILOTO</h1><img width="360" height="360" src="${qr}"><p>En el teléfono abre https://${tls.lanIp}:5176 y activa con este código (vence en 10 minutos):</p><pre>${activationCode}</pre><p>Solo identificación. No se registrará asistencia.</p>`,{mode:0o600});
const safe=express();safe.post('/api/tokens/mark',(_req,res)=>res.status(403).json({message:'Ensayo sintético: la marcación está bloqueada.'}));safe.use(app);
const backend=safe.listen(4176,'127.0.0.1');backend.on('error',fail);await new Promise(resolve=>backend.once('listening',resolve));
const web=https.createServer({cert:tls.cert,key:tls.key},createWebApp({apiTarget:'http://127.0.0.1:4176'})).listen(5176,'0.0.0.0');web.on('error',fail);
await new Promise(resolve=>web.once('listening',resolve));console.log(`Ensayo listo: https://${tls.lanIp}:5176. QR y activación locales: ${path.join(dir,'prueba.html')}. SQLite exclusivamente en memoria. Ninguna marcación habilitada.`);
function fail(error){console.error(error.code||error.message);process.exit(1);}
let closing=false;async function close(){if(closing)return;closing=true;web.close();backend.close();await pool.end();process.exit(0);}process.on('SIGINT',close);process.on('SIGTERM',close);
