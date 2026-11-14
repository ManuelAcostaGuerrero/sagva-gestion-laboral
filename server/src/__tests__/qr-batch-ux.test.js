import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SQLITE_PATH=':memory:';
process.env.SAGVA_QR_DATA_KEY='0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';process.env.JWT_SECRET='qr-batch-tests-isolated-and-not-for-production';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');

test('Buscar trabajadores a demanda, emitir lote sin revocar QR y limitarlo a admin',async()=>{
  await runMigrations();
  const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name) VALUES('batch-admin','hash','Prueba')");
  const jwt=signAdmin({id:admin.insertId,username:'batch-admin',role:'admin'});
  const [supervisorUser]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('batch-supervisor','hash','Supervisor sintético','supervisor')");
  const supervisor=signAdmin({id:supervisorUser.insertId,username:'batch-supervisor',role:'supervisor'});
  const [first]=await pool.execute("INSERT INTO employees(full_name,document_id) VALUES('Ana Ejemplo','TEST-1001')");
  const [second]=await pool.execute("INSERT INTO employees(full_name,document_id) VALUES('Bernardo Ejemplo','TEST-1002')");
  const [third]=await pool.execute("INSERT INTO employees(full_name,document_id) VALUES('Carla Ejemplo','TEST-1003')");
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  async function send(route,method='GET',body,auth=jwt){
    const response=await fetch(origin+route,{method,headers:{
      'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})
    },body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  }
  try{
    const empty=await send('/api/tokens/workers');
    assert.equal(empty.status,200);assert.deepEqual(empty.data.workers,[]);
    const search=await send('/api/tokens/workers?q=ejem');
    assert.equal(search.status,200);assert.equal(search.data.workers.length,3);
    const idSearch=await send('/api/tokens/workers?q=1002');
    assert.equal(idSearch.data.workers.length,1);
    assert.equal(idSearch.data.workers[0].id,second.insertId);
    assert.equal((await send('/api/employees?includeInactive=1&onlySearch=1')).data.employees.length,0);
    const filtered=await send('/api/employees?includeInactive=1&onlySearch=1&q=1001');
    assert.equal(filtered.data.employees.length,1);
    const select=[first.insertId,second.insertId];
    const request={employeeIds:select};
    assert.equal((await send('/api/tokens/workers/batch-issue','POST',request,supervisor)).status,403);
    const issued=await send('/api/tokens/workers/batch-issue','POST',request);
    assert.equal(issued.status,201);
    assert.deepEqual(issued.data.cards.map(c=>c.employeeId),select);
    assert.ok(issued.data.cards.every(c=>c.qrDataUrl.startsWith('data:image/png;base64,')));
    const [existing]=await pool.execute('SELECT token_hash FROM worker_tokens WHERE employee_id=? AND revoked_at IS NULL',[first.insertId]);
    assert.equal(existing.length,1);
    const before=(await pool.execute('SELECT COUNT(*) n FROM worker_tokens'))[0][0].n;
    const refused=await send('/api/tokens/workers/batch-issue','POST',{
      employeeIds:[first.insertId,third.insertId]
    });
    assert.equal(refused.status,409);
    const after=(await pool.execute('SELECT COUNT(*) n FROM worker_tokens'))[0][0].n;
    assert.equal(after,before,'no se creó ni revocó QR al fallar un lote');
    const [stillValid]=await pool.execute('SELECT token_hash FROM worker_tokens WHERE employee_id=? AND revoked_at IS NULL',[first.insertId]);
    assert.equal(stillValid[0].token_hash,existing[0].token_hash);
    assert.equal((await send('/api/tokens/workers/batch-issue','POST',{employeeIds:[third.insertId,third.insertId]})).status,400);
    assert.equal((await send('/api/tokens/workers/batch-issue','POST',{employeeIds:Array.from({length:21},(_,i)=>i+1)})).status,400);
    assert.equal((await send('/api/tokens/workers/batch-issue','POST',{employeeIds:[third.insertId]})).status,201);
    assert.equal((await pool.execute('PRAGMA foreign_key_check'))[0].length,0);
  }finally{
    await new Promise(resolve=>server.close(resolve));
    await pool.end();
  }
});
