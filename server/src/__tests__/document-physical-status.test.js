import test from 'node:test';
import assert from 'node:assert/strict';
import {documentEvidenceLabels} from '../../../client/src/documentEvidenceStatus.js';
process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='synthetic-evidence-status-test-secret';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');

test('Los indicadores separan soporte físico, entrega digital y PDF cargado',()=>{
 assert.equal(documentEvidenceLabels(null,'MISSING').physical.text,'Sin respaldo físico disponible');
 assert.equal(documentEvidenceLabels(null,'AVAILABLE').digital.text,'Sin carga digital');
 assert.equal(documentEvidenceLabels({attachments:[]},'AVAILABLE').digital.kind,'warning');
 assert.equal(documentEvidenceLabels({attachments:[{id:1}]},'UNVERIFIED').digital.kind,'success');
 assert.equal(documentEvidenceLabels({attachments:[{id:1}]},'MISSING').physical.kind,'warning');
 assert.equal(documentEvidenceLabels(null,'UNVERIFIED').digital.kind,'danger');
});

test('Estado físico del documento: auditoría, concurrencia, permisos y PDF intacto',async t=>{
 await runMigrations();await runMigrations();
 const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('evidence-admin','hash','Administración prueba','admin')");
 const [operator]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('evidence-operator','hash','Operador prueba','operator')");
 const [employee]=await pool.execute("INSERT INTO employees(full_name,document_id) VALUES('Trabajador ficticio','11.111.111-1')");
 const [types]=await pool.execute("SELECT id FROM employee_document_types WHERE name='PACTO DE HORAS'");
 const typeId=types[0].id,workerId=employee.insertId;
 const tokens={admin:signAdmin({id:admin.insertId,username:'evidence-admin',role:'admin'}),operator:signAdmin({id:operator.insertId,username:'evidence-operator',role:'operator'})};
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>server.close());
 const base='http://127.0.0.1:'+server.address().port+'/api';
 async function req(path,method='GET',body,actor='admin',expected=200){
  const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+tokens[actor],'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const payload=await response.json();assert.equal(response.status,expected,method+' '+path+' '+JSON.stringify(payload));return payload;
 }
 const path='/employee-documents/workers/'+workerId+'/types/'+typeId+'/physical-status';
 let result=await req('/employee-documents/workers/'+workerId);
 assert.deepEqual(result.physicalStatuses,[]);
 await req(path,'PUT',{status:'MISSING',revision:0},'operator',403);
 await req(path,'PUT',{status:'MISSING',revision:0},'admin');
 result=await req('/employee-documents/workers/'+workerId);
 assert.equal(result.physicalStatuses[0].status,'MISSING');
 assert.equal(result.entries.length,0);
 await req(path,'PUT',{status:'AVAILABLE',revision:0},'admin',409);
 await req(path,'PUT',{status:'AVAILABLE',revision:1},'admin');
 result=await req('/employee-documents/workers/'+workerId);
 assert.equal(result.physicalStatuses[0].status,'AVAILABLE');
 assert.equal(result.physicalStatuses[0].revision,2);
 await req('/employee-documents/workers/'+workerId+'/types/999999/physical-status','PUT',{status:'MISSING',revision:0},'admin',404);
 await req(path,'PUT',{status:'inventado',revision:2},'admin',400);
 const [audits]=await pool.execute("SELECT action,entity_type FROM audit_logs WHERE entity_type='employee_document_physical_status'");
 assert.equal(audits.length,2);
 const [entries]=await pool.execute('SELECT id FROM employee_document_entries WHERE employee_id=?',[workerId]);
 assert.equal(entries.length,0);
 assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
});
