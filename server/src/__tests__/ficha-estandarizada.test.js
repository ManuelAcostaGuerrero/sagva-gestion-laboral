import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='test-ficha-estandarizada';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');
const {workerNumberFromRut,assembledWorkerName,phoneResult}=await import('../workerFileStandards.js');

test('Reglas independientes: RUT, composición de nombres y teléfono',()=>{
 assert.equal(workerNumberFromRut('12.345.678-5'),'12345678');
 assert.equal(workerNumberFromRut('12.345.678-4'),'');
 assert.equal(assembledWorkerName({firstName:' maría ',secondName:' josé ',firstLastName:' núñez '}),'MARÍA JOSÉ NÚÑEZ');
 assert.equal(phoneResult('9 1234 5678',{mobile:true}).value,'+56912345678');
 assert.equal(phoneResult('+58 412 123 4567',{mobile:true}).valid,true);
 assert.equal(phoneResult('abc',{mobile:true}).valid,false);
});

test('Empresa, ficha provisional/validada y condiciones contractuales preservan historial y permisos',async()=>{
 await runMigrations();await runMigrations();
 const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('std-a','hash','Admin','admin')");
 const [operator]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('std-o','hash','Operador','operator')");
 const a=signAdmin({id:admin.insertId,username:'std-a',role:'admin'});
 const o=signAdmin({id:operator.insertId,username:'std-o',role:'operator'});
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port+'/api';
 async function req(path,method='GET',body,expected=200,token=a){
  const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();
  assert.equal(response.status,expected,path+' '+JSON.stringify(data));
  return data;
 }
 try{
  await req('/companies','POST',{legalName:'Sin permiso'},403,o);
  const created=await req('/companies','POST',{legalName:'  empresa de prueba  ',taxId:'77.376.536-7',
   representativeName:' representante uno ',defaultSchedule:'PART_TIME',defaultBranch:' sucursal centro '},201);
  const company=(await req('/companies')).companies[0];
  assert.equal(company.legalName,'EMPRESA DE PRUEBA');
  assert.equal(company.representativeName,'REPRESENTANTE UNO');
  const limited=(await req('/companies','GET',undefined,200,o)).companies[0];
  assert.equal(limited.representativeRut,undefined);
  await req('/companies/'+created.id,'PUT',{...company,tradeName:'nuevo nombre',revision:0},409);
  const employee=await req('/employee-files','POST',{
   firstName:' ana ',firstLastName:' peña ',documentId:'12.345.678-5',companyId:created.id,
   mobile:'9 1234 5678',extra:{civilStatus:'SOLTERO/A',workerNumber:'historico'}},201);
  let file=employee.file;
  assert.equal(file.fullName,'ANA PEÑA');
  assert.equal(file.company,'EMPRESA DE PRUEBA');
  assert.equal(file.extra.branch,'SUCURSAL CENTRO');
  assert.equal(file.mobile,'+56912345678');
  assert.equal(file.extra.workerNumber,'12345678');
  assert.equal(file.extra.legacyWorkerNumber,'historico');
  assert.equal(file.validationStatus,'NO_VALIDADO');
  await req('/employee-files/'+file.id,'PUT',{...file,completeProfile:true},400);
  await req('/employee-files/'+file.id,'PUT',{...file,mobile:'+56ABC'},400);
  const before=(await req('/employee-files')).files.find(x=>x.id===file.id);
  assert.equal(before.mobile,'+56912345678');
  await req('/contract-terms/workers/'+file.id,'GET',undefined,403,o);
  const terms=(await req('/contract-terms/workers/'+file.id)).terms;
  assert.equal(terms.revision,0);
  const updated=await req('/contract-terms/workers/'+file.id,'PUT',{
   ...terms,monthlyBaseSalary:450000,weeklyHours:30,
   jobDuties:'Funciones revisables',breakMinutes:30},200);
  assert.equal(updated.terms.revision,1);
  await req('/contract-terms/workers/'+file.id,'PUT',{...terms,monthlyBaseSalary:500000},409);
  const [history]=await pool.execute('SELECT revision,snapshot_json FROM employee_contract_terms_history WHERE employee_id=?',[file.id]);
  assert.equal(history.length,1);
  assert.equal(JSON.parse(history[0].snapshot_json).monthlyBaseSalary,450000);
  const edited=await req('/companies/'+created.id,'PUT',{...company,tradeName:'NUEVO NOMBRE'},200);
  assert.match(edited.message,/sin modificar fichas históricas/);
  file=(await req('/employee-files')).files.find(x=>x.id===file.id);
  assert.equal(file.company,'EMPRESA DE PRUEBA');
  const second=await req('/companies','POST',{legalName:'Empresa segunda',defaultBranch:'Sucursal norte'},201);
  const switched=await req('/employee-files/'+file.id,'PUT',{...file,companyId:second.id});
  assert.equal(switched.file.company,'EMPRESA SEGUNDA');
  assert.equal(switched.file.extra.branch,'SUCURSAL NORTE');
  const third=await req('/companies','POST',{legalName:'Empresa sin sucursal'},201);
  const cleared=await req('/employee-files/'+file.id,'PUT',{...switched.file,companyId:third.id});
  assert.equal(cleared.file.extra.branch,null);
  const preserved=await req('/employee-files/'+file.id,'PUT',{...cleared.file,extra:{...cleared.file.extra,branch:'SUCURSAL HISTÓRICA'}});
  const unrelated=await req('/employee-files/'+file.id,'PUT',{...preserved.file,address:'Dirección nueva'});
  assert.equal(unrelated.file.extra.branch,'SUCURSAL HISTÓRICA');
  assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
 }finally{await new Promise(resolve=>server.close(resolve));await pool.end();}
});
