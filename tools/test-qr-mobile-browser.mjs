// Synthetic browser acceptance. Never loads .env or the production SQLite file.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {createRequire} from 'node:module';import assert from 'node:assert/strict';import express from 'express';import QRCode from 'qrcode';
process.env.SQLITE_PATH=':memory:';process.env.JWT_SECRET='synthetic-browser-test-only';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {app}=await import('../server/src/app.js');const {pool}=await import('../server/src/db.js');const {runMigrations}=await import('../server/src/migrations.js');const {createWebApp}=await import('./start-web.mjs');
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'.local/qa');fs.mkdirSync(out,{recursive:true});
await runMigrations();const [company]=await pool.execute("INSERT INTO company_profiles(legal_name) VALUES('EMPRESA SINTÉTICA')");
const [worker]=await pool.execute("INSERT INTO employees(full_name) VALUES('TRABAJADOR PILOTO')");await pool.execute('INSERT INTO employee_files(employee_id,company_id) VALUES(?,?)',[worker.insertId,company.insertId]);
const token='at_'+crypto.randomBytes(32).toString('base64url'),terminal='terminal_'+crypto.randomBytes(32).toString('base64url');const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
await pool.execute('INSERT INTO worker_tokens(employee_id,token_hash) VALUES(?,?)',[worker.insertId,hash(token)]);
const [device]=await pool.execute("INSERT INTO attendance_terminals(name,company_id,token_hash) VALUES('CELULAR SINTÉTICO',?,?)",[company.insertId,hash(terminal)]);
let identifies=0;const backend=express();backend.use((req,res,next)=>{if(req.path==='/api/tokens/identify')identifies++;next();});backend.use(app);
const api=backend.listen(0,'127.0.0.1');await new Promise(r=>api.once('listening',r));
const web=express();web.get('/__test/print.js',(_req,res)=>res.type('text/javascript').send(fs.readFileSync(path.join(root,'client/src/printQrCard.js'))));web.get('/__test/printQrCards.js',(_req,res)=>res.type('text/javascript').send(fs.readFileSync(path.join(root,'client/src/printQrCards.js'))));web.get('/__test/qrCredentialPrintLayout.js',(_req,res)=>res.type('text/javascript').send(fs.readFileSync(path.join(root,'client/src/qrCredentialPrintLayout.js'))));web.use(createWebApp({apiTarget:'http://127.0.0.1:'+api.address().port}));const server=web.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({headless:true,channel:process.env.TEST_BROWSER_CHANNEL||'chrome'});
try {
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.addInitScript(({terminal})=>{
  localStorage.setItem('attendanceTerminal',JSON.stringify({token:terminal,name:'CELULAR SINTÉTICO'}));
  window.print=()=>{window.__printed=true;};
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{const canvas=document.createElement('canvas');canvas.width=200;canvas.height=200;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,200,200);return canvas.captureStream(10);}});
  window.BarcodeDetector=class{static async getSupportedFormats(){return ['qr_code'];}async detect(){return window.__scanQR?[{rawValue:window.__scanQR}]:[];}};
 },{terminal});
 const page=await context.newPage();const failures=[];page.on('pageerror',error=>failures.push(error.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 assert.equal(await page.getByRole('button',{name:'Desvincular este navegador'}).count(),0,
   'un trabajador no puede desvincular un equipo desde la terminal');
 assert.equal(await page.getByRole('button',{name:'QR con lector externo'}).count(),0,
   'el lector externo no debe ocupar espacio en el inicio');
 assert.equal(await page.getByRole('button',{name:'PIN de respaldo'}).count(),0,
   'el PIN permanece oculto como método alternativo');
 await page.getByRole('button',{name:'Escanear QR',exact:true}).click();
 await page.getByText('Enfoca el QR del trabajador.',{exact:true}).waitFor();
 await page.evaluate(qr=>{window.__scanQR=qr;},'asistencia:'+token);
 await page.getByText('TRABAJADOR PILOTO',{exact:true}).waitFor();
 await page.getByText('IDENTIFICACIÓN CORRECTA',{exact:true}).waitFor();
 assert.equal(await page.locator('video').count(),0,'el lector deja de usar la cámara tras identificar');
 await page.getByRole('button',{name:'Escanear otro QR'}).waitFor();
 await page.screenshot({path:path.join(out,'qr-mobile-preview.png'),fullPage:true});
 await page.waitForTimeout(3600);assert.equal(identifies,1);assert.equal((await pool.execute('SELECT COUNT(*) n FROM attendance_records'))[0][0].n,0);
 await pool.execute('UPDATE attendance_terminals SET camera_mark_enabled=1 WHERE id=?',[device.insertId]);await page.reload();
 await page.getByRole('button',{name:'Registrar asistencia',exact:true}).click();
 await page.getByRole('button',{name:'Escanear QR',exact:true}).click();await page.getByText('Enfoca el QR del trabajador.',{exact:true}).waitFor();await page.evaluate(qr=>{window.__scanQR=qr;},'asistencia:'+token);
 await page.getByText('MARCACIÓN REGISTRADA',{exact:true}).waitFor();
 assert.equal(await page.locator('video').count(),0,'cámara apagada tras registrar');await page.waitForTimeout(3600);assert.equal((await pool.execute('SELECT COUNT(*) n FROM attendance_records'))[0][0].n,1);
 await page.getByRole('button',{name:'Escanear otro QR'}).waitFor();
 await page.getByRole('button',{name:/Métodos alternativos/}).click();
 await page.getByRole('button',{name:'QR con lector externo'}).waitFor();
 await page.getByRole('button',{name:'PIN de respaldo'}).click();
 await page.getByRole('combobox',{name:'Trabajador'}).waitFor();
 assert.equal(await page.locator('video').count(),0,'al usar PIN se detiene el lector de cámara');
 const qrDataUrl=await QRCode.toDataURL('asistencia:'+token,{width:360,margin:3});
 await page.evaluate(card=>{window.__card=card;const button=document.createElement('button');button.id='test-print';button.textContent='Imprimir prueba';button.onclick=async()=>{const {printQrCard}=await import('/__test/print.js');window.__printPromise=printQrCard(window.__card);};document.body.append(button);},{name:'TRABAJADOR <PILOTO>',qrDataUrl});
 const popupPromise=context.waitForEvent('page');await page.locator('#test-print').click();const popup=await popupPromise;
 await popup.waitForFunction(()=>window.__printed===true);assert.equal(await popup.locator('h1').textContent(),'TRABAJADOR <PILOTO>');assert.equal(await popup.locator('.qr-face').count(),2,'cada credencial debe tener dos caras idénticas');assert.ok(await popup.locator('.qr-face-image').first().evaluate(img=>img.naturalWidth>0));
 const sizes=await popup.locator('.qr-face').first().evaluate(el=>{const rect=el.getBoundingClientRect();const qr=el.querySelector('.qr-face-image').getBoundingClientRect();return {w:rect.width,h:rect.height,qr:qr.width};});
 const mm=96/25.4;assert.ok(Math.abs(sizes.w-54*mm)<1&&Math.abs(sizes.h-85*mm)<1,'medidas físicas 54x85 mm');assert.ok(Math.abs(sizes.qr-28*mm)<1,'QR fijo de 28 mm');
 await popup.evaluate(()=>{window.close=()=>{};});
 await popup.pdf({path:path.join(out,'qr-print-test.pdf'),printBackground:true});assert.deepEqual(failures,[]);
 console.log('OK: viewport móvil, cámara se detiene tras cada lectura, nombre grande, marcación sintética y QR visible en impresión/PDF. No se probó hardware del teléfono.');
}finally{await browser.close();await new Promise(r=>server.close(r));await new Promise(r=>api.close(r));await pool.end();}
