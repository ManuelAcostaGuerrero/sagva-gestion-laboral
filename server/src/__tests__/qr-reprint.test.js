import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='qr-reprint-synthetic-only-not-production';
process.env.SAGVA_QR_DATA_KEY='0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');
const {sealWorkerQr,unsealWorkerQr}=await import('../workerQrVault.js');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');

test('QR guardado cifrado: reimpresión individual/lote sin cambiar hash, recuperación de QR legacy y permisos',async()=>{
 await runMigrations();
 const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name) VALUES('qr-reprint-root','hash','Administrador')");
 const [second]=await pool.execute("INSERT INTO admins(username,password_hash,full_name) VALUES('qr-reprint-other','hash','Otro administrador')");
 const [operator]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('qr-reprint-operator','hash','Operador','operator')");
 const token1=signAdmin({id:admin.insertId,username:'qr-reprint-root',role:'admin'});
 const token2=signAdmin({id:second.insertId,username:'qr-reprint-other',role:'admin'});
 const noAccess=signAdmin({id:operator.insertId,username:'qr-reprint-operator',role:'operator'});
 const ids=[];
 for(const name of ['Ana Test','Beto Test','Carmen Test']){
  const [x]=await pool.execute('INSERT INTO employees(full_name,document_id) VALUES(?,?)',[name,name]);
  ids.push(x.insertId);
 }
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 async function send(path,body,token=token1){
  const res=await fetch('http://127.0.0.1:'+server.address().port+'/api/tokens'+path,{
   method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
   body:body===undefined?undefined:JSON.stringify(body)});
  return {status:res.status,data:await res.json(),cache:res.headers.get('cache-control')};
 }
 try{
  const first=await send('/workers/'+ids[0]+'/issue',{});
  assert.equal(first.status,201);
  const batch=await send('/workers/batch-issue',{employeeIds:[ids[1]]});
  assert.equal(batch.status,201);
  const [rows]=await pool.execute('SELECT employee_id AS employeeId,token_hash AS digest,token_ciphertext AS cipher FROM worker_tokens WHERE revoked_at IS NULL ORDER BY employee_id');
  assert.equal(rows.length,2);
  assert.ok(rows.every(row=>row.cipher.startsWith('k1.') && !row.cipher.includes('at_')));
  assert.equal(rows[0].digest,sha(first.data.token));
  assert.equal(unsealWorkerQr(rows[0].cipher),first.data.token);
  const list=await send('/workers/issued');
  assert.equal(list.status,200);assert.equal(list.data.workers.length,2);
  assert.ok(list.data.workers.every(w=>w.reprintable));
  assert.equal(list.cache,'private, no-store');
  const reprint=await send('/workers/batch-reprint',{employeeIds:[ids[0],ids[1]]},token2);
  assert.equal(reprint.status,200);assert.equal(reprint.data.cards.length,2);
  assert.deepEqual(reprint.data.cards.map(x=>x.employeeId),[ids[0],ids[1]]);
  assert.equal(reprint.data.cards[0].qrDataUrl,first.data.qrDataUrl,'mismo QR, no nueva emisión');
  assert.equal(reprint.data.cards[1].qrDataUrl,batch.data.cards[0].qrDataUrl);
  const [same]=await pool.execute('SELECT token_hash AS digest,token_ciphertext AS cipher FROM worker_tokens WHERE revoked_at IS NULL ORDER BY employee_id');
  assert.deepEqual(same,rows.map(({digest,cipher})=>({digest,cipher})));
  assert.equal((await send('/workers/batch-reprint',{employeeIds:[ids[0]]},noAccess)).status,403);
  assert.equal((await send('/workers/issued',undefined,noAccess)).status,403);
  // Restaurar token solo cuando el admin posee el QR impreso y coincide con hash activo.
  const old='at_'+crypto.randomBytes(32).toString('base64url');
  await pool.execute('INSERT INTO worker_tokens(employee_id,token_hash) VALUES(?,?)',[ids[2],sha(old)]);
  const unavailable=await send('/workers/batch-reprint',{employeeIds:[ids[2]]});
  assert.equal(unavailable.status,409);
  const mismatch=await send('/workers/'+ids[2]+'/restore-print',{scannedQr:'asistencia:'+first.data.token});
  assert.equal(mismatch.status,409);
  const restored=await send('/workers/'+ids[2]+'/restore-print',{scannedQr:'asistencia:'+old});
  assert.equal(restored.status,200);
  const recovered=await send('/workers/batch-reprint',{employeeIds:[ids[2]]},token2);
  assert.equal(recovered.status,200);
  assert.ok(recovered.data.cards[0].qrDataUrl.startsWith('data:image/png;base64,'));
  assert.equal(sha(unsealWorkerQr((await pool.execute('SELECT token_ciphertext AS value FROM worker_tokens WHERE employee_id=?',[ids[2]]))[0][0].value)),sha(old));
  const revoked=await send('/workers/'+ids[0]+'/revoke',{});
  assert.equal(revoked.status,200);
  assert.equal((await send('/workers/batch-reprint',{employeeIds:[ids[0]]})).status,409);
  assert.equal((await pool.execute('SELECT token_ciphertext AS cipher FROM worker_tokens WHERE employee_id=?',[ids[0]]))[0][0].cipher,null);
  const logs=(await pool.execute('SELECT details FROM audit_logs'))[0].map(x=>x.details).join('');
  assert.ok(!logs.includes(old)&&!logs.includes(first.data.token));
 }finally{await new Promise(resolve=>server.close(resolve));await pool.end();}
});
