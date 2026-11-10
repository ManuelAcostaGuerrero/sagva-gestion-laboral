import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';
process.env.SQLITE_PATH=':memory:';process.env.JWT_SECRET='terminal-company-tests';
const {app}=await import('../app.js');const {pool}=await import('../db.js');const {runMigrations}=await import('../migrations.js');const {signAdmin}=await import('../auth.js');
test('Terminal-empresa-trabajador: QR/PIN aislados, vista previa sin escrituras, cámara autorizada e idempotencia',async()=>{
 await runMigrations();await runMigrations();
 const [owner]=await pool.execute("INSERT INTO admins(username,password_hash,full_name) VALUES('terminal-company','hash','Prueba')");
 const jwt=signAdmin({id:owner.insertId,username:'terminal-company',role:'admin'});
 const [a]=await pool.execute("INSERT INTO company_profiles(legal_name) VALUES('EMPRESA A')");const [b]=await pool.execute("INSERT INTO company_profiles(legal_name) VALUES('EMPRESA B')");
 const workers=[];
 for(const companyId of [a.insertId,b.insertId]){const [worker]=await pool.execute("INSERT INTO employees(full_name) VALUES('PERSONA DE PRUEBA')");await pool.execute('INSERT INTO employee_files(employee_id,company_id) VALUES(?,?)',[worker.insertId,companyId]);workers.push(worker.insertId);}
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));let terminal;
 async function req(path,body,expected=200,auth=jwt){const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/tokens'+path,{method:body===undefined?'GET':path.endsWith('/pin')?'PUT':'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{}),...(terminal?{'X-Terminal-Token':terminal}:{})},body:body===undefined?undefined:JSON.stringify(body)});const result=await response.json();assert.equal(response.status,expected,JSON.stringify(result));return result;}
 try{
  await req('/terminals',{name:'Sin empresa'},400);
  const legacy='terminal_'+crypto.randomBytes(32).toString('base64url');
  await pool.execute("INSERT INTO attendance_terminals(name,token_hash) VALUES('Terminal histórica',?)",[crypto.createHash('sha256').update(legacy).digest('hex')]);
  terminal=legacy;await req('/terminal-workers',undefined,403);terminal=null;
  const device=await req('/terminals',{name:'Celular A',companyId:a.insertId},201);
  const [supervisorUser]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('terminal-supervisor','hash','Supervisor sintético','supervisor')");
  const supervisor=signAdmin({id:supervisorUser.insertId,username:'terminal-supervisor',role:'supervisor'});
  await req('/terminals/'+device.id+'/revoke',{},403,supervisor);
  const stillActive=(await pool.execute('SELECT is_active AS active FROM attendance_terminals WHERE id=?',[device.id]))[0][0];
  assert.equal(stillActive.active,1,'solo un admin puede revocar terminales');
  terminal=(await req('/activate',{activationCode:device.activationCode})).terminalToken;
  const qrA=await req('/workers/'+workers[0]+'/issue',{},201),qrB=await req('/workers/'+workers[1]+'/issue',{},201);
  for(const id of workers)await req('/workers/'+id+'/pin',{enabled:true,pin:'4321'});
  const listed=await req('/terminal-workers');assert.deepEqual(listed.workers.map(w=>w.id),[workers[0]]);
  const counts=async()=>({attendance:(await pool.execute('SELECT COUNT(*) n FROM attendance_records'))[0][0].n,audit:(await pool.execute('SELECT COUNT(*) n FROM audit_logs'))[0][0].n});
  const before=await counts();
  const identified=await req('/identify',{token:'asistencia:'+qrA.token});assert.equal(identified.employee.id,workers[0]);assert.equal(identified.cameraMarkEnabled,false);
  await req('/identify',{token:qrB.token},401);
  await req('/mark',{token:qrB.token,type:'entrada',requestId:crypto.randomUUID()},401);
  await req('/mark',{employeeId:workers[1],pin:'4321',type:'entrada',requestId:crypto.randomUUID()},401);
  await req('/mark',{source:'CAMERA',token:qrA.token,type:'entrada',requestId:crypto.randomUUID()},403);
  assert.deepEqual(await counts(),before);
  await req('/terminals/'+device.id+'/config',{companyId:a.insertId,cameraMarkEnabled:true});
  const mark={source:'CAMERA',token:qrA.token,type:'entrada',requestId:crypto.randomUUID()};const registered=await req('/mark',mark,201);assert.equal(registered.employee.id,workers[0]);
  const repeated=await req('/mark',mark);assert.equal(repeated.record.id,registered.record.id);assert.equal((await counts()).attendance,before.attendance+1);
  const changed=await req('/terminals/'+device.id+'/config',{companyId:b.insertId,cameraMarkEnabled:false});assert.ok(changed.activationCode);
  await req('/identify',{token:qrA.token},401);
  terminal=(await req('/activate',{activationCode:changed.activationCode})).terminalToken;
  await req('/identify',{token:qrA.token},401);await req('/identify',{token:qrB.token});
  await pool.execute('UPDATE company_profiles SET is_active=0 WHERE id=?',[b.insertId]);await req('/identify',{token:qrB.token},401);
  const attendanceCount=(await pool.execute('SELECT COUNT(*) n FROM attendance_records'))[0][0].n;
  await req('/terminals/'+device.id+'/revoke',{},200,jwt);
  const revoked=(await pool.execute('SELECT is_active AS active,token_hash AS tokenHash FROM attendance_terminals WHERE id=?',[device.id]))[0][0];
  assert.equal(revoked.active,0);
  assert.equal(revoked.tokenHash,null,'revocar desde administración invalida el token del celular');
  await req('/terminal-workers',undefined,401,null);
  assert.equal((await pool.execute('SELECT COUNT(*) n FROM attendance_records'))[0][0].n,attendanceCount,
    'la desvinculación no modifica registros históricos');
  assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
 }finally{await new Promise(resolve=>server.close(resolve));await pool.end();}
});
