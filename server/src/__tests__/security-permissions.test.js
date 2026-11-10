import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='test-permisos-individuales-ficticio';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');
const {bootstrapRoot}=await import('../securityPermissions.js');

test('Etapa 2: Root concede permisos individuales; deniega y revoca sin esperar JWT; no activa admin local inseguro',async t=>{
 await runMigrations();await runMigrations();
 const [owner]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('owner-test','hash','Root sintético','admin')");
 const [accounting]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('accounting-test','hash','Contabilidad sintética','admin')");
 const [other]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('other-test','hash','Otro administrador','admin')");
 process.env.SAGVA_ROOT_USER_ID=String(owner.insertId);
 assert.equal(await bootstrapRoot(pool),true);
 assert.equal(await bootstrapRoot(pool),false);
 const tokens={
  root:signAdmin({id:owner.insertId,username:'owner-test',role:'admin'}),
  accounting:signAdmin({id:accounting.insertId,username:'accounting-test',role:'admin'}),
  other:signAdmin({id:other.insertId,username:'other-test',role:'admin'})
 };
 const server=app.listen(0,'127.0.0.1');
 await new Promise(ok=>server.once('listening',ok));
 t.after(()=>server.close());
 const base='http://127.0.0.1:'+server.address().port+'/api';
 async function call(path,method='GET',body,role='root',expected=200){
  const res=await fetch(base+path,{method,headers:{Authorization:'Bearer '+tokens[role],'Content-Type':'application/json'},
   body:body===undefined?undefined:JSON.stringify(body)});
  const value=await res.json();
  assert.equal(res.status,expected,method+' '+path+' '+JSON.stringify(value));
  return value;
 }
 try{
  assert.equal((await call('/admin/access/self')).profile,'root');
  await call('/admin/access/catalog','GET',undefined,'other',403);
  await call('/admin/users','POST',{username:'blocked',fullName:'Usuario Bloqueado',password:'Password123',role:'operator'},'other',403);
  await call('/admin/access/users/'+accounting.insertId+'/profile','PUT',{profile:'admin_local'},'root',409);
  await call('/admin/access/users/'+owner.insertId+'/profile','PUT',{profile:'accounting'},'root',409);
  await call('/admin/access/users/999999/profile','PUT',{profile:'accounting'},'root',404);
  await call('/admin/access/users/'+accounting.insertId+'/permissions','POST',{
   permission:'labor.parameters.manage',effect:'ALLOW',scopeKind:'COMPANY',companyId:1,
   reason:'Permiso local pendiente de aislamiento'
  },'root',409);
  await call('/admin/access/users/'+accounting.insertId+'/permissions','POST',{
   permission:'labor.parameters.manage',effect:'ALLOW',scopeKind:'GLOBAL',validUntil:'2026-02-30',
   reason:'Fecha que no existe en el calendario'
  },'root',400);
  await call('/admin/access/users/'+accounting.insertId+'/profile','PUT',{profile:'accounting'});
  await call('/labor-accounting/','GET',undefined,'accounting');
  await call('/labor-accounting/parameters','POST',{
   metric:'SALUD_LEGAL',value:8,effectiveFrom:'2027-01-01',reason:'Intento sin autorización individual'
  },'accounting',403);
  await call('/labor-accounting/parameters','POST',{
   metric:'SALUD_LEGAL',value:8,effectiveFrom:'2027-01-01',reason:'Intento de legado tras Root'
  },'other',403);
  const path='/admin/access/users/'+accounting.insertId+'/permissions';
  const allow=await call(path,'POST',{
   permission:'labor.parameters.manage',effect:'ALLOW',scopeKind:'GLOBAL',reason:'Autorización individual de prueba'
  },'root',201);
  await call('/labor-accounting/parameters','POST',{
   metric:'SALUD_LEGAL',value:8,effectiveFrom:'2027-01-01',reason:'Nuevo valor de ejemplo autorizado'
  },'accounting',201);
  const deny=await call(path,'POST',{
   permission:'labor.parameters.manage',effect:'DENY',scopeKind:'GLOBAL',reason:'Bloqueo individual de prueba'
  },'root',201);
  await call('/labor-accounting/parameters','POST',{
   metric:'SALUD_LEGAL',value:9,effectiveFrom:'2027-02-01',reason:'No debe permitir con bloqueo'
  },'accounting',403);
  await call('/admin/access/permissions/'+deny.id+'/revoke','POST');
  await call('/labor-accounting/parameters','POST',{
   metric:'SALUD_LEGAL',value:9,effectiveFrom:'2027-02-01',reason:'Concesión recuperada después de revocar'
  },'accounting',201);
  await call('/admin/access/permissions/'+allow.id+'/revoke','POST');
  await call('/labor-accounting/parameters','POST',{
   metric:'SALUD_LEGAL',value:10,effectiveFrom:'2027-03-01',reason:'Sin concesión activa, acceso revocado'
  },'accounting',403);
  assert.equal((await call('/admin/access/users/'+accounting.insertId)).overrides.length,2);
  process.env.SAGVA_BANK_DATA_KEY='c'.repeat(64);
  const bank=await call(path,'POST',{
   permission:'personal.bank.read',effect:'ALLOW',scopeKind:'GLOBAL',reason:'Solo lectura de información financiera'
  },'root',201);
  assert.equal(bank.id>0,true);
  const capability=await call('/employee-benefits/bank-capability','GET',undefined,'accounting');
  assert.equal(capability.canAccess,true);
  assert.equal(capability.canWrite,false);
  await call('/employee-benefits/1/bank','PUT',{},'accounting',403);
  const [logs]=await pool.execute("SELECT action FROM audit_logs WHERE entity_type='security_user'");
  assert.ok(logs.some(x=>x.action==='grant_permission'));
  assert.ok(logs.some(x=>x.action==='revoke_permission'));
  assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
 }finally{
  delete process.env.SAGVA_ROOT_USER_ID;
  delete process.env.SAGVA_BANK_DATA_KEY;
 }
});
