import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='synthetic-labor-structure-no-production';
const {app}=await import('../../app.js');
const {pool}=await import('../../db.js');
const {runMigrations}=await import('../../migrations.js');
const {signAdmin}=await import('../../auth.js');
const {LABOR_STRUCTURE_MIGRATION}=await import('./laborStructure.migration.js');

test('1A-1E: ciclo contractual completo versionado, aislado por Root, transaccional y sin reescrituras',async()=>{
 await runMigrations();await runMigrations();
 const [migration]=await pool.execute('SELECT COUNT(*) n FROM schema_migrations WHERE id=?',[LABOR_STRUCTURE_MIGRATION]);
 assert.equal(migration[0].n,1);
 const [root]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('labor-root','hash','Root ficticio','admin')");
 const [ordinary]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('labor-admin','hash','Admin sin Root','admin')");
 await pool.execute("INSERT INTO security_user_profiles(user_id,profile) VALUES(?,'root')",[root.insertId]);
 const [worker]=await pool.execute("INSERT INTO employees(full_name,document_id) VALUES('PERSONA FICTICIA','12.345.678-5')");
 const [otherWorker]=await pool.execute("INSERT INTO employees(full_name,document_id) VALUES('OTRA PERSONA FICTICIA','98.765.432-1')");
 const [company]=await pool.execute("INSERT INTO company_profiles(legal_name) VALUES('EMPRESA ALFA FICTICIA')");
 const [otherCompany]=await pool.execute("INSERT INTO company_profiles(legal_name) VALUES('EMPRESA BETA FICTICIA')");
 await pool.execute('INSERT INTO employee_files(employee_id,company_id,company) VALUES(?,?,?)',
  [worker.insertId,company.insertId,'EMPRESA ALFA FICTICIA']);
 const [position]=await pool.execute("INSERT INTO work_positions(name) VALUES('CARGO FICTICIO')");
 const [area]=await pool.execute("INSERT INTO work_areas(name) VALUES('AREA FICTICIA')");
 const [entities]=await pool.execute("SELECT id,kind FROM labor_entities WHERE active=1");
 const afp=entities.find(x=>x.kind==='AFP'),fonasa=entities.find(x=>x.kind==='FONASA'),isapre=entities.find(x=>x.kind==='ISAPRE');
 assert.ok(afp&&fonasa&&isapre,'Se requieren los catálogos de migraciones existentes');

 const rootToken=signAdmin({id:root.insertId,username:'labor-root',role:'admin'});
 const otherToken=signAdmin({id:ordinary.insertId,username:'labor-admin',role:'admin'});
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port+'/api/labor-structure';
 async function call(p,method='GET',body,token=rootToken){
  const res=await fetch(base+p,{method,
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
   body:body===undefined?undefined:JSON.stringify(body)});
  const json=await res.json();
  return {status:res.status,data:json};
 }
 try{
  assert.equal((await call('/catalog','GET',undefined,otherToken)).status,403);
  assert.equal((await fetch(base+'/catalog')).status,401);
  const a=await call('/branches','POST',{companyId:company.insertId,code:'LOCAL-1',name:'LOCAL UNO',address:'DIRECCION BETA 1'});
  const b=await call('/branches','POST',{companyId:otherCompany.insertId,code:'OTRO',name:'LOCAL AJENO',address:''});
  assert.equal(a.status,201,JSON.stringify(a.data));assert.equal(b.status,201);
  let branchId=a.data.result.id;
  const branchEdit=await call('/branches/'+branchId,'PUT',{name:'LOCAL UNO ACTUALIZADO',address:'OTRA DIRECCION',active:true,revision:1});
  assert.equal(branchEdit.status,200,JSON.stringify(branchEdit.data));
  await assert.rejects(pool.execute('UPDATE company_branches SET company_id=? WHERE id=?',[otherCompany.insertId,branchId]));
  assert.equal((await call('/branches','POST',{companyId:company.insertId,code:'LOCAL-1',
   name:'DUPLICADO',address:''})).status,409,'Código de local duplicado');
  assert.equal((await call('/branches/'+branchId,'PUT',{name:'OTRO',address:'',active:true,revision:1})).status,409);
  const noDate=await call('/employments','POST',
   {employeeId:worker.insertId,companyId:company.insertId,startedOn:'2026-02-30',evidenceRef:'CONTRATO FICTICIO'});
  assert.equal(noDate.status,400);

  const hired=await call('/employments','POST',
   {employeeId:worker.insertId,companyId:company.insertId,startedOn:'2026-01-01',evidenceRef:'CONTRATO FICTICIO 001'});
  assert.equal(hired.status,201,JSON.stringify(hired.data));
  const id=hired.data.result.id;
  await assert.rejects(pool.execute('UPDATE employment_relationships SET employee_id=? WHERE id=?',[otherWorker.insertId,id]));
  await assert.rejects(pool.execute('DELETE FROM employment_relationships WHERE id=?',[id]));
  const again=await call('/employments','POST',
   {employeeId:worker.insertId,companyId:company.insertId,startedOn:'2026-04-01',evidenceRef:'CONTRATO FICTICIO 002'});
  assert.equal(again.status,409);

  const assignment={validFrom:'2026-01-01',branchId:b.data.result.id,areaId:area.insertId,
   positionId:position.insertId,evidenceRef:'DOCUMENTO ASIGNACION FICTICIO'};
  assert.equal((await call('/employments/'+id+'/assignments','POST',assignment)).status,403);
  const assigned=await call('/employments/'+id+'/assignments','POST',{...assignment,branchId});
  assert.equal(assigned.status,201,JSON.stringify(assigned.data));
  const moved=await call('/employments/'+id+'/assignments','POST',
   {...assignment,branchId:null,validFrom:'2026-06-01',evidenceRef:'TRASLADO FICTICIO VERIFICADO'});
  assert.equal(moved.status,201,JSON.stringify(moved.data));
  const [oldAssignment]=await pool.execute('SELECT valid_until AS end FROM employment_assignments WHERE id=?',[assigned.data.result.id]);
  assert.equal(oldAssignment[0].end,'2026-06-01');
  await assert.rejects(pool.execute('UPDATE employment_assignments SET branch_id=? WHERE id=?',[b.data.result.id,assigned.data.result.id]));

  const [shifts]=await pool.execute('SELECT id FROM work_shifts WHERE is_active=1 ORDER BY id LIMIT 2');
  assert.ok(shifts.length>=1,'Biblioteca de turnos disponible');
  const shift1=await call('/employments/'+id+'/shifts','POST',
   {validFrom:'2026-01-01',shiftId:shifts[0].id,evidenceRef:'HORARIO FICTICIO 001'});
  assert.equal(shift1.status,201,JSON.stringify(shift1.data));
  const shift2=await call('/employments/'+id+'/shifts','POST',
   {validFrom:'2026-05-01',shiftId:shifts[shifts.length-1].id,evidenceRef:'HORARIO FICTICIO 002'});
  assert.equal(shift2.status,201,JSON.stringify(shift2.data));
  const [oldShift]=await pool.execute('SELECT valid_until AS ended FROM employment_shift_versions WHERE id=?',
   [shift1.data.result.id]);
  assert.equal(oldShift[0].ended,'2026-05-01');
  await assert.rejects(pool.execute('UPDATE employment_shift_versions SET shift_id=99 WHERE id=?',
   [shift1.data.result.id]));
  const conditions={effectiveFrom:'2026-01-01',monthlyBaseSalaryClp:500000,weeklyHours:42,
   breakMinutes:60,contractType:'INDEFINIDO',regime:'GENERAL',description:'CONDICIONES FICTICIAS',
   evidenceRef:'CONTRATO PRUEBA 001 DOCUMENTADO'};
  const salary1=await call('/employments/'+id+'/conditions','POST',conditions);
  assert.equal(salary1.status,201,JSON.stringify(salary1.data));
  assert.equal(salary1.data.result.normativeAssessment.status,'WITHIN_GENERAL_LIMIT');
  const salary2=await call('/employments/'+id+'/conditions','POST',
   {...conditions,effectiveFrom:'2026-08-01',monthlyBaseSalaryClp:600000,evidenceRef:'ANEXO PRUEBA 002 DOCUMENTADO'});
  assert.equal(salary2.status,201,JSON.stringify(salary2.data));
  const exceeds=await call('/employments/'+id+'/conditions','POST',
   {...conditions,effectiveFrom:'2026-09-01',monthlyBaseSalaryClp:650000,
    weeklyHours:45,evidenceRef:'ANEXO PRUEBA EXCESO ORIENTATIVO'});
  assert.equal(exceeds.status,201,JSON.stringify(exceeds.data));
  assert.equal(exceeds.data.result.normativeAssessment.status,'EXCEEDS_GENERAL_LIMIT');
  assert.match(exceeds.data.result.normativeAssessment.warning,/supera/);
  const [original]=await pool.execute('SELECT monthly_base_salary_clp AS salary,effective_until AS ended FROM employment_terms_versions WHERE id=?',[salary1.data.result.id]);
  assert.equal(original[0].salary,500000);assert.equal(original[0].ended,'2026-08-01');
  await assert.rejects(pool.execute('UPDATE employment_terms_versions SET monthly_base_salary_clp=1 WHERE id=?',[salary1.data.result.id]));

  const oldPrevision=await call('/workers/'+worker.insertId+'/prevision','POST',
   {validFrom:'2026-01-01',afpEntityId:afp.id,healthEntityId:fonasa.id,
    planAmountHundredths:null,planUnit:null,evidenceRef:'CERTIFICADO PREVISION FICTICIO 01'});
  assert.equal(oldPrevision.status,201,JSON.stringify(oldPrevision.data));
  const newPrevision=await call('/workers/'+worker.insertId+'/prevision','POST',
   {validFrom:'2026-09-01',afpEntityId:afp.id,healthEntityId:isapre.id,
    planAmountHundredths:250,planUnit:'UF',evidenceRef:'CERTIFICADO PREVISION FICTICIO 02'});
  assert.equal(newPrevision.status,201,JSON.stringify(newPrevision.data));

  const pdf=Buffer.from('%PDF-1.4\nFICTICIO PARA TEST\n%%EOF');
  const sha=createHash('sha256').update(pdf).digest('hex');
  const [file]=await pool.execute(`INSERT INTO employee_contract_files
   (employee_id,filename,pdf,sha256,contract_snapshot_json,uploaded_by)
   VALUES(?,?,?,?,?,?)`,[worker.insertId,'contrato-ficticio.pdf',pdf,sha,'{}',root.insertId]);
  const linked=await call('/employments/'+id+'/documents','POST',
   {fileId:file.insertId,kind:'CONTRACT',evidenceRef:'PDF CONTRACTUAL FICTICIO'});
  assert.equal(linked.status,201,JSON.stringify(linked.data));
  const otherHired=await call('/employments','POST',
   {employeeId:otherWorker.insertId,companyId:otherCompany.insertId,startedOn:'2026-01-01',evidenceRef:'OTRO CONTRATO FICTICIO'});
  assert.equal(otherHired.status,201);
  const linkWrong=await call('/employments/'+otherHired.data.result.id+'/documents','POST',
   {fileId:file.insertId,kind:'CONTRACT',evidenceRef:'VINCULO FICTICIO INCORRECTO'});
  assert.equal(linkWrong.status,403);

  const jan=await call('/workers/'+worker.insertId+'/as-of?on=2026-04-01');
  const oct=await call('/workers/'+worker.insertId+'/as-of?on=2026-10-01');
  assert.equal(jan.status,200);
  assert.equal(jan.data.relationships[0].monthlyBaseSalaryClp,500000);
  assert.equal(jan.data.shifts[0].shiftId,shifts[0].id);
  assert.equal(oct.data.relationships[0].monthlyBaseSalaryClp,650000);
  assert.equal(oct.data.prevision.planUnit,'UF');
  const workerHistory=await call('/workers/'+worker.insertId);
  assert.equal(workerHistory.data.assignments.length,2);
  assert.equal(workerHistory.data.terms.length,3);
  assert.equal(workerHistory.data.prevision.length,2);
  assert.equal(workerHistory.data.documents.length,1);

  const finish=await call('/employments/'+id+'/finish','POST',{
   endedOn:'2026-12-31',reason:'TERMINO FICTICIO DOCUMENTADO',
   evidenceRef:'FINIQUITO O DOCUMENTO FICTICIO'});
  assert.equal(finish.status,200,JSON.stringify(finish.data));
  assert.equal((await call('/employments/'+id+'/finish','POST',{
   endedOn:'2026-12-31',reason:'TERMINO REPETIDO FICTICIO',evidenceRef:'DOCUMENTO FICTICIO'})).status,409);
  assert.equal((await call('/employments','POST',
   {employeeId:worker.insertId,companyId:company.insertId,startedOn:'2026-12-31',evidenceRef:'RECONTRATO FICTICIO'})).status,409);
  const rehire=await call('/employments','POST',
   {employeeId:worker.insertId,companyId:company.insertId,startedOn:'2027-01-01',evidenceRef:'RECONTRATO FICTICIO 2027'});
  assert.equal(rehire.status,201,JSON.stringify(rehire.data));
  const [events]=await pool.execute('SELECT COUNT(*) n FROM labor_lifecycle_events WHERE employment_id=?',[id]);
  assert.ok(events[0].n>=6);
  await assert.rejects(pool.execute('DELETE FROM labor_lifecycle_events WHERE employment_id=?',[id]));
  assert.equal((await pool.execute('PRAGMA integrity_check'))[0][0].integrity_check,'ok');
  assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
 }finally{
  await new Promise(resolve=>server.close(resolve));
  await pool.end();
 }
});
