import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SQLITE_PATH=':memory:';process.env.JWT_SECRET='contract-files-test-secret';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');
const {contractPreparation}=await import('../contractFiles.js');

test('Preparación del contrato requiere identidad y fechas válidas, sin habilitar generación prematura',()=>{
  const file={legalFullName:'Nombre legal',documentId:'12.345.678-5',address:'Dirección',company:'Empresa',positionName:'Cargo',workAreaId:1,workSchedule:'FULL_TIME',birthDate:'1990-01-01',hireDate:'2026-01-01',contractType:'INDEFINIDO'};
  assert.equal(contractPreparation(file).fileReady,true);
  assert.equal(contractPreparation(file).generationAvailable,false);
  assert.ok(contractPreparation({...file,contractType:'PLAZO_FIJO'}).missing.includes('Fecha de término inicial válida'));
  assert.equal(contractPreparation({...file,contractType:'PLAZO_FIJO',terminationDate:'2026-02-30'}).fileReady,false);
  assert.equal(contractPreparation({...file,documentId:'12.345.678-0'}).fileReady,false);
  assert.equal(contractPreparation({...file,legalFullName:''}).fileReady,false);
});
test('PDF de contrato/anexo: autenticación, vinculación, revisión, historial, auditoría y respaldo en SQLite',async()=>{
  await runMigrations();await runMigrations();
  const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name) VALUES('contract-files','hash','Prueba')");
  const token=signAdmin({id:admin.insertId,username:'contract-files',role:'operator'});
  const [worker]=await pool.execute("INSERT INTO employees(full_name) VALUES('Persona contrato')");
  const id=worker.insertId;
  await pool.execute("INSERT INTO employee_files(employee_id,contract_type,hire_date,termination_date) VALUES(?,'PLAZO_FIJO','2026-01-01','2026-03-31')",[id]);
  const revision=(await pool.execute('SELECT revision FROM employee_files WHERE employee_id=?',[id]))[0][0].revision;
  await pool.execute("INSERT INTO employee_contract_annexes(employee_id,annex_order,annex_date,end_date) VALUES(?,1,'2026-03-15','2026-06-30')",[id]);
  const before=(await pool.execute('SELECT * FROM employee_files WHERE employee_id=?',[id]))[0];
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/api/contract-files';
  const pdf=Buffer.from('%PDF-1.4\ncontract\n%%EOF');
  async function upload(target,body=pdf,expected=201,rev=revision,workerId=id){
    const response=await fetch(`${base}/workers/${workerId}/${target}/pdf`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/pdf','X-Ficha-Revision':String(rev)},body});
    const result=await response.json();assert.equal(response.status,expected,JSON.stringify(result));return result;
  }
  async function history(){const response=await fetch(`${base}/workers/${id}`,{headers:{Authorization:'Bearer '+token}});assert.equal(response.status,200);return response.json();}
  try {
    assert.equal((await fetch(`${base}/workers/${id}`)).status,401);
    const contract=await upload('contract');const annex=await upload('1');
    await upload('contract',pdf,409);await upload('2',pdf,409);
    await upload('1',Buffer.from('archivo no PDF'),400);
    await upload('1',Buffer.from('%PDF-1.4 incompleto'),400);
    await upload('contract',pdf,409,revision+1);
    await upload('contract',pdf,404,revision,999999);
    let records=(await history()).attachments;
    assert.equal(records.length,2);assert.equal(records.find(a=>a.id===contract.id).annexOrder,null);assert.equal(records.find(a=>a.id===annex.id).annexOrder,1);
    const download=await fetch(`${base}/${annex.id}/pdf`,{headers:{Authorization:'Bearer '+token}});
    assert.equal(download.headers.get('cache-control'),'no-store');assert.deepEqual(Buffer.from(await download.arrayBuffer()),pdf);
    const second=Buffer.from('%PDF-1.4\nsecond\n%%EOF');await upload('contract',second);
    await pool.execute("UPDATE employee_contract_annexes SET end_date='2026-07-31' WHERE employee_id=? AND annex_order=1",[id]);
    const snapshot=JSON.parse((await pool.execute('SELECT contract_snapshot_json FROM employee_contract_files WHERE id=?',[annex.id]))[0][0].contract_snapshot_json);
    assert.equal(snapshot.annex.endDate,'2026-06-30');
    await pool.execute("CREATE TRIGGER fail_upload_audit BEFORE INSERT ON audit_logs WHEN NEW.entity_type='employee_contract_file' BEGIN SELECT RAISE(ABORT,'audit failure'); END");
    const originalError=console.error;
    console.error=(...args)=>{if(args[0]?.message!=='audit failure')originalError(...args);};
    try {await upload('contract',Buffer.from('%PDF-1.4\nthird\n%%EOF'),500);} finally {console.error=originalError;}
    await pool.execute('DROP TRIGGER fail_upload_audit');
    assert.equal((await history()).attachments.length,3);
    assert.deepEqual((await pool.execute('SELECT * FROM employee_files WHERE employee_id=?',[id]))[0],before);
    assert.equal((await pool.execute("SELECT COUNT(*) AS n FROM audit_logs WHERE entity_type='employee_contract_file'"))[0][0].n,3);
    assert.equal((await pool.execute("SELECT COUNT(*) AS n FROM schema_migrations WHERE id='20261010_013_contract_files'"))[0][0].n,1);
    assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
  } finally {await new Promise(resolve=>server.close(resolve));await pool.end();}
});
