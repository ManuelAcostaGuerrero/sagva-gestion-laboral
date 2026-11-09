import test from 'node:test';
import assert from 'node:assert/strict';
import {laborValuesAt,laborScaled} from '../../../shared/laborAccounting.js';

process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='contabilidad-laboral-test-no-real';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');

test('Previsiones: valores a fecha y normalización de porcentajes',()=>{
 assert.equal(laborScaled(1.44,'PERCENT'),144);
 assert.equal(laborScaled(135.2,'UF'),13520);
 assert.throws(()=>laborScaled(1.234,'PERCENT'),/dos decimales/);
 const records=[
  {id:1,metric:'SALUD_LEGAL',entityId:null,effectiveFrom:'2026-01-01',valueHundredths:700},
  {id:2,metric:'SALUD_LEGAL',entityId:null,effectiveFrom:'2027-01-01',valueHundredths:750},
  {id:3,metric:'SALUD_LEGAL',entityId:null,effectiveFrom:'2027-01-01',valueHundredths:760}
 ];
 assert.equal(laborValuesAt(records,'2026-11-09')['SALUD_LEGAL:GLOBAL'].valueHundredths,700);
 assert.equal(laborValuesAt(records,'2027-02-01')['SALUD_LEGAL:GLOBAL'].valueHundredths,760);
});

test('Contabilidad Laboral: precarga, roles, nuevas vigencias e instituciones sin borrar historial',async()=>{
 await runMigrations();await runMigrations();
 const [owner]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('labor-admin','hash','Administrador','admin')");
 const [operator]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('labor-operator','hash','Operador','operator')");
 const [supervisor]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('labor-super','hash','Supervisor','supervisor')");
 const tokens={
  admin:signAdmin({id:owner.insertId,username:'labor-admin',role:'admin'}),
  operator:signAdmin({id:operator.insertId,username:'labor-operator',role:'operator'}),
  supervisor:signAdmin({id:supervisor.insertId,username:'labor-super',role:'supervisor'})
 };
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port+'/api/labor-accounting';
 async function call(url,method='GET',body,expected=200,role='admin'){
  const response=await fetch(base+url,{method,
   headers:{Authorization:'Bearer '+tokens[role],'Content-Type':'application/json'},
   body:body===undefined?undefined:JSON.stringify(body)});
  const json=await response.json();
  assert.equal(response.status,expected,method+' '+url+': '+JSON.stringify(json));
  return json;
 }
 try{
  const [seed]=await pool.execute("SELECT id FROM schema_migrations WHERE id='20261109_022_labor_accounting'");
  assert.equal(seed.length,1);
  const catalog=await call('/catalog','GET',undefined,200,'operator');
  assert.equal(catalog.entities.filter(e=>e.kind==='AFP').length,7);
  assert.equal(catalog.entities.filter(e=>e.kind==='ISAPRE').length,10);
  assert.equal(catalog.entities.filter(e=>e.kind==='FONASA').length,1);
  const afp=catalog.entities.find(e=>e.code==='MODELO');
  assert.ok(afp);
  let snapshot=await call('/?on=2026-11-09');
  assert.equal(snapshot.current['AFP_COMISION:'+afp.id].valueHundredths,58);
  assert.equal(snapshot.current['AFP_OBLIGATORIA:GLOBAL'].valueHundredths,1000);
  assert.equal(snapshot.current['SALUD_LEGAL:GLOBAL'].valueHundredths,700);
  assert.equal(snapshot.current['TOPE_PREVISION_UF:GLOBAL'].valueHundredths,9000);
  assert.equal(snapshot.current['TOPE_CESANTIA_UF:GLOBAL'].valueHundredths,13520);
  assert.equal(snapshot.current['EMPLEADOR_TOTAL:GLOBAL'].valueHundredths,350);
  assert.equal(snapshot.current['EMPLEADOR_CRP:GLOBAL'].valueHundredths,90);
  await call('/','GET',undefined,403,'operator');
  await call('/parameters','POST',{metric:'SALUD_LEGAL',entityId:null,value:8,
   effectiveFrom:'2027-01-01',reason:'Ajuste solo de prueba'},403,'operator');
  await call('/parameters','POST',{metric:'SALUD_LEGAL',entityId:null,value:8,
   effectiveFrom:'2027-01-01',reason:'Ajuste solo de prueba'},403,'supervisor');
  const update={metric:'SALUD_LEGAL',entityId:null,value:8,effectiveFrom:'2027-01-01',
    reason:'Cambio de prueba con control de versiones',sourceUrl:'https://www.superdesalud.gob.cl/'};
  const first=await call('/parameters','POST',update,201);
  assert.ok(first.id);
  await call('/parameters','POST',{...update,value:8.5,reason:'Corrección documentada de tasa de prueba'},201);
  snapshot=await call('/?on=2027-02-01');
  assert.equal(snapshot.current['SALUD_LEGAL:GLOBAL'].valueHundredths,850);
  assert.equal(snapshot.versions.filter(x=>x.metric==='SALUD_LEGAL').length,3);
  snapshot=await call('/?on=2026-11-09');
  assert.equal(snapshot.current['SALUD_LEGAL:GLOBAL'].valueHundredths,700);
  await call('/parameters','POST',{...update,metric:'AFP_COMISION',entityId:null},400);
  await call('/parameters','POST',{...update,metric:'AFP_COMISION',entityId:catalog.entities.find(x=>x.code==='FONASA').id},400);
  await call('/parameters','POST',{...update,value:101},400);
  await call('/parameters','POST',{...update,effectiveFrom:'2027-02-30'},400);
  const created=await call('/entities','POST',{kind:'ISAPRE',code:'ENSAYO_PREVISION',name:'Isapre Prueba',reason:'Alta de prueba con auditoría'},201);
  const entity=snapshot.entities.find(e=>e.id===created.id);
  assert.equal(entity,undefined);
  let details=await call('/');
  assert.ok(details.entities.some(e=>e.id===created.id));
  const revised=details.entities.find(e=>e.id===created.id);
  await call('/entities/'+created.id,'PUT',{name:'Isapre Prueba Corregida',
    active:false,revision:revised.revision,reason:'Desactivar institución de prueba'},200);
  details=await call('/');
  assert.equal(details.entities.find(e=>e.id===created.id).active,false);
  assert.equal(details.entityHistory.filter(e=>e.entityId===created.id).length,2);
  const fonasa=details.entities.find(e=>e.kind==='FONASA');
  await call('/entities/'+fonasa.id,'PUT',{name:'FONASA',active:false,
    revision:fonasa.revision,reason:'No debe desactivarse la institución base'},400);
  assert.ok((await call('/catalog','GET',undefined,200,'operator')).entities.every(e=>e.code!=='ENSAYO_PREVISION'));
  const [audit]=await pool.execute("SELECT action,entity_type AS entityType FROM audit_logs WHERE entity_type LIKE 'labor_%'");
  assert.ok(audit.some(x=>x.entityType==='labor_parameter_version'));
  assert.ok(audit.some(x=>x.entityType==='labor_entity'));
  assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
 }finally{await new Promise(resolve=>server.close(resolve));await pool.end();}
});
