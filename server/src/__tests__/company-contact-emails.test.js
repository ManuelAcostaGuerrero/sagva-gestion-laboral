import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='synthetic-test-company-emails-2026';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');

test('Correos institucional y soporte por empresa: validar, persistir y conservar al editar',async t=>{
 await runMigrations();
 await runMigrations();
 const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('company-emails-test','hash','Administrador ficticio','admin')");
 const token=signAdmin({id:admin.insertId,username:'company-emails-test',role:'admin'});
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>server.close());
 const base='http://127.0.0.1:'+server.address().port+'/api';
 async function call(path,method='GET',body,expected=200){
  const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const json=await response.json();assert.equal(response.status,expected,method+' '+path+' '+JSON.stringify(json));return json;
 }
 const company={legalName:'Empresa Ficticia Uno',email:'Contacto@ejemplo.invalid',supportEmail:'Soporte@ejemplo.invalid'};
 const created=await call('/companies','POST',company,201);
 let list=(await call('/companies')).companies;
 let current=list.find(x=>x.id===created.id);
 assert.equal(current.email,'contacto@ejemplo.invalid');
 assert.equal(current.supportEmail,'soporte@ejemplo.invalid');
 await call('/companies/'+created.id,'PUT',{...current,supportEmail:'correo-sin-arroba'},400);
 await call('/companies/'+created.id,'PUT',{...current,supportEmail:'ayuda@ejemplo.invalid'},200);
 current=(await call('/companies')).companies.find(x=>x.id===created.id);
 assert.equal(current.email,'contacto@ejemplo.invalid');
 assert.equal(current.supportEmail,'ayuda@ejemplo.invalid');
 assert.equal(current.revision,2);
 const createdOther=await call('/companies','POST',{legalName:'Empresa Ficticia Dos',email:'dos@ejemplo.invalid',supportEmail:'soporte2@ejemplo.invalid'},201);
 assert.notEqual(createdOther.id,created.id);
 assert.equal((await call('/companies')).companies.length,2);
 assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
});
