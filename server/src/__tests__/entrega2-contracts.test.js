import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateApprovedSalary} from '../../../shared/salaryAnnex.js';
import {pendingFileSections,canCloseAfterSuccessfulSave} from '../../../client/src/employeeFileReview.js';

process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='test-entrega2-clave-ficticia';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');

test('Entrega 2: fórmula sueldo y protección borradores',()=>{
 assert.equal(calculateApprovedSalary({currentSalary:500000,amountMeaning:'NEW_BASE',agreedAmount:600000}),600000);
 assert.equal(calculateApprovedSalary({currentSalary:500000,amountMeaning:'INCREASE',agreedAmount:25000}),525000);
 assert.throws(()=>calculateApprovedSalary({currentSalary:null,amountMeaning:'INCREASE',agreedAmount:25000}),/registra el sueldo base/);
 assert.throws(()=>calculateApprovedSalary({currentSalary:500000,amountMeaning:'INCREASE',agreedAmount:-5}),/entero positivo/);
 assert.deepEqual(pendingFileSections({documents:true}),['Documento laboral en preparación']);
 assert.equal(canCloseAfterSuccessfulSave({savedSections:['Ficha general']}),true);
 assert.equal(canCloseAfterSuccessfulSave({savedSections:['Ficha general'],documents:true}),false);
 assert.equal(canCloseAfterSuccessfulSave({savedSections:[]}),false);
});

test('Entrega 2: aprobación exige PDF firmado y solo aplica una vez conservando historial',async()=>{
 await runMigrations();await runMigrations();
 const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('e2-admin','hash','Administrador','admin')");
 const [operator]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('e2-operator','hash','Operador','operator')");
 const [worker]=await pool.execute("INSERT INTO employees(full_name,document_id) VALUES('Trabajador ficticio E2','93.333.333-1')");
 const a=signAdmin({id:admin.insertId,username:'e2-admin',role:'admin'});
 const o=signAdmin({id:operator.insertId,username:'e2-operator',role:'operator'});
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port+'/api';
 async function req(path,method='GET',body,expected=200,token=a){
   const response=await fetch(base+path,{
     method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
     body:body===undefined?undefined:JSON.stringify(body)
   });
   const data=await response.json();
   assert.equal(response.status,expected,method+' '+path+': '+JSON.stringify(data));
   return data;
 }
 const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
 async function signedPdf(entryId){
   const response=await fetch(base+'/employee-documents/entries/'+entryId+'/pdf',{
     method:'POST',headers:{Authorization:'Bearer '+a,'Content-Type':'application/pdf','X-Documento-Firmado':'si','X-Fecha-Firma':'2026-11-09'},body:pdf
   });
   assert.equal(response.status,201,await response.text());
 }
 const url='/employee-documents/workers/'+worker.insertId+'/entries';
 try{
   const [migration]=await pool.execute("SELECT id FROM schema_migrations WHERE id='20261109_021_salary_annex_approval'");
   assert.equal(migration.length,1);
   const catalog=await req('/employee-documents/types');
   const type=catalog.types.find(x=>x.financialKind==='SALARY_INCREASE');
   assert.ok(type);
   const first=await req(url,'POST',{typeId:type.id,deliveredOn:'2026-11-09',startOn:'2026-11-09',agreedAmount:500000,amountMeaning:'NEW_BASE'},201);
   await req('/employee-documents/entries/'+first.id+'/approve-salary','POST',{},409);
   assert.equal((await req('/contract-terms/workers/'+worker.insertId)).terms.monthlyBaseSalary,'');
   await signedPdf(first.id);
   await req('/employee-documents/entries/'+first.id+'/approve-salary','POST',{},403,o);
   const approved=await req('/employee-documents/entries/'+first.id+'/approve-salary','POST',{});
   assert.equal(approved.approved.newSalary,500000);
   assert.equal(approved.approved.previousSalary,null);
   await req('/employee-documents/entries/'+first.id+'/approve-salary','POST',{},409);
   let terms=(await req('/contract-terms/workers/'+worker.insertId)).terms;
   assert.equal(terms.monthlyBaseSalary,500000);
   assert.equal(terms.revision,1);
   assert.equal((await req('/employee-documents/workers/'+worker.insertId)).entries.find(e=>e.id===first.id).approvedSalary,500000);
   terms=(await req('/contract-terms/workers/'+worker.insertId,'PUT',{...terms,workplace:'SUCURSAL CENTRO'})).terms;
   assert.equal(terms.revision,2);
   await req('/contract-terms/workers/'+worker.insertId,'PUT',{...terms,monthlyBaseSalary:999999},409);
   assert.equal((await req('/contract-terms/workers/'+worker.insertId)).terms.monthlyBaseSalary,500000);
   const second=await req(url,'POST',{typeId:type.id,deliveredOn:'2026-11-09',startOn:'2026-12-01',agreedAmount:50000,amountMeaning:'INCREASE'},201);
   await signedPdf(second.id);
   const increment=await req('/employee-documents/entries/'+second.id+'/approve-salary','POST',{});
   assert.equal(increment.approved.previousSalary,500000);
   assert.equal(increment.approved.newSalary,550000);
   terms=(await req('/contract-terms/workers/'+worker.insertId)).terms;
   assert.equal(terms.monthlyBaseSalary,550000);
   assert.equal(terms.workplace,'SUCURSAL CENTRO');
   assert.equal(terms.revision,3);
   await req('/employee-documents/entries/'+second.id+'/approve-salary','POST',{},409);
   const older=await req(url,'POST',{typeId:type.id,deliveredOn:'2026-11-09',startOn:'2026-11-20',agreedAmount:10000,amountMeaning:'INCREASE'},201);
   await signedPdf(older.id);
   await req('/employee-documents/entries/'+older.id+'/approve-salary','POST',{},409);
   const [applied]=await pool.execute('SELECT entry_id AS entryId,previous_salary AS oldSalary,new_salary AS newSalary FROM employee_salary_annex_approvals ORDER BY entry_id');
   assert.deepEqual(applied.map(x=>x.newSalary),[500000,550000]);
   const [revisions]=await pool.execute('SELECT revision,snapshot_json AS snapshot FROM employee_contract_terms_history WHERE employee_id=? ORDER BY revision',[worker.insertId]);
   assert.deepEqual(revisions.map(x=>x.revision),[1,2,3]);
   assert.equal(JSON.parse(revisions[0].snapshot).monthlyBaseSalary,500000);
   assert.equal(JSON.parse(revisions[2].snapshot).monthlyBaseSalary,550000);
   const [audit]=await pool.execute("SELECT action FROM audit_logs WHERE entity_type='employee_salary_annex'");
   assert.equal(audit.filter(x=>x.action==='approve').length,2);
   assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
 }finally{await new Promise(resolve=>server.close(resolve));await pool.end();}
});
