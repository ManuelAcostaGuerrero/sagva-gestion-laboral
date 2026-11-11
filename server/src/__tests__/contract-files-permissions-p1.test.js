import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='prueba-permisos-pdf-contratos-p1';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');
const {bootstrapRoot}=await import('../securityPermissions.js');

test('P1: al configurar Root, los PDF contractuales requieren permiso individual',async()=>{
 await runMigrations();
 const [owner]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('p1-root','test','Root prueba','admin')");
 const [operator]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('p1-operator','test','Operador prueba','operator')");
 const [worker]=await pool.execute("INSERT INTO employees(full_name) VALUES('Trabajador sintético')");
 const id=worker.insertId;
 await pool.execute("INSERT INTO employee_files(employee_id,contract_type,hire_date) VALUES(?,'INDEFINIDO','2026-01-01')",[id]);
 const [document]=await pool.execute(
  "INSERT INTO employee_contract_files(employee_id,filename,pdf,sha256,contract_snapshot_json,uploaded_by) VALUES(?,?,?,?,?,?)",
  [id,'contrato.pdf',Buffer.from('%PDF-1.4\\n%%EOF'),'sha256-ficticio','{}',owner.insertId]);
 const tokens={root:signAdmin({id:owner.insertId,username:'p1-root',role:'admin'}),operator:signAdmin({id:operator.insertId,username:'p1-operator',role:'operator'})};
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port+'/api';
 async function http(path,role='operator',expected=200,method='GET',data){
  const res=await fetch(base+path,{method,headers:{Authorization:'Bearer '+tokens[role],...(data?{'Content-Type':'application/json'}:{})},
   body:data?JSON.stringify(data):undefined});
  assert.equal(res.status,expected,path+' '+res.status+' '+(res.status!==200?await res.text():''));
  if(res.headers.get('content-type')?.includes('application/json'))return res.json();
  return res;
 }
 try{
  // Compatibilidad: antes de Root se conserva la visibilidad antigua del operador.
  await http('/contract-files/'+document.insertId+'/pdf');
  process.env.SAGVA_ROOT_USER_ID=String(owner.insertId);
  assert.equal(await bootstrapRoot(pool),true);
  await http('/contract-files/workers/'+id,'operator',403);
  await http('/contract-files/'+document.insertId+'/pdf','operator',403);
  await http('/contract-files/'+document.insertId+'/pdf','root',200);
  await http('/admin/access/users/'+operator.insertId+'/permissions','root',201,'POST',{
    permission:'personal.contract.read',effect:'ALLOW',scopeKind:'GLOBAL',reason:'Prueba de lectura limitada'
  });
  await http('/contract-files/workers/'+id,'operator',200);
  await http('/contract-files/'+document.insertId+'/pdf','operator',200);
  await http('/admin/access/users/'+operator.insertId+'/permissions','root',201,'POST',{
    permission:'personal.contract.read',effect:'DENY',scopeKind:'GLOBAL',reason:'Prueba de revocación por denegación'
  });
  await http('/contract-files/'+document.insertId+'/pdf','operator',403);
  assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
 }finally{
  delete process.env.SAGVA_ROOT_USER_ID;
  await new Promise(resolve=>server.close(resolve));
  await pool.end();
 }
});
