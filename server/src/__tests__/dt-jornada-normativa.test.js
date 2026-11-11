import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='test-dt-jornada-normativa-vigencia-2026';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');
const {assessWeeklyOrdinaryHours,DT_JORNADA_MIGRATION}=await import('../dtJornadaNormativa.js');

test('DT: parámetros por vigencia sin reescribir contratos, con advertencia no bloqueante',async()=>{
  await runMigrations();await runMigrations();
  const [migrations]=await pool.execute('SELECT COUNT(*) n FROM schema_migrations WHERE id=?',[DT_JORNADA_MIGRATION]);
  assert.equal(migrations[0].n,1,'Migración idempotente');
  const [rules]=await pool.execute('SELECT effective_from AS effectiveDate,value_hours AS hours FROM dt_jornada_normative_versions ORDER BY effective_from');
  assert.deepEqual(rules,[
    {effectiveDate:'2005-01-01',hours:45},
    {effectiveDate:'2024-04-26',hours:44},
    {effectiveDate:'2026-04-26',hours:42},
    {effectiveDate:'2028-04-26',hours:40}
  ]);
  for(const [on,limit] of [
    ['2024-04-25',45],['2024-04-26',44],
    ['2026-04-25',44],['2026-04-26',42],
    ['2028-04-25',42],['2028-04-26',40]
  ]){
    const actual=await assessWeeklyOrdinaryHours(pool,{on,weeklyHours:limit});
    assert.equal(actual.maxWeeklyHours,limit,'Debe respetar la fecha '+on);
    assert.equal(actual.status,'WITHIN_GENERAL_LIMIT');
    assert.equal(actual.warning,null);
  }
  const alert=await assessWeeklyOrdinaryHours(pool,{on:'2026-11-11',weeklyHours:45});
  assert.equal(alert.maxWeeklyHours,42);
  assert.equal(alert.status,'EXCEEDS_GENERAL_LIMIT');
  assert.match(alert.warning,/supera/);
  const exceptional=await assessWeeklyOrdinaryHours(pool,{on:'2026-11-11',weeklyHours:45,regime:'SPECIAL'});
  assert.equal(exceptional.verified,false);
  assert.equal(exceptional.status,'REGIME_NOT_EVALUATED');
  const exempt=await assessWeeklyOrdinaryHours(pool,{on:'2026-11-11',weeklyHours:45,regime:'EXEMPT'});
  assert.equal(exempt.requiresIndividualLegalReview,true);
  for(const on of ['2026-02-30','2026-13-01','ayer','2026-1-1']){
    await assert.rejects(assessWeeklyOrdinaryHours(pool,{on,weeklyHours:42}),/Fecha/);
  }
  await assert.rejects(assessWeeklyOrdinaryHours(pool,{on:'2026-11-11',weeklyHours:-5}),/Horas/);
  await assert.rejects(pool.execute("UPDATE dt_jornada_normative_versions SET value_hours=60 WHERE effective_from='2026-04-26'"));
  await assert.rejects(pool.execute("DELETE FROM dt_jornada_normative_versions WHERE effective_from='2026-04-26'"));

  const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('dt-jornada','hash','Administrador de prueba','admin')");
  const token=signAdmin({id:admin.insertId,username:'dt-jornada',role:'admin'});
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  try{
    const base='http://127.0.0.1:'+server.address().port+'/api/contract-terms/jornada/assessment';
    let response=await fetch(base+'?on=2026-11-11&weeklyHours=45&regime=GENERAL');
    assert.equal(response.status,401,'No exponer consultas del sistema sin autenticación');
    response=await fetch(base+'?on=2026-11-11&weeklyHours=45&regime=GENERAL',{headers:{Authorization:'Bearer '+token}});
    assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    assert.equal((await response.json()).maxWeeklyHours,42);
    response=await fetch(base+'?on=2026-02-30&weeklyHours=45',{headers:{Authorization:'Bearer '+token}});
    assert.equal(response.status,400);
    response=await fetch(base+'?on=2026-11-11&weeklyHours=45&regime=SPECIAL',{headers:{Authorization:'Bearer '+token}});
    assert.equal(response.status,200);
    assert.equal((await response.json()).status,'REGIME_NOT_EVALUATED');
    assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
  }finally{
    await new Promise(resolve=>server.close(resolve));
    await pool.end();
  }
});
