import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='synthetic-dt-attendance-proofs-test';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');
const {createAttendanceProof,verifyAttendanceProof,ATTENDANCE_PROOF_MIGRATION}=await import('../attendanceProofs.js');

test('DT: evidencia SHA-256 inmutable con auditoría; sin backfill de marcas anteriores',async()=>{
  await runMigrations();await runMigrations();
  const [migration]=await pool.execute('SELECT COUNT(*) AS n FROM schema_migrations WHERE id=?',[ATTENDANCE_PROOF_MIGRATION]);
  assert.equal(migration[0].n,1);
  const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('dt-proof-a','hash','Admin prueba','admin')");
  const [worker]=await pool.execute("INSERT INTO employees(full_name,document_id) VALUES('TRABAJADOR FICTICIO','12.345.678-5')");
  const [company]=await pool.execute("INSERT INTO company_profiles(legal_name,tax_id) VALUES('EMPRESA FICTICIA','77.376.536-7')");
  await pool.execute("INSERT INTO employee_files(employee_id,company_id,company) VALUES(?,?,'EMPRESA FICTICIA')",[worker.insertId,company.insertId]);
  const [previous]=await pool.execute(
    "INSERT INTO attendance_records(employee_id,record_type,registered_at) VALUES(?,'entrada','2025-01-01 09:00:00')",[worker.insertId]);
  assert.deepEqual(await verifyAttendanceProof(pool,previous.insertId),{exists:false,valid:false,reason:'NO_PROOF'});
  const [newMark]=await pool.execute(
    "INSERT INTO attendance_records(employee_id,record_type,registered_at,mark_method,device_name) VALUES(?,'salida','2026-11-11 18:02:17','PIN','Terminal Ficticia')",
    [worker.insertId]);
  const result=await createAttendanceProof(pool,newMark.insertId);
  assert.equal(result.algorithm,'SHA-256');
  assert.match(result.digest,/^[a-f0-9]{64}$/);
  const check=await verifyAttendanceProof(pool,newMark.insertId);
  assert.equal(check.valid,true);
  assert.equal(check.digest,result.digest);
  await assert.rejects(createAttendanceProof(pool,newMark.insertId),'La marcación sólo puede tener una prueba');
  await assert.rejects(pool.execute('UPDATE attendance_integrity_proofs SET digest_hex=? WHERE record_id=?',['0'.repeat(64),newMark.insertId]));
  await assert.rejects(pool.execute("DELETE FROM attendance_integrity_proofs WHERE record_id=?",[newMark.insertId]));
  await assert.rejects(pool.execute("UPDATE attendance_records SET registered_at='2026-11-11 18:05:00' WHERE id=?",[newMark.insertId]));
  await assert.rejects(pool.execute("UPDATE attendance_records SET record_type='entrada' WHERE id=?",[newMark.insertId]));
  await pool.execute("UPDATE attendance_records SET is_void=1,void_reason='Anulación auditada' WHERE id=?",[newMark.insertId]);
  assert.equal((await verifyAttendanceProof(pool,newMark.insertId)).valid,true,'Anulación separada no destruye prueba de marca original');
  const [stored]=await pool.execute('SELECT snapshot_json AS snapshot FROM attendance_integrity_proofs WHERE record_id=?',[newMark.insertId]);
  const source=JSON.parse(stored[0].snapshot);
  assert.equal(source.workerName,'TRABAJADOR FICTICIO');
  assert.equal(source.employerName,'EMPRESA FICTICIA');

  const token=signAdmin({id:admin.insertId,username:'dt-proof-a',role:'admin'});
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  try {
    const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/attendance/records/manual',{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
      body:JSON.stringify({employeeId:worker.insertId,type:'entrada',registeredAt:'2026-11-11T08:30:05',
        reason:'Corrección de prueba documental'})
    });
    const payload=await response.json();
    assert.equal(response.status,201,JSON.stringify(payload));
    assert.match(payload.integrityProof.digest,/^[a-f0-9]{64}$/);
    assert.equal(payload.receipt.receipt.recordId,payload.id);
    assert.match(payload.receipt.checksum,/^[a-f0-9]{64}$/);
    assert.equal((await verifyAttendanceProof(pool,payload.id)).valid,true);
    const summaryResponse=await fetch('http://127.0.0.1:'+server.address().port+'/api/attendance/summary?date=2026-11-11',{
      headers:{Authorization:'Bearer '+token}
    });
    assert.equal(summaryResponse.status,200);
    const summary=(await summaryResponse.json()).summary;
    const manual=summary.recentRecords.find(record=>record.id===payload.id);
    assert.equal(manual.markMethod,'MANUAL','El resumen no debe presentar una marca administrativa nueva como histórica');
    assert.equal(manual.terminalName,'Administración');
    const [audits]=await pool.execute(
      "SELECT COUNT(*) AS n FROM audit_logs WHERE entity_type='attendance_record' AND action='create_manual_record' AND entity_id=?",
      [String(payload.id)]);
    assert.equal(audits[0].n,1);
    assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
  }finally{
    await new Promise(resolve=>server.close(resolve));
    await pool.end();
  }
});
