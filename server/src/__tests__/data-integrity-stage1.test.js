import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='prueba-etapa-uno-integridad-datos';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');

test('P1: estado laboral atómico, empresa estable, reactivación y bloqueo de finiquito',async()=>{
 await runMigrations();
 const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('p1-data-admin','test','Administrador P1','admin')");
 const token=signAdmin({id:admin.insertId,username:'p1-data-admin',role:'admin'});
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const root='http://127.0.0.1:'+server.address().port+'/api';
 async function call(path,method='GET',body,expected=200){
  const response=await fetch(root+path,{
   method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:body===undefined?undefined:JSON.stringify(body)
  });
  const payload=await response.json();
  assert.equal(response.status,expected,method+' '+path+' '+JSON.stringify(payload));
  return payload;
 }
 try{
  const company=await call('/companies','POST',{legalName:'Empresa de prueba'},201);
  const employee=(await call('/employee-files','POST',{
   firstName:'Ana',firstLastName:'Pérez',documentId:'12.345.678-5',
   companyId:company.id,employmentStatus:'ACTIVO'
  },201)).file;
  const id=employee.id;
  assert.equal(employee.companyId,company.id);
  assert.equal(employee.employmentStatus,'ACTIVO');
  const partial=(await call('/employee-files/'+id,'PUT',{revision:employee.revision,address:'Calle de prueba'})).file;
  assert.equal(partial.companyId,company.id,'Un guardado parcial NO puede quitar company_id');
  assert.equal(partial.company,'EMPRESA DE PRUEBA');
  await call('/employee-files/'+id,'PUT',{revision:partial.revision,company:'EMPRESA FALSA'},400);
  const [source]=await pool.execute('SELECT count(*) n FROM employees WHERE id=?',[id]);
  assert.equal(source[0].n,1);
  await call('/employees/'+id,'DELETE',{reason:'Baja administrativa documentada'},200);
  const off=(await call('/employee-files')).files.find(x=>x.id===id);
  assert.equal(off.isActive,0);
  assert.equal(off.employmentStatus,'INACTIVO');
  await call('/employee-files/'+id,'PUT',{revision:off.revision,employmentStatus:'ACTIVO'},400);
  await call('/employees/'+id+'/reactivate','POST',{reason:'Reactivación administrativa autorizada'},200);
  const on=(await call('/employee-files')).files.find(x=>x.id===id);
  assert.equal(on.isActive,1);
  assert.equal(on.employmentStatus,'ACTIVO');
  await call('/employee-files/'+id,'PUT',{revision:on.revision,employmentStatus:'FINIQUITADO',terminationReason:'Fin de contrato'},200);
  const finished=(await call('/employee-files')).files.find(x=>x.id===id);
  assert.equal(finished.isActive,0);
  assert.equal(finished.employmentStatus,'FINIQUITADO');
  await call('/employees/'+id+'/reactivate','POST',{reason:'No reabrir el contrato terminado'},409);
  const unchanged=(await call('/employee-files')).files.find(x=>x.id===id);
  assert.equal(unchanged.employmentStatus,'FINIQUITADO');
  const [events]=await pool.execute("SELECT action FROM audit_logs WHERE entity_type='employee' AND entity_id=?",[String(id)]);
  assert.ok(events.some(x=>x.action==='deactivate'));
  assert.ok(events.some(x=>x.action==='reactivate'));
  assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
 }finally{
  await new Promise(resolve=>server.close(resolve));
  await pool.end();
 }
});
