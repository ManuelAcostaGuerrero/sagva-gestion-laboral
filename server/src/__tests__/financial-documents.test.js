import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SQLITE_PATH=':memory:';process.env.JWT_SECRET='financial-annex-tests';
const {app}=await import('../app.js');const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');const {signAdmin}=await import('../auth.js');
const {financialDocumentKind}=await import('../financialDocuments.js');
test('Identifica anexos financieros sin confundir contratos ni documentos generales',()=>{
 assert.equal(financialDocumentKind('ANEXO AL CONTRATO AUMENTO SUELDO'),'SALARY_INCREASE');
 assert.equal(financialDocumentKind('Anexo contrato bono'),'BONUS');
 assert.equal(financialDocumentKind('PACTO DE HORAS'),null);
});
test('Aumento y bono guardan montos por entrega, validan importes y preservan históricos, permisos y sueldo base',async()=>{
 await runMigrations();await runMigrations();
 const [owner]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('amount-admin','hash','Prueba','admin')");
 const [operator]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('amount-oper','hash','Prueba','operator')");
 const admin=signAdmin({id:owner.insertId,username:'amount-admin',role:'admin'}),oper=signAdmin({id:operator.insertId,username:'amount-oper',role:'operator'});
 const [worker]=await pool.execute("INSERT INTO employees(full_name) VALUES('Persona anexo')");
 const id=worker.insertId;
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port+'/api/employee-documents';
 async function req(path,method='GET',body,expected=200,token=admin){
  const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const result=await response.json();assert.equal(response.status,expected,JSON.stringify(result));return result;
 }
 try {
  const types=(await req('/types')).types;
  const salary=types.find(type=>type.financialKind==='SALARY_INCREASE'),bonus=types.find(type=>type.financialKind==='BONUS');
  assert.ok(salary);assert.ok(bonus);assert.equal(types.filter(type=>type.financialKind==='BONUS').length,1);
  const path='/workers/'+id+'/entries';
  const data={typeId:salary.id,deliveredOn:'2026-10-11',startOn:'2026-10-11',agreedAmount:600000,amountMeaning:'NEW_BASE'};
  await req(path,'POST',{...data,agreedAmount:undefined},400);
  for(const amount of [0,-1,1.5,'600000',1000000000001])await req(path,'POST',{...data,agreedAmount:amount},400);
  await req(path,'POST',{...data,amountMeaning:undefined},400);
  await req(path,'POST',{...data,startOn:undefined},400);
  await req(path,'POST',data,403,oper);
  const first=await req(path,'POST',data,201);
  const second=await req(path,'POST',{...data,deliveredOn:'2026-11-01',startOn:'2026-11-01',agreedAmount:70000,amountMeaning:'INCREASE'},201);
  await req(path,'POST',{...data,typeId:bonus.id,agreedAmount:50000,amountMeaning:'BONUS',expiryMode:'MANUAL',expiresOn:'2026-12-31'},201);
  const history=(await req('/workers/'+id)).entries;
  assert.equal(history.find(entry=>entry.id===first.id).agreedAmount,600000);
  assert.equal(history.find(entry=>entry.id===second.id).agreedAmount,70000);
  assert.equal(history.find(entry=>entry.typeId===bonus.id).expiresOn,'2026-12-31');
  assert.equal(history.find(entry=>entry.typeId===bonus.id).financialKind,'BONUS');
  assert.ok((await req('/workers/'+id,'GET',undefined,200,oper)).entries.every(entry=>entry.agreedAmount===null));
  assert.equal((await pool.execute('SELECT * FROM employee_contract_terms WHERE employee_id=?',[id]))[0].length,0);
  const pdf=Buffer.from('%PDF-1.4\nannex\n%%EOF');
  const uploaded=await fetch(`${base}/entries/${first.id}/pdf`,{method:'POST',headers:{Authorization:'Bearer '+admin,'Content-Type':'application/pdf'},body:pdf});assert.equal(uploaded.status,201);
  assert.equal((await req('/workers/'+id)).entries.find(entry=>entry.id===first.id).attachments.length,1);
  const retro=await req(path,'POST',{...data,retroactive:true,retroactiveAmount:120000,retroactiveMonths:['2026-09','2026-07','2026-09'],versionLabel:'No guardar versión'},201);
  let updated=(await req('/workers/'+id)).entries.find(entry=>entry.id===retro.id);
  assert.equal(updated.retroactive,true);assert.equal(updated.retroactiveAmount,120000);
  assert.deepEqual(updated.retroactiveMonths,['2026-07','2026-09']);assert.equal(updated.versionLabel,null);
  const noRetro=(await req('/workers/'+id)).entries.find(entry=>entry.id===first.id);
  assert.equal(noRetro.retroactive,false);assert.equal(noRetro.retroactiveAmount,null);assert.deepEqual(noRetro.retroactiveMonths,[]);
  for(const extra of [
    {retroactive:true,retroactiveMonths:['2026-09']},
    {retroactive:true,retroactiveAmount:120000,retroactiveMonths:[]},
    {retroactive:true,retroactiveAmount:120000,retroactiveMonths:['2026-13']},
    {retroactive:true,retroactiveAmount:120000,retroactiveMonths:['0000-01']},
    {retroactive:true,retroactiveAmount:0,retroactiveMonths:['2026-09']},
    {retroactive:false,retroactiveAmount:120000,retroactiveMonths:['2026-09']}
  ])await req(path,'POST',{...data,...extra},400);
  await req(path,'POST',{...data,typeId:bonus.id,amountMeaning:'BONUS',retroactive:true,retroactiveAmount:120000,retroactiveMonths:['2026-09']},400);
  updated=(await req('/workers/'+id,'GET',undefined,200,oper)).entries.find(entry=>entry.id===retro.id);
  assert.equal(updated.retroactiveAmount,null);assert.equal(updated.agreedAmount,null);
  await pool.execute("UPDATE employee_document_types SET name='ANEXO HISTÓRICO' WHERE id=?",[salary.id]);
  assert.equal((await req('/workers/'+id)).entries.find(entry=>entry.id===first.id).financialKind,'SALARY_INCREASE');
  const audit=(await pool.execute("SELECT details FROM audit_logs WHERE entity_type='employee_document_entry'"))[0];
  assert.ok(audit.length>=3);assert.ok(audit.every(row=>!Object.hasOwn(JSON.parse(row.details),'agreedAmount')));
  assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
 } finally {await new Promise(resolve=>server.close(resolve));await pool.end();}
});
