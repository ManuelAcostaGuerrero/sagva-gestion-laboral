import test from 'node:test';import assert from 'node:assert/strict';
process.env.SQLITE_PATH=':memory:';process.env.JWT_SECRET='equipment-test-secret';
const {app}=await import('../app.js');const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');const {signAdmin}=await import('../auth.js');
test('Implementos configurables y entregas históricas por trabajador',async t=>{
 await runMigrations();
 const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('equip-admin','hash','ADMIN','admin')");
 const token=signAdmin({id:admin.insertId,username:'equip-admin',role:'admin'});
 const [worker]=await pool.execute("INSERT INTO employees(full_name) VALUES('TRABAJADOR SINTÉTICO')");
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>server.close());
 const base='http://127.0.0.1:'+server.address().port+'/api';
 async function request(path,method='GET',data,expected=200){
  const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
  const result=await response.json();assert.equal(response.status,expected,method+' '+path+': '+JSON.stringify(result));return result;
 }
 const catalog=await request('/document-catalog');
 const type=catalog.types.find(t=>t.name==='ENTREGA DE IMPLEMENTOS DE TRABAJO');
 assert.ok(type);
 await request('/document-catalog/'+type.id,'PUT',{name:type.name,expiryMode:'NONE',applicability:'ALL',items:['UNIFORME','GUANTES']});
 const available=(await request('/employee-documents/types?workerId='+worker.insertId)).types.find(x=>x.id===type.id);
 assert.equal(available.items.length,2);
 const selected=available.items.find(x=>x.name==='UNIFORME');
 await request('/employee-documents/workers/'+worker.insertId+'/entries','POST',{typeId:type.id,deliveredOn:'2026-11-13',equipmentItems:[{itemId:selected.id,quantity:2}]},201);
 const history=await request('/employee-documents/workers/'+worker.insertId);
 assert.deepEqual(history.entries[0].equipmentItems.map(x=>[x.name,x.quantity]),[['UNIFORME',2]]);
 await request('/employee-documents/workers/'+worker.insertId+'/entries','POST',{typeId:type.id,deliveredOn:'2026-11-13',equipmentItems:[]},400);
 assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
});
