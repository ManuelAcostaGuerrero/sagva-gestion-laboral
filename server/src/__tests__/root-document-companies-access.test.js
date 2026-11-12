import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='root-menu-access-synthetic-test';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {bootstrapRoot}=await import('../securityPermissions.js');
const {signAdmin}=await import('../auth.js');

test('Root con JWT legado puede ver Empresas, Documentos y registrar sus tipos sin abrir permisos a otros perfiles',async()=>{
  await runMigrations();
  const [root]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('root-menu-test','hash','Root ficticio','admin')");
  const [supervisor]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('supervisor-menu-test','hash','Supervisor ficticio','supervisor')");
  const [accounting]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('account-menu-test','hash','Contabilidad ficticia','admin')");
  process.env.SAGVA_ROOT_USER_ID=String(root.insertId);
  assert.equal(await bootstrapRoot(pool),true);
  delete process.env.SAGVA_ROOT_USER_ID;
  // Reproduce el problema de un rol legado desfasado frente al perfil Root persistido.
  await pool.execute("UPDATE admins SET role='supervisor' WHERE id=?",[root.insertId]);
  await pool.execute("INSERT INTO security_user_profiles(user_id,profile) VALUES(?,'accounting')",[accounting.insertId]);
  const tokens={
    root:signAdmin({id:root.insertId,username:'root-menu-test',role:'operator'}),
    supervisor:signAdmin({id:supervisor.insertId,username:'supervisor-menu-test',role:'admin'}),
    accounting:signAdmin({id:accounting.insertId,username:'account-menu-test',role:'admin'})
  };
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/api';
  const call=async(path,as='root',method='GET',body,expected=200)=>{
    const response=await fetch(base+path,{method,headers:{
      Authorization:'Bearer '+tokens[as],'Content-Type':'application/json'
    },body:body===undefined?undefined:JSON.stringify(body)});
    const data=await response.json();
    assert.equal(response.status,expected,method+' '+path+' ('+as+'): '+JSON.stringify(data));
    return data;
  };
  try {
    const me=await call('/auth/me');
    assert.equal(me.admin.accessProfile,'root');
    assert.equal(me.admin.role,'supervisor');
    assert.equal((await call('/admin/access/self')).profile,'root');
    assert.equal((await call('/document-catalog')).types.length>=1,true);
    const created=await call('/document-catalog','root','POST',{
      name:'REGLAMENTO INTERNO DE PRUEBA',expiryMode:'EVENT',applicability:'ALL'
    },201);
    assert.ok(created.id>0);
    const legacy=await call('/employee-documents/types','root','POST',{
      name:'ANEXO SINTÉTICO',expiryMode:'NONE'
    },201);
    assert.ok(legacy.id>0);
    const company=await call('/companies','root','POST',{legalName:'EMPRESA FICTICIA ROOT',address:'DIRECCIÓN DE PRUEBA'},201);
    assert.ok(company.id>0);
    const companies=await call('/companies');
    const record=companies.companies.find(c=>c.id===company.id);
    assert.equal(record.address,'DIRECCIÓN DE PRUEBA','Root accede a campos completos, no solo resumen');
    assert.equal((await call('/document-catalog','supervisor','GET',undefined,403)).message.length>0,true);
    await call('/document-catalog','accounting','GET',undefined,403);
    await call('/companies','supervisor','POST',{legalName:'NO DEBE CREARSE'},403);
    await call('/companies','accounting','GET',undefined,403);
    await call('/employee-documents/types','supervisor','POST',{name:'DENEGADO',expiryMode:'NONE'},403);
    const limited=await call('/companies','supervisor');
    assert.equal(Object.hasOwn(limited.companies.find(c=>c.id===company.id),'address'),false);
    const [history]=await pool.execute("SELECT COUNT(*) AS n FROM audit_logs WHERE entity_type='employee_document_type' AND action='create'");
    assert.ok(history[0].n>=2);
  }finally{
    await new Promise(resolve=>server.close(resolve));
    await pool.end();
    delete process.env.SAGVA_ROOT_USER_ID;
  }
});

test('El menú usa el perfil Root vigente de /auth/me, sin confiar solamente en JWT legado',()=>{
  const main=readFileSync(new URL('../../../client/src/main.jsx',import.meta.url),'utf8');
  assert.match(main,/api\('\/auth\/me'\)/);
  assert.match(main,/setLaborStructureRoot\(result\.admin\?\.accessProfile==='root'\)/);
  assert.match(main,/const adminRole = laborStructureRoot \? 'admin' : sessionRole;/);
  assert.match(main,/const canManageDocumentCatalog = adminRole === 'admin';/);
  assert.match(main,/adminModule === 'companies' && canManageDocumentCatalog/);
  assert.match(main,/adminModule === 'documents' && canManageDocumentCatalog/);
});
