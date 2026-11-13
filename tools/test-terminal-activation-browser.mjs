// Prueba sintética de interfaz móvil de activación: sin cámara física ni datos reales.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import express from 'express';
process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='terminal-qr-browser-test-synthetic';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {app}=await import('../server/src/app.js');
const {pool}=await import('../server/src/db.js');
const {runMigrations}=await import('../server/src/migrations.js');
const {signAdmin}=await import('../server/src/auth.js');
const {createWebApp}=await import('./start-web.mjs');
const {terminalActivationQrPayload}=await import('../server/src/terminalActivationQr.js');
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'.local/qa');
fs.mkdirSync(out,{recursive:true});
await runMigrations();
const [company]=await pool.execute("INSERT INTO company_profiles(legal_name) VALUES('EMPRESA PRUEBA QR')");
const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('qr-activation-admin','hash','Administrador ficticio','admin')");
const jwt=signAdmin({id:admin.insertId,username:'qr-activation-admin',role:'admin'});
const api=app.listen(0,'127.0.0.1');await new Promise(resolve=>api.once('listening',resolve));
const web=express();web.use(createWebApp({apiTarget:'http://127.0.0.1:'+api.address().port}));
const server=web.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base='http://127.0.0.1:'+server.address().port;
async function newTerminal(name){
 const response=await fetch('http://127.0.0.1:'+api.address().port+'/api/tokens/terminals',{method:'POST',headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify({name,companyId:company.insertId})});
 assert.equal(response.status,201);
 return response.json();
}
const browser=await chromium.launch({headless:true,channel:process.env.TEST_BROWSER_CHANNEL||'chrome'});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.addInitScript(()=>{
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{
   const canvas=document.createElement('canvas');canvas.width=180;canvas.height=180;
   const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,180,180);
   return canvas.captureStream(10);
  }});
  window.BarcodeDetector=class{
   static async getSupportedFormats(){return ['qr_code'];}
   async detect(){return window.__testTerminalQr?[{rawValue:window.__testTerminalQr}]:[];}
  };
 });
 const page=await context.newPage();const failures=[];page.on('pageerror',error=>failures.push(error.message));
 const first=await newTerminal('CELULAR QR SINTÉTICO');
 assert.ok(first.activationQrDataUrl.startsWith('data:image/png;base64,'));
 await page.goto(base);
 await page.getByRole('button',{name:'ASISTENCIA'}).click();
 await page.getByRole('heading',{name:'Activar terminal de asistencia'}).waitFor();
 await page.waitForFunction(()=>{
  const img=document.querySelector('.public-sidebar img.sidebar-brand');
  const fallback=document.querySelector('.public-sidebar .sidebar-brand-fallback');
  return !!fallback||!!(img?.complete&&img?.naturalWidth>0);
 });
 for(const width of [360,390,768]){
  await page.setViewportSize({width,height:844});
  const data=await page.evaluate(()=>{
   const logo=document.querySelector('.public-sidebar .sidebar-brand, .public-sidebar .sidebar-brand-fallback');
   const nav=document.querySelector('.public-sidebar .sidebar-nav');
   const bounds=logo?.getBoundingClientRect(),menu=nav?.getBoundingClientRect();
   const ready=!!document.querySelector('.public-sidebar .sidebar-brand-fallback')||!!(logo?.naturalWidth>0);
   return {width:window.innerWidth,scroll:document.documentElement.scrollWidth,
    logoReady:ready,logoLeft:bounds?.left,logoRight:bounds?.right,navLeft:menu?.left,navRight:menu?.right};
  });
  assert.ok(data.logoReady,'mostrar logo real o respaldo legible');
  assert.ok(data.logoLeft>=-1&&data.logoRight<=width+1,'logo completo dentro de pantalla '+width);
  assert.ok(data.navLeft>=-1&&data.navRight<=width+1,'menú dentro de pantalla '+width);
  assert.ok(data.scroll<=width+1,'sin desbordes horizontales en '+width+': '+JSON.stringify(data));
 }
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.join(out,'terminal-activation-mobile-before.png'),fullPage:true});
 await page.getByRole('button',{name:'Escanear QR de activación'}).click();
 try {
  await page.getByText('Enfoca el QR de activación que aparece en Administración.').waitFor({timeout:10000});
 } catch(e) {
  console.error('Diagnóstico escáner sintético:',await page.locator('.tk-activation-scan').innerText());
  throw e;
 }
 await page.evaluate(value=>{window.__testTerminalQr=value;},terminalActivationQrPayload(first.activationCode));
 await page.getByText('Código QR reconocido. Confirma la activación de este equipo.').waitFor();
 assert.equal(await page.getByRole('textbox',{name:'Código de activación'}).inputValue(),first.activationCode);
 assert.equal(await page.locator('video').count(),0,'cámara se cierra tras lectura');
 await page.getByRole('button',{name:'Activar este equipo'}).click();
 await page.getByText('CELULAR QR SINTÉTICO',{exact:true}).waitFor();
 // Un segundo dispositivo puede activarse sin cámara usando el código tradicional.
 const second=await newTerminal('CELULAR MANUAL SINTÉTICO');
 await page.evaluate(()=>localStorage.removeItem('attendanceTerminal'));
 await page.reload();
 await page.getByRole('textbox',{name:'Código de activación'}).fill(second.activationCode);
 await page.getByRole('button',{name:'Activar este equipo'}).click();
 await page.getByText('CELULAR MANUAL SINTÉTICO',{exact:true}).waitFor();
 assert.deepEqual(failures,[]);
 console.log('OK: QR terminal de un uso, entrada manual, cámara liberada y logo/nav sin recortes a 360/390/768 CSS px. Cámara y móvil físico no probados.');
}finally{await browser.close();await new Promise(r=>server.close(r));await new Promise(r=>api.close(r));await pool.end();}
