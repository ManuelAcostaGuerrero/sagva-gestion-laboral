import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {checkRut,normalizeRut} from '../rut.js';
process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='isolated-worker-identity-tests-secret';
const {pool,createSqlitePool}=await import('../db.js');
const {app}=await import('../app.js');
const {runMigrations}=await import('../migrations.js');
const {migrateEmployeeFiles}=await import('../employeeFilesMigration.js');
const {migrateWorkerIdentity}=await import('../workerIdentityMigration.js');
const {projectRoot}=await import('../databasePath.js');
const {signAdmin}=await import('../auth.js');

test('RUT módulo 11 local: puntos, guion, K/k, faltantes y formatos incorrectos',()=>{
  for(const rut of ['12.345.678-5','12345678-5','123456785',' 12.345.678-5 ']) {
    assert.equal(checkRut(rut).valid,true);assert.equal(normalizeRut(rut),'123456785');
  }
  assert.equal(checkRut('6.000.000-k').valid,true);
  assert.equal(checkRut('6000000K').formatted,'6000000-K');
  for(const rut of ['12.345.678-9','00000000-0','texto','1234-K-99']) assert.equal(checkRut(rut).valid,false);
  assert.equal(checkRut(null).status,'PENDIENTE');
});

test('Migración conserva nombre legal literal, IDs, historial y propuestas conocidas sin inventar apellidos',async()=>{
  const db=createSqlitePool(':memory:');const c=await db.getConnection();
  try{
    await c.beginTransaction({foreignKeys:false});
    await c.execScript(fs.readFileSync(path.join(projectRoot,'database/schema.sql'),'utf8'));
    await c.execScript('CREATE TABLE schema_migrations(id TEXT PRIMARY KEY)');
    await c.execute("INSERT INTO employees(id,full_name,document_id) VALUES(10,?,NULL)",['  María  DEL CARMEN   Pérez ']);
    await c.execute("INSERT INTO attendance_records(employee_id,record_type) VALUES(10,'entrada')");
    await migrateEmployeeFiles(c);
    await c.execute('UPDATE employee_files SET extra_json=? WHERE employee_id=10',[JSON.stringify({firstName:'María Del Carmen',paternalLastName:'Pérez'})]);
    await migrateWorkerIdentity(c);await migrateWorkerIdentity(c);
    const row=(await c.execute('SELECT * FROM employees WHERE id=10'))[0][0];
    assert.equal(row.legal_full_name,'  María  DEL CARMEN   Pérez ');
    assert.equal(row.full_name,row.legal_full_name);assert.equal(row.first_name,'María');
    assert.equal(row.second_name,'Del');assert.equal(row.other_names,'Carmen');assert.equal(row.second_last_name,null);
    assert.equal((await c.execute('SELECT COUNT(*) n FROM attendance_records'))[0][0].n,1);
    assert.deepEqual((await c.execute('PRAGMA foreign_key_check'))[0],[]);
    await c.commit();
  }finally{c.release();await db.end();}
});

test('Ficha: partes independientes, legal literal, vacíos protegidos, revisión atribuida y provisional seguro',async()=>{
  await runMigrations();
  const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name) VALUES('identity-test','hash','Revisor prueba')");
  const token=signAdmin({id:admin.insertId,username:'identity-test',role:'admin'});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const request=async(route,body)=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/employee-files${route}`,{
      method:route?'PUT':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  };
  try{
    let result=await request('',{fullName:'Nombre conocido',legalFullName:'  Ana  María Pérez Soto ',documentId:'12345678-5',firstName:'Ana',secondName:'María',firstLastName:'Pérez',company:'Empresa',email:'ana@example.com'});
    assert.equal(result.status,201);let f=result.data.file;
    assert.equal(f.legalFullName,'  Ana  María Pérez Soto ');assert.equal(f.displayName,'ANA PÉREZ');
    assert.equal(f.validationStatus,'NO_VALIDADO');assert.equal(f.isValidated,0);assert.ok(f.pendingFields.length>0);
    result=await request(`/${f.id}`,{...f,company:'',email:'',secondName:'',firstName:'Anita',validationStatus:'VALIDADO',validationNotes:'Revisión manual'});
    assert.equal(result.status,200);f=result.data.file;
    assert.equal(f.company,'Empresa');assert.equal(f.email,'ANA@EXAMPLE.COM');assert.equal(f.secondName,'MARÍA');
    assert.equal(f.legalFullName,'  Ana  María Pérez Soto ');assert.equal(f.displayName,'ANITA PÉREZ');
    assert.equal(f.isValidated,1);assert.equal(f.validatedBy,admin.insertId);assert.ok(f.validatedAt);assert.equal(f.validationNotes,'Revisión manual');
    const validatedAt=f.validatedAt;
    result=await request(`/${f.id}`,{...f,company:'',clearFields:['company']});f=result.data.file;
    assert.equal(f.company,null);assert.equal(f.validatedAt,validatedAt);
    result=await request(`/${f.id}`,{...f,validationStatus:'NO_VALIDADO'});f=result.data.file;
    assert.equal(f.isValidated,0);assert.equal(f.validatedAt,null);assert.equal(f.validatedBy,null);
    for(let n=0;n<2;n++){
      result=await request('',{fullName:'Provisional',validationStatus:'VALIDADO'});
      assert.equal(result.status,201);assert.equal(result.data.file.documentId,null);assert.equal(result.data.file.isValidated,0);
    }
    result=await request('',{fullName:'Duplicado',documentId:'12.345.678-5'});assert.equal(result.status,409);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
