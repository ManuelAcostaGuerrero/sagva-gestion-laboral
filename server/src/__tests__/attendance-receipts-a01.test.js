import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='synthetic-a01-test';
process.env.SAGVA_RECEIPT_SIGNING_KEY='synthetic-key-for-only-a01-tests-of-32-bytes-or-longer';
delete process.env.RESEND_API_KEY;
delete process.env.SAGVA_RECEIPT_FROM;
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');
const {createAttendanceProof}=await import('../attendanceProofs.js');
const {createAttendanceReceipt,readAttendanceReceipt,verifyReceipt,dispatchAttendanceReceipt,receiptEmailHtml}=await import('../attendanceReceipts.js');

test('A01: comprobante inmutable, firma, consulta sin datos personales y bitácora de envío',async()=>{
  await runMigrations();await runMigrations();
  const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('a01','hash','Admin sintético','admin')");
  const [worker]=await pool.execute("INSERT INTO employees(full_name,document_id,email) VALUES('TRABAJADORA SINTETICA','12.345.678-5','prueba-a01@example.test')");
  const [company]=await pool.execute("INSERT INTO company_profiles(legal_name,tax_id,address,commune,city,region) VALUES('EMPRESA SINTETICA','77.376.536-7','CALLE FICTICIA 123','CONCEPCION','CONCEPCION','BIOBIO')");
  await pool.execute('INSERT INTO employee_files(employee_id,company_id) VALUES(?,?)',[worker.insertId,company.insertId]);
  const [mark]=await pool.execute("INSERT INTO attendance_records(employee_id,record_type,registered_at,device_name,mark_method) VALUES(?,'entrada','2026-11-12 08:05:09','Terminal test','PIN')",[worker.insertId]);
  await createAttendanceProof(pool,mark.insertId);
  const receipt=await createAttendanceReceipt(pool,mark.insertId);
  assert.equal(receipt.receipt.date,'12/11/26');
  assert.equal(receipt.receipt.time,'08:05:09');
  assert.equal(receipt.receipt.type,'entrada');
  assert.equal(receipt.receipt.worker.name,'TRABAJADORA SINTETICA');
  assert.equal(receipt.receipt.employer.name,'EMPRESA SINTETICA');
  assert.match(receipt.receipt.worker.rut,/\d{2}\.\d{3}\.\d{3}-5/);
  assert.equal(receipt.authenticityStatus,'SIGNED');
  assert.match(receipt.checksum,/^[a-f0-9]{64}$/);
  assert.match(receiptEmailHtml(receipt.receipt),/COMPROBANTE DE MARCACIÓN/);
  assert.deepEqual((await createAttendanceReceipt(pool,mark.insertId)).checksum,receipt.checksum);
  assert.equal((await verifyReceipt(pool,mark.insertId,receipt.checksum)).valid,true);
  assert.equal((await verifyReceipt(pool,mark.insertId,'0'.repeat(64))).valid,false);
  await assert.rejects(pool.execute("UPDATE attendance_receipts SET checksum_hex=? WHERE record_id=?",['0'.repeat(64),mark.insertId]));
  await assert.rejects(pool.execute('DELETE FROM attendance_receipts WHERE record_id=?',[mark.insertId]));
  const configMissing=await dispatchAttendanceReceipt(pool,mark.insertId);
  assert.equal(configMissing.deliveryStatus,'CONFIG_PENDING');
  process.env.RESEND_API_KEY='synthetic-only';
  process.env.SAGVA_RECEIPT_FROM='sistema@example.test';
  let count=0;
  const transport=async({to,receipt,idempotencyKey})=>{
    count++;assert.equal(to,'prueba-a01@example.test');assert.equal(receipt.recordId,mark.insertId);
    assert.ok(idempotencyKey.includes(String(mark.insertId)));return {id:'synthetic-provider-id'};
  };
  try{
    const accepted=await dispatchAttendanceReceipt(pool,mark.insertId,{transport});
    assert.equal(accepted.deliveryStatus,'ACCEPTED_BY_PROVIDER');
    await dispatchAttendanceReceipt(pool,mark.insertId,{transport});
    assert.equal(count,1,'La entrega aceptada no se repite');
    assert.equal((await pool.execute('SELECT COUNT(*) n FROM attendance_receipt_delivery_attempts WHERE record_id=?',[mark.insertId]))[0][0].n,2);
    const [duplicate]=await pool.execute("INSERT INTO employees(full_name,email) VALUES('OTRA PERSONA','prueba-a01@example.test')");
    const [secondMark]=await pool.execute("INSERT INTO attendance_records(employee_id,record_type,registered_at) VALUES(?,'salida','2026-11-12 17:00:00')",[worker.insertId]);
    await createAttendanceProof(pool,secondMark.insertId);
    await createAttendanceReceipt(pool,secondMark.insertId);
    assert.equal((await dispatchAttendanceReceipt(pool,secondMark.insertId,{transport})).deliveryStatus,'EMAIL_DUPLICATED');
    assert.equal(count,1);
    assert.ok(duplicate.insertId);
    assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
  }finally{delete process.env.RESEND_API_KEY;delete process.env.SAGVA_RECEIPT_FROM;}

  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  try{
    const checked=await fetch(url+'/api/attendance/receipts/'+mark.insertId+'/verify?checksum='+receipt.checksum);
    assert.equal(checked.status,200);
    const publicResult=await checked.json();
    assert.equal(publicResult.valid,true);
    assert.equal(publicResult.authenticityStatus,'SIGNED');
    assert.ok(!JSON.stringify(publicResult).includes('SINTETICA'));
    const wrong=await fetch(url+'/api/attendance/receipts/'+mark.insertId+'/verify?checksum='+'0'.repeat(64));
    assert.equal((await wrong.json()).valid,false);
    assert.equal((await fetch(url+'/api/attendance/receipts/'+mark.insertId)).status,401);
    const authorized=await fetch(url+'/api/attendance/receipts/'+mark.insertId,{
      headers:{Authorization:'Bearer '+signAdmin({id:admin.insertId,username:'a01',role:'admin'})}});
    assert.equal(authorized.status,200);
    assert.equal((await authorized.json()).receipt.worker.name,'TRABAJADORA SINTETICA');
    assert.equal((await readAttendanceReceipt(pool,mark.insertId)).deliveryStatus,'ACCEPTED_BY_PROVIDER');
  }finally{await new Promise(resolve=>server.close(resolve));await pool.end();}
});
