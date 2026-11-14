import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';
process.env.SQLITE_PATH=':memory:';process.env.SAGVA_QR_DATA_KEY='0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';process.env.JWT_SECRET='token-tests-not-real';
const {app}=await import('../app.js');const {pool}=await import('../db.js');const {runMigrations}=await import('../migrations.js');const {signAdmin}=await import('../auth.js');const {terminalActivationQrPayload,parseTerminalActivationQr}=await import('../terminalActivationQr.js');
test('QR/PIN: terminal obligatoria, activación única, credenciales hash, rotación/revocación, auditoría e idempotencia',async()=>{
  await runMigrations();const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name) VALUES('token-test','hash','Prueba')");
  const [employee]=await pool.execute("INSERT INTO employees(full_name,document_id) VALUES('Prueba Uno',NULL)");
  const [company]=await pool.execute("INSERT INTO company_profiles(legal_name) VALUES('EMPRESA PRUEBA')");
  await pool.execute('INSERT INTO employee_files(employee_id,company_id) VALUES(?,?)',[employee.insertId,company.insertId]);
  const [operatorUser]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('token-operator','hash','Operador sintético','operator')");
  const jwt=signAdmin({id:admin.insertId,username:'token-test',role:'admin'});const operator=signAdmin({id:operatorUser.insertId,username:'token-operator',role:'operator'});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  let terminal;
  async function req(route,body,auth=jwt){const response=await fetch(`http://127.0.0.1:${server.address().port}/api/tokens${route}`,{method:body===undefined?'GET':route.endsWith('/pin')?'PUT':'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${auth}`} :{}),...(terminal?{'X-Terminal-Token':terminal}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json()};}
  try{
    assert.equal((await req('/terminals',{name:'No permitido'},operator)).status,403);
    const activated=await req('/terminals',{name:'Terminal de prueba',companyId:company.insertId});assert.equal(activated.status,201);
    assert.match(activated.data.activationCode,/^[A-Za-z0-9_-]{43}$/);
    assert.ok(activated.data.activationQrDataUrl.startsWith('data:image/png;base64,'));
    assert.equal(parseTerminalActivationQr(terminalActivationQrPayload(activated.data.activationCode)),activated.data.activationCode);
    assert.equal(parseTerminalActivationQr('asistencia:at_'+activated.data.activationCode),null);
    assert.equal(parseTerminalActivationQr('sagva-terminal:not-valid'),null);
    const [storedActivation]=await pool.execute('SELECT activation_hash AS activationHash FROM attendance_terminals WHERE id=?',[activated.data.id]);
    assert.equal(storedActivation[0].activationHash,crypto.createHash('sha256').update(activated.data.activationCode).digest('hex'));
    assert.equal(storedActivation[0].activationHash.includes(activated.data.activationCode),false);

    assert.equal((await req('/mark',{token:'at_invalid',type:'entrada',requestId:crypto.randomUUID()},null)).status,401);
    const activation=await req('/activate',{activationCode:activated.data.activationCode},null);assert.equal(activation.status,200);terminal=activation.data.terminalToken;
    assert.equal((await req('/activate',{activationCode:activated.data.activationCode},null)).status,401);
    assert.equal((await req('/activate',{activationCode:'sagva-terminal:'+activated.data.activationCode},null)).status,401,
      'El servidor solo acepta el código, no el contenido QR sin validar');

    const issued=await req(`/workers/${employee.insertId}/issue`,{});assert.equal(issued.status,201);assert.ok(issued.data.qrDataUrl.startsWith('data:image/png;base64,'));
    const stored=(await pool.execute('SELECT token_hash FROM worker_tokens'))[0][0].token_hash;assert.notEqual(stored,issued.data.token);assert.equal(stored.length,64);
    const body={token:'asistencia:'+issued.data.token,type:'entrada',requestId:crypto.randomUUID()};
    const mark=await req('/mark',body,null);assert.equal(mark.status,201);assert.equal(mark.data.record.method,'QR');
    assert.equal(mark.data.record.receipt.receipt.recordId,mark.data.record.id);
    assert.match(mark.data.record.receipt.checksum,/^[a-f0-9]{64}$/);
    assert.equal(mark.data.record.receipt.deliveryStatus,'EMAIL_MISSING');
    const repeated=await Promise.all([req('/mark',body,null),req('/mark',body,null)]);assert.ok(repeated.every(r=>r.status===200&&r.data.record.id===mark.data.record.id));
    assert.ok(repeated.every(r=>r.data.record.receipt.checksum===mark.data.record.receipt.checksum));
    assert.equal((await pool.execute('SELECT COUNT(*) n FROM attendance_records'))[0][0].n,1);
    const replacement=await req(`/workers/${employee.insertId}/issue`,{});assert.equal(replacement.status,201);
    assert.equal((await req('/mark',{...body,requestId:crypto.randomUUID()},null)).status,401);
    assert.equal((await req('/mark',{...body,token:replacement.data.token,requestId:crypto.randomUUID()},null)).status,201);
    const pin=await req(`/workers/${employee.insertId}/pin`,{enabled:true,pin:'4321'});assert.equal(pin.status,200);
    const pinMark=await req('/mark',{employeeId:employee.insertId,pin:'4321',type:'salida',requestId:crypto.randomUUID()},null);assert.equal(pinMark.status,201);assert.equal(pinMark.data.record.method,'PIN');
    for(let i=0;i<5;i++)assert.equal((await req('/mark',{employeeId:employee.insertId,pin:'9999',type:'entrada',requestId:crypto.randomUUID()},null)).status,401);
    assert.equal((await req('/mark',{employeeId:employee.insertId,pin:'4321',type:'entrada',requestId:crypto.randomUUID()},null)).status,429);
    assert.equal((await pool.execute("SELECT COUNT(*) n FROM audit_logs WHERE action='failed_worker_pin'"))[0][0].n,5);
    await req(`/workers/${employee.insertId}/revoke`,{});assert.equal((await req('/mark',{...body,token:replacement.data.token,requestId:crypto.randomUUID()},null)).status,401);
    const details=(await pool.execute('SELECT details FROM audit_logs')).flatMap(r=>r).map(r=>r.details).join('');assert.ok(!details.includes(issued.data.token));assert.ok(!details.includes('4321'));
    await req(`/terminals/${activated.data.id}/revoke`,{});assert.equal((await req('/terminal-workers',undefined,null)).status,401);
    assert.equal((await pool.execute('PRAGMA foreign_key_check'))[0].length,0);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
