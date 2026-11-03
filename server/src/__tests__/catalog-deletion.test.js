import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='catalog-delete-tests-secret-2026-10-09';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');

test('Eliminar áreas y cargos: lista de activos/inactivos, liberación y protección de horarios',async()=>{
 await runMigrations();
 const [a]=await pool.execute("INSERT INTO admins(username,password_hash,full_name) VALUES('catalog-admin','test-hash','Admin catálogo')");
 const token=signAdmin({id:a.insertId,username:'catalog-admin',role:'admin'});
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const base=`http://127.0.0.1:${server.address().port}/api`;
 async function request(url,method='GET',body,status=200){
  const response=await fetch(base+url,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const result=await response.json();
  assert.equal(response.status,status,`${method} ${url}: ${JSON.stringify(result)}`);
  return result;
 }
 try {
  const area=(await request('/areas','POST',{name:'Área eliminable'},201)).id;
  const position=(await request('/positions','POST',{name:'Auxiliar'},201)).id;
  const employee=(await request('/employees','POST',{fullName:'Trabajador de prueba',documentId:'98.765.432-1',workAreaId:area,positionName:'auxiliar'},201)).id;
  for(const url of [`/areas/${area}/permanent`,`/positions/${position}/permanent`]) {
   const blocked=await request(url,'DELETE',undefined,409);
   assert.equal(blocked.assignedEmployees.length,1);
   assert.equal(blocked.assignedEmployees[0].id,employee);
   assert.equal(blocked.assignedEmployees[0].fullName,'Trabajador de prueba');
   assert.equal(blocked.assignedEmployees[0].documentId,'98.765.432-1');
   assert.equal(blocked.assignedEmployees[0].isActive,true);
  }
  await request(`/employees/${employee}`,'DELETE',{reason:'Probar asignación histórica'},200);
  for(const url of [`/areas/${area}/permanent`,`/positions/${position}/permanent`]) {
   const blocked=await request(url,'DELETE',undefined,409);
   assert.equal(blocked.assignedEmployees[0].isActive,false);
  }
  const file=(await request('/employee-files')).files.find(f=>f.id===employee);
  assert.ok(file);
  const updated=await request(`/employee-files/${employee}`,'PUT',{
   ...file,workAreaId:null,positionName:'',clearFields:['workAreaId','positionName']
  },200);
  assert.equal(updated.file.workAreaId,null);
  assert.equal(updated.file.positionName,null);
  await request(`/positions/${position}/permanent`,'DELETE');
  await request(`/areas/${area}/permanent`,'DELETE');
  assert.equal((await pool.execute('SELECT COUNT(*) AS total FROM work_areas WHERE id=?',[area]))[0][0].total,0);
  assert.equal((await pool.execute('SELECT COUNT(*) AS total FROM work_positions WHERE id=?',[position]))[0][0].total,0);
  const archived=(await request('/areas','POST',{name:'Área con historial'},201)).id;
  await pool.execute('INSERT INTO planner_weeks(area_id,week_start,required_staff_json) VALUES(?,?,?)',
   [archived,'2026-10-05','[0,0,0,0,0,0,0]']);
  const blocked=await request(`/areas/${archived}/permanent`,'DELETE',undefined,409);
  assert.equal(blocked.historyCount,1);
  assert.equal((await pool.execute('SELECT COUNT(*) AS total FROM planner_weeks WHERE area_id=?',[archived]))[0][0].total,1);
  const [audit]=await pool.execute("SELECT entity_type AS type,action FROM audit_logs WHERE action='delete' AND entity_type IN ('work_area','work_position')");
  assert.ok(audit.some(entry=>entry.type==='work_area'));
  assert.ok(audit.some(entry=>entry.type==='work_position'));
  assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
 }finally{await new Promise(resolve=>server.close(resolve));await pool.end();}
});
