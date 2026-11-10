import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='campos-dinamicos-test-no-real';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {bootstrapRoot}=await import('../securityPermissions.js');
const {signAdmin}=await import('../auth.js');

test('Etapa 3: definición versionada, valores individuales, historial y permisos por campo',async t=>{
 await runMigrations();await runMigrations();
 const [root]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('root-demo','hash','Root ejemplo','admin')");
 const [account]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('account-demo','hash','Contabilidad ejemplo','admin')");
 const [worker]=await pool.execute("INSERT INTO employees(full_name,document_id) VALUES('Trabajador prueba','18.111.111-0')");
 process.env.SAGVA_ROOT_USER_ID=String(root.insertId);
 assert.equal(await bootstrapRoot(pool),true);
 const tok={
  root:signAdmin({id:root.insertId,username:'root-demo',role:'admin'}),
  account:signAdmin({id:account.insertId,username:'account-demo',role:'admin'})
 };
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>server.close());
 const base='http://127.0.0.1:'+server.address().port+'/api';
 async function req(path,method='GET',body,actor='root',expected=200){
  const res=await fetch(base+path,{method,headers:{Authorization:'Bearer '+tok[actor],'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const json=await res.json();assert.equal(res.status,expected,method+' '+path+' '+JSON.stringify(json));return json;
 }
 async function grant(permission){
  return req('/admin/access/users/'+account.insertId+'/permissions','POST',
   {permission,effect:'ALLOW',scopeKind:'GLOBAL',reason:'Permiso individual para prueba'},'root',201);
 }
 try{
  await req('/admin/access/users/'+account.insertId+'/profile','PUT',{profile:'accounting'});
  assert.equal((await req('/labor-fields/definitions')).canManage,true);
  const posted=await req('/labor-fields/definitions','POST',{
   code:'EXT_EQUIPO',label:'Equipo asignado',target:'FICHA',type:'SELECT',required:true,
   options:['ENTREGADO','PENDIENTE'],reason:'Campo complementario de ensayo'
  },'root',201);
  const id=posted.field.id;
  await req('/labor-fields/definitions','POST',{
   code:'EXT_EQUIPO',label:'Duplicado',target:'FICHA',type:'TEXT',required:false,options:[],reason:'Duplicación de ensayo'
  },'root',409);
  await req('/labor-fields/definitions','POST',{
   code:'EXT_MAL',label:'Seleccionar',target:'FICHA',type:'SELECT',required:false,options:[],reason:'Sin catálogo válido'
  },'root',400);
  await req('/labor-fields/definitions','POST',{
   code:'EXT_OTRO',label:'Nuevo campo',target:'FICHA',type:'TEXT',required:false,options:[],reason:'Sin permiso individual'
  },'account',403);
  const all=(await req('/labor-fields/definitions?target=FICHA')).definitions;
  assert.equal(all.length,1);
  const workerPath='/labor-fields/workers/'+worker.insertId+'?target=FICHA';
  assert.equal((await req(workerPath)).fields[0].value,null);
  // Borrador: permitir guardar null, pero continuar bloqueando ficha validada sin valor.
  await req('/labor-fields/workers/'+worker.insertId,'PUT',{target:'FICHA',values:[{fieldId:id,value:null,revision:0}]});
  assert.equal((await req(workerPath)).fields[0].value,null);
  assert.equal((await req(workerPath)).fields[0].valueRevision,1);
  await req('/labor-fields/workers/'+worker.insertId,'PUT',{target:'FICHA',values:[{fieldId:id,value:'ENTREGADO',revision:1}]});
  const read=(await req(workerPath)).fields[0];
  assert.equal(read.value,'ENTREGADO');assert.equal(read.valueRevision,2);
  await req('/labor-fields/workers/'+worker.insertId,'PUT',{target:'FICHA',values:[{fieldId:id,value:'PENDIENTE',revision:0}]},'root',409);
  await req('/labor-fields/definitions/'+id,'PUT',{
   label:'Equipo actualizado',required:true,active:true,options:['PENDIENTE','REEMPLAZADO'],revision:1,reason:'Eliminar una opción utilizada'
  },'root',409);
  await req('/labor-fields/definitions/'+id,'PUT',{
   label:'Equipo actualizado',required:true,active:true,options:['PENDIENTE','ENTREGADO','REEMPLAZADO'],revision:1,reason:'Añadir una opción nueva'
  });
  const catalog=(await req('/admin/access/catalog')).permissions;
  assert.ok(catalog.some(x=>x.key==='custom_field.EXT_EQUIPO.read'));
  await grant('personal.file.read');
  await grant('custom_field.EXT_EQUIPO.read');
  const one=(await req(workerPath,'GET',undefined,'account')).fields;
  assert.equal(one.length,1);assert.equal(one[0].value,'ENTREGADO');assert.equal(one[0].canWrite,false);
  await req('/labor-fields/workers/'+worker.insertId,'PUT',{target:'FICHA',values:[{fieldId:id,value:'REEMPLAZADO',revision:2}]},'account',403);
  await grant('personal.file.write');
  const allowedWrite=await grant('custom_field.EXT_EQUIPO.write');
  await req('/labor-fields/workers/'+worker.insertId,'PUT',{target:'FICHA',values:[{fieldId:id,value:'REEMPLAZADO',revision:2}]},'account');
  assert.equal((await req(workerPath)).fields[0].value,'REEMPLAZADO');
  await req('/admin/access/permissions/'+allowedWrite.id+'/revoke','POST');
  await req('/labor-fields/workers/'+worker.insertId,'PUT',{target:'FICHA',values:[{fieldId:id,value:'PENDIENTE',revision:3}]},'account',403);
  const [history]=await pool.execute('SELECT revision FROM employee_config_field_history WHERE field_id=? ORDER BY revision',[id]);
  assert.deepEqual(history.map(x=>x.revision),[1,2,3]);
  const [definitionsHistory]=await pool.execute('SELECT revision FROM labor_config_field_history WHERE field_id=? ORDER BY revision',[id]);
  assert.deepEqual(definitionsHistory.map(x=>x.revision),[1,2]);
  assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
 }finally{delete process.env.SAGVA_ROOT_USER_ID;}
});
