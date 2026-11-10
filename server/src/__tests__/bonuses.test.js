import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='test-bonos-bl013-clave-sintetica';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');

test('BL-013: registrar múltiples bonos sin cálculos, conservar historial y restringir catálogo',async t=>{
 await runMigrations();await runMigrations();
 const [defaults]=await pool.execute('SELECT code,kind FROM labor_bonus_types');
 assert.equal(defaults.length,4);
 assert.equal(defaults.find(x=>x.code==='PERDIDA_CAJA').kind,'ASIGNACION_PERDIDA_CAJA');
 assert.equal((await pool.execute("SELECT id FROM schema_migrations WHERE id='20261110_024_bonus_types'"))[0].length,1);
 const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('bonos-admin','test','Administrador','admin')");
 const [operator]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('bonos-oper','test','Operador','operator')");
 const [worker]=await pool.execute("INSERT INTO employees(full_name,document_id) VALUES('Trabajador sintético','11.111.111-1')");
 const tokens={
  admin:signAdmin({id:admin.insertId,username:'bonos-admin',role:'admin'}),
  operator:signAdmin({id:operator.insertId,username:'bonos-oper',role:'operator'})
 };
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>server.close());
 const url='http://127.0.0.1:'+server.address().port+'/api';
 async function req(path,method='GET',body,role='admin'){
  const response=await fetch(url+path,{method,headers:{Authorization:'Bearer '+tokens[role],'Content-Type':'application/json'},
   body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,data:await response.json()};
 }
 try{
  const types=(await req('/labor-benefits/bonus-types')).data;
  assert.equal(types.types.length,4);
  assert.equal(types.canManage,false);
  const newType={code:'ESPECIAL',name:'Bono especial',kind:'BONO_REMUNERACIONAL',reason:'Concepto sintético para ensayo'};
  assert.equal((await req('/labor-benefits/bonus-types','POST',newType)).status,403);
  process.env.SAGVA_CONFIGURATION_USER_IDS=String(admin.insertId);
  const created=await req('/labor-benefits/bonus-types','POST',newType);
  assert.equal(created.status,201);
  assert.equal((await req('/labor-benefits/bonus-types','POST',newType)).status,409);
  assert.equal((await req('/labor-benefits/bonus-types','POST',newType,'operator')).status,403);
  const route='/contract-terms/workers/'+worker.insertId;
  assert.equal((await req(route,'GET',undefined,'operator')).status,403);
  const initial=(await req(route)).data.terms;
  assert.deepEqual(initial.bonuses,[]);
  const b1={uid:'b8702739-bb01-4cb6-9634-6f11db57d644',typeId:created.data.id,amountClp:50000,
   periodicity:'MENSUAL',hasClauses:true,active:true,validFrom:'2026-11-10'};
  const b2={uid:'e354e7d9-baf7-4fb2-b468-af98ece1094a',typeId:types.types.find(x=>x.code==='PERDIDA_CAJA').id,amountClp:10000,
   periodicity:'MENSUAL',hasClauses:false,active:true,validFrom:''};
  const saved=await req(route,'PUT',{...initial,bonuses:[b1,b2]});
  assert.equal(saved.status,200,JSON.stringify(saved.data));
  assert.equal(saved.data.terms.bonuses.length,2);
  assert.equal(saved.data.terms.bonuses[0].hasClauses,true);
  assert.equal((await req(route,'PUT',{...saved.data.terms,bonuses:[b1]})).status,400);
  assert.equal((await req(route,'PUT',{...saved.data.terms,bonuses:[{...b1,amountClp:0},b2]})).status,400);
  assert.equal((await req(route,'PUT',{...saved.data.terms,bonuses:[{...b1,validFrom:'2026-99-91'},b2]})).status,400);
  const inactive=await req(route,'PUT',{...saved.data.terms,bonuses:[{...b1,active:false},b2]});
  assert.equal(inactive.status,200);
  const legacy={...inactive.data.terms};delete legacy.bonuses;
  const compatible=await req(route,'PUT',{...legacy,workplace:'SUCURSAL PRUEBA'});
  assert.equal(compatible.status,200);
  assert.equal(compatible.data.terms.bonuses.length,2);
  assert.equal(compatible.data.terms.bonuses[0].active,false);
  const [history]=await pool.execute('SELECT snapshot_json AS value FROM employee_contract_terms_history WHERE employee_id=? ORDER BY revision',[worker.insertId]);
  assert.equal(history.length,3);
  assert.equal(JSON.parse(history[0].value).bonuses[0].active,true);
  assert.equal(JSON.parse(history[2].value).bonuses[0].active,false);
  const [pays]=await pool.execute("SELECT name FROM sqlite_master WHERE name='employee_bonus_payment'");
  assert.equal(pays.length,0);
  assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
 }finally{
  delete process.env.SAGVA_CONFIGURATION_USER_IDS;
 }
});
