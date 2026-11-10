
import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='labor-benefits-only-isolated-synthetic-test';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');
const {decryptBank,encryptBank}=await import('../benefitSecurity.js');

test('BL-003/004/005: bancos CMF, bandas SUSESO, cargas auditables y cuenta cifrada con acceso explícito',async t=>{
  await runMigrations();await runMigrations();
  const [banks]=await pool.execute('SELECT id,code,name FROM labor_banks ORDER BY code');
  assert.equal(banks.length,18);
  assert.ok(banks.some(x=>x.code==='012'));
  const [ranges]=await pool.execute("SELECT tier,income_from AS fromIncome,income_to AS toIncome,amount_clp AS amount FROM labor_family_bracket_versions WHERE group_code='SUSESO_2026_07' ORDER BY tier");
  assert.deepEqual(ranges.map(x=>x.amount),[22601,13870,4382,0]);
  const [migrated]=await pool.execute("SELECT COUNT(*) AS n FROM schema_migrations WHERE id='20261109_023_labor_benefits'");
  assert.equal(migrated[0].n,1);
  const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('bl-admin','hash','Administrador','admin')");
  const [supervisor]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('bl-super','hash','Supervisor','supervisor')");
  const [operator]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('bl-oper','hash','Operador','operator')");
  const [worker]=await pool.execute("INSERT INTO employees(full_name,document_id) VALUES('Persona Ejemplo','12.345.678-5')");
  const keys={
    admin:signAdmin({id:admin.insertId,username:'bl-admin',role:'admin'}),
    supervisor:signAdmin({id:supervisor.insertId,username:'bl-super',role:'supervisor'}),
    operator:signAdmin({id:operator.insertId,username:'bl-oper',role:'operator'})
  };
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>server.close());
  const prefix='http://127.0.0.1:'+server.address().port+'/api';
  async function call(route,method='GET',body,role='admin'){
    const response=await fetch(prefix+route,{method,headers:{Authorization:'Bearer '+keys[role],'Content-Type':'application/json'},
      body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  }
  try{
    assert.equal((await call('/labor-benefits/banks')).data.banks.length,18);
    assert.equal((await call('/labor-benefits/family-brackets?on=2026-11-09')).data.current.length,4);
    assert.equal((await call('/labor-benefits/banks','POST',{code:'TEST_BANK',name:'Banco Prueba',reason:'Creación sintética de control'})).status,403);
    process.env.SAGVA_CONFIGURATION_USER_IDS=String(admin.insertId);
    const create=await call('/labor-benefits/banks','POST',{code:'TEST_BANK',name:'Banco Prueba',reason:'Creación sintética de control'});
    assert.equal(create.status,201);
    const bankId=create.data.id;
    assert.equal((await call('/labor-benefits/banks','POST',{code:'TEST_BANK',name:'Duplicado',reason:'Debe rechazarse la duplicidad'})).status,409);
    const listing=(await call('/labor-benefits/banks')).data.banks.find(x=>x.id===bankId);
    assert.equal((await call('/labor-benefits/banks/'+bankId,'PUT',{name:'Banco Prueba Corregido',active:false,revision:listing.revision,reason:'Cambio sintético de nombre'})).status,200);
    const after=(await call('/labor-benefits/banks')).data.banks.find(x=>x.id===bankId);
    assert.equal(after.active,false);
    assert.equal((await call('/labor-benefits/banks/'+bankId,'PUT',{name:'Otra',active:true,revision:listing.revision,reason:'Revisión obsoleta'})).status,409);
    assert.equal((await call('/labor-benefits/banks','POST',{code:'TEST2',name:'Banco Dos',reason:'No autorizado'},'operator')).status,403);
    const version={
      effectiveFrom:'2027-02-01',incomeReference:'enero a junio 2026',reason:'Actualización de prueba versionada',
      sourceUrl:'https://www.suseso.gob.cl/606/w3-article-498133.html',
      tiers:[{tier:1,incomeFrom:0,incomeTo:100,amountClp:10},{tier:2,incomeFrom:101,incomeTo:200,amountClp:8},
        {tier:3,incomeFrom:201,incomeTo:300,amountClp:4},{tier:4,incomeFrom:301,incomeTo:null,amountClp:0}]
    };
    assert.equal((await call('/labor-benefits/family-brackets','POST',version)).status,201);
    assert.equal((await call('/labor-benefits/family-brackets?on=2026-11-09')).data.current[0].amountClp,22601);
    assert.equal((await call('/labor-benefits/family-brackets?on=2027-02-02')).data.current[0].amountClp,10);
    assert.equal((await call('/labor-benefits/family-brackets','POST',{...version,tiers:[...version.tiers.slice(0,2),{...version.tiers[2],incomeFrom:202},version.tiers[3]]})).status,400);
    const w=worker.insertId;
    assert.equal((await call('/employee-benefits/'+w+'/family','GET',undefined,'operator')).status,403);
    const initial=await call('/employee-benefits/'+w+'/family');
    assert.equal(initial.data.status,'NONE');assert.equal(initial.data.revision,0);
    const member={fullName:'Carga Ejemplo',relationship:'HIJO',recognitionStatus:'PENDING',institution:'',recognitionDate:'',validFrom:'2026-11-01',validUntil:'',referenceCode:''};
    const pending=await call('/employee-benefits/'+w+'/family','PUT',{revision:0,status:'PENDING',dependents:[member]});
    assert.equal(pending.status,200);
    const state=await call('/employee-benefits/'+w+'/family');
    assert.equal(state.data.dependents.length,1);
    assert.equal((await call('/employee-benefits/'+w+'/family','PUT',{revision:0,status:'PENDING',dependents:[member]})).status,409);
    assert.equal((await call('/employee-benefits/'+w+'/family','PUT',{revision:1,status:'NONE',dependents:[]})).status,400);
    const recognized=await call('/employee-benefits/'+w+'/family','PUT',{revision:1,status:'RECOGNIZED',dependents:[
      {...state.data.dependents[0],recognitionStatus:'RECOGNIZED',institution:'IPS',recognitionDate:'2026-11-01'}
    ]});
    assert.equal(recognized.status,200);
    assert.equal((await call('/employee-benefits/'+w+'/family','GET',undefined,'supervisor')).data.status,'RECOGNIZED');
    const deniedCapability=(await call('/employee-benefits/bank-capability')).data;
    assert.equal(deniedCapability.canAccess,false);
    assert.equal(deniedCapability.reason,'NOT_AUTHORIZED');
    assert.equal((await call('/employee-benefits/'+w+'/bank')).status,403);
    process.env.SAGVA_BANK_ACCESS_USER_IDS=String(admin.insertId);
    process.env.SAGVA_BANK_DATA_KEY='a'.repeat(64);
    assert.equal((await call('/employee-benefits/bank-capability')).data.canAccess,true);
    const account={revision:0,bankId:banks.find(x=>x.code==='012').id,accountType:'VISTA',
      accountNumber:'000123456789',holderName:'Persona Ejemplo',holderRut:'12.345.678-5',
      requestedOn:'2026-11-09',authorizationRef:'Solicitud privada sintética'};
    assert.equal((await call('/employee-benefits/'+w+'/bank','PUT',{...account,holderRut:'11.111.111-1'})).status,400);
    const saved=await call('/employee-benefits/'+w+'/bank','PUT',account);
    assert.equal(saved.status,200);
    const [cipher]=await pool.execute('SELECT payload_ciphertext AS value FROM employee_bank_accounts WHERE employee_id=?',[w]);
    assert.ok(!cipher[0].value.includes('000123456789'));
    assert.equal(decryptBank(cipher[0].value).accountNumber,'000123456789');
    assert.notEqual(encryptBank({x:'testing'}),encryptBank({x:'testing'}));
    const read=await call('/employee-benefits/'+w+'/bank');
    assert.equal(read.data.account.accountNumber,'000123456789');
    assert.equal((await call('/employee-benefits/'+w+'/bank','GET',undefined,'supervisor')).status,403);
    assert.equal((await call('/employee-benefits/'+w+'/bank','PUT',account)).status,409);
    const updatedBank=await call('/employee-benefits/'+w+'/bank','PUT',{...account,revision:1,accountNumber:'000987654321'});
    assert.equal(updatedBank.status,200);
    const [oldBanks]=await pool.execute('SELECT payload_ciphertext AS payload FROM employee_bank_account_history WHERE employee_id=?',[w]);
    assert.equal(oldBanks.length,1);
    assert.equal(decryptBank(oldBanks[0].payload).accountNumber,'000123456789');
    const [familyVersions]=await pool.execute('SELECT snapshot_before_json AS beforeJson,snapshot_after_json AS afterJson FROM employee_family_history WHERE employee_id=? ORDER BY id',[w]);
    assert.equal(familyVersions.length,2);
    assert.equal(JSON.parse(familyVersions[1].beforeJson)[0].recognitionStatus,'PENDING');
    assert.equal(JSON.parse(familyVersions[1].afterJson)[0].recognitionStatus,'RECOGNIZED');
    const [logs]=await pool.execute("SELECT details FROM audit_logs WHERE entity_type IN ('employee_bank_account','employee_family')");
    assert.ok(logs.length>=3);
    assert.ok(!JSON.stringify(logs).includes('000123456789'));
    assert.ok(!JSON.stringify(logs).includes('Carga Ejemplo'));
    const [foreign]=await pool.execute('PRAGMA foreign_key_check');
    assert.deepEqual(foreign,[]);
  }finally{
    delete process.env.SAGVA_CONFIGURATION_USER_IDS;
    delete process.env.SAGVA_BANK_ACCESS_USER_IDS;
    delete process.env.SAGVA_BANK_DATA_KEY;
  }
});
