import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='document-audit-test-secret';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');
const {canonicalDocumentName,dominantDocumentPeriod,classifyDocumentAudit}=await import('../documentAudit.js');

test('normaliza visualmente alias y clasifica sin escribir',()=>{
  assert.equal(canonicalDocumentName('I.R.L.'),'IRL');
  assert.equal(canonicalDocumentName('IRL 2026'),'IRL');
  assert.equal(canonicalDocumentName('Pacto horario de horas'),'PACTO DE HORAS');
  const pattern=dominantDocumentPeriod(['2026-09-01','2026-09-10','2026-09-20','2025-09-01']);
  assert.equal(pattern.period,'2026-09');
  assert.equal(classifyDocumentAudit({entries:[],applies:true}).status,'MISSING');
  assert.equal(classifyDocumentAudit({entries:[{id:1,expiryMode:'PERIOD',deliveredOn:'2026-09-01',startOn:null,expiresOn:null}]}).status,'INCOMPLETE');
});

test('GET auditoría detecta faltantes, incompletos y patrón IRL sin modificar documentos',async()=>{
  await runMigrations();
  const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('audit-admin','hash','Auditor','admin')");
  const [operator]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('audit-op','hash','Operador','operator')");
  const workers=[];
  for(const name of ['Uno','Dos','Tres','Cuatro','Cinco']){
    const [row]=await pool.execute('INSERT INTO employees(full_name,document_id) VALUES(?,?)',[name,'RUT-'+name]);
    workers.push(row.insertId);
  }
  const [irl]=await pool.execute("INSERT INTO employee_document_types(name,expiry_mode,is_active,applicability) VALUES('I.R.L.','NONE',1,'ALL')");
  for(const [index,date] of ['2026-09-01','2026-09-10','2026-09-20','2025-09-01'].entries()){
    await pool.execute('INSERT INTO employee_document_entries(employee_id,document_type_id,document_name,expiry_mode,delivered_on) VALUES(?,?,?,?,?)',
      [workers[index],irl.insertId,index===3?'IRL 2025':'I.R.L.','NONE',date]);
  }
  const [pact]=await pool.execute("SELECT id FROM employee_document_types WHERE name='PACTO DE HORAS'");
  await pool.execute('INSERT INTO employee_document_entries(employee_id,document_type_id,document_name,expiry_mode,delivered_on,start_on,expires_on) VALUES(?,?,?,?,?,?,?)',
    [workers[0],pact[0].id,'PACTO DE HORAS','PERIOD','2026-10-01',null,null]);

  const before=(await pool.execute('SELECT id,employee_id,document_type_id,document_name,expiry_mode,delivered_on,start_on,expires_on FROM employee_document_entries ORDER BY id'))[0];
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/api/document-audit';
  const adminToken=signAdmin({id:admin.insertId,username:'audit-admin',role:'admin'});
  const operatorToken=signAdmin({id:operator.insertId,username:'audit-op',role:'operator'});
  try{
    const response=await fetch(base,{headers:{Authorization:'Bearer '+adminToken}});
    assert.equal(response.status,200);
    const data=await response.json();
    assert.equal(data.readOnly,true);
    const irlGroup=data.groups.find(group=>group.key==='IRL');
    assert.ok(irlGroup);
    assert.equal(irlGroup.dominantPeriod.period,'2026-09');
    assert.equal(irlGroup.rows.find(row=>row.employeeId===workers[4]).status,'MISSING');
    assert.equal(irlGroup.rows.find(row=>row.employeeId===workers[3]).status,'REVIEW');
    const pactGroup=data.groups.find(group=>group.key==='PACTO DE HORAS');
    assert.equal(pactGroup.rows.find(row=>row.employeeId===workers[0]).status,'INCOMPLETE');
    const denied=await fetch(base,{headers:{Authorization:'Bearer '+operatorToken}});
    assert.equal(denied.status,403);
    const after=(await pool.execute('SELECT id,employee_id,document_type_id,document_name,expiry_mode,delivered_on,start_on,expires_on FROM employee_document_entries ORDER BY id'))[0];
    assert.deepEqual(after,before);
  }finally{
    await new Promise(resolve=>server.close(resolve));
    await pool.end();
  }
});
