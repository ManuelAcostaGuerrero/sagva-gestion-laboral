import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='p3-synthetic-only-test-secret';
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {previsionAsOf,NORMALIZATION_EXPAND_MIGRATION}=await import('../normalizationExpand.js');
const {auditNormalization,FIELD_AUTHORITY_V1}=await import('../../../tools/auditar-normalizacion.mjs');

test('P3: expand vacio, autoridad canonica, prevision versionada y JSON original intacto',async()=>{
  await runMigrations();await runMigrations();
  const [applied]=await pool.execute('SELECT COUNT(*) AS n FROM schema_migrations WHERE id=?',[NORMALIZATION_EXPAND_MIGRATION]);
  assert.equal(applied[0].n,1);
  const [initial]=await pool.execute('SELECT COUNT(*) AS n FROM employee_prevision_versions');
  assert.equal(initial[0].n,0,'No trasladar JSON heredado automaticamente');
  const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('p3-test','hash','Administrador sintético','admin')");
  const [company]=await pool.execute("INSERT INTO company_profiles(legal_name) VALUES('EMPRESA ACTUAL SINTETICA')");
  const [employee]=await pool.execute(
    "INSERT INTO employees(full_name,legal_full_name,first_name,first_last_name,second_last_name,is_active) VALUES(?,?,?,?,?,1)",
    ['NOMBRE ANTERIOR','Nombre legal revisado','ANA','PEREZ','ROJAS']);
  const extras=JSON.stringify({paternalLastName:'PÉREZ_DISTINTO',maternalLastName:'ROJAS',
    afp:'AFP INVENTADA',healthSystem:'ISAPRE',isapreName:'SIN CATALOGO',branch:'SUCURSAL LEGADA',
    unmodifiedField:'SE CONSERVA'});
  await pool.execute(
    "INSERT INTO employee_files(employee_id,employment_status,company,company_id,extra_json) VALUES(?,'INACTIVO','RAZON SOCIAL HISTORICA',?,?)",
    [employee.insertId,company.insertId,extras]);
  const [canonical]=await pool.execute('SELECT * FROM employee_authority_v1 WHERE employee_id=?',[employee.insertId]);
  assert.equal(canonical[0].legal_name,'Nombre legal revisado');
  assert.equal(canonical[0].company_display,'EMPRESA ACTUAL SINTETICA');
  assert.equal(canonical[0].legacy_company_name,'RAZON SOCIAL HISTORICA');
  assert.equal(canonical[0].status_conflict,1);
  const [entities]=await pool.execute("SELECT id,kind FROM labor_entities WHERE code IN ('FONASA','HABITAT') ORDER BY kind");
  const afp=entities.find(x=>x.kind==='AFP').id,health=entities.find(x=>x.kind==='FONASA').id;
  await assert.rejects(pool.execute(
    "INSERT INTO employee_prevision_versions(employee_id,valid_from,afp_entity_id,source_ref,confirmed_by) VALUES(?,?,?,?,?)",
    [employee.insertId,'2026-01-01',health,'FUENTE ERRONEA',admin.insertId]));
  const [first]=await pool.execute(
    "INSERT INTO employee_prevision_versions(employee_id,valid_from,valid_until,afp_entity_id,health_entity_id,source_ref,confirmed_by) VALUES(?,?,?,?,?,?,?)",
    [employee.insertId,'2026-01-01','2026-07-01',afp,health,'CERTIFICADO REVISADO',admin.insertId]);
  await assert.rejects(pool.execute(
    "INSERT INTO employee_prevision_versions(employee_id,valid_from,afp_entity_id,source_ref,confirmed_by) VALUES(?,?,?,'SUPERPOSICION',?)",
    [employee.insertId,'2026-06-01',afp,admin.insertId]));
  await pool.execute(
    "INSERT INTO employee_prevision_versions(employee_id,valid_from,afp_entity_id,health_entity_id,plan_amount_hundredths,plan_unit,source_ref,confirmed_by) VALUES(?,?,?,?,?,?,?,?)",
    [employee.insertId,'2026-07-01',afp,health,700,'UF','NUEVO CERTIFICADO REVISADO',admin.insertId]);
  assert.equal((await previsionAsOf(pool,employee.insertId,'2026-06-30')).versionId,first.insertId);
  assert.equal((await previsionAsOf(pool,employee.insertId,'2026-07-02')).planUnit,'UF');
  assert.equal(await previsionAsOf(pool,employee.insertId,'2025-12-31'),null);
  await assert.rejects(pool.execute('DELETE FROM employee_prevision_versions WHERE id=?',[first.insertId]));
  await assert.rejects(pool.execute('UPDATE employee_prevision_versions SET plan_unit=? WHERE id=?',['CLP',first.insertId]));
  const [source]=await pool.execute('SELECT extra_json FROM employee_files WHERE employee_id=?',[employee.insertId]);
  assert.equal(source[0].extra_json,extras,'Expand no altera ni elimina JSON heredado');
  assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
  await pool.end();
});

test('P3: informe solo agrega indicadores sin emitir datos personales ni reescribir JSON',()=>{
  const db=new DatabaseSync(':memory:');
  try{
    db.exec(`
      CREATE TABLE employees(id INTEGER PRIMARY KEY,first_last_name TEXT,second_last_name TEXT);
      CREATE TABLE employee_files(employee_id INTEGER, company_id INTEGER,company TEXT,extra_json TEXT);
      CREATE TABLE company_profiles(id INTEGER PRIMARY KEY,legal_name TEXT);
      CREATE TABLE labor_entities(id INTEGER PRIMARY KEY,kind TEXT,code TEXT,name TEXT);
      CREATE TABLE employee_contract_terms(employee_id INTEGER,terms_json TEXT);
      INSERT INTO employees VALUES(1,'APELLIDO REAL','APELLIDO MATERNO');
      INSERT INTO company_profiles VALUES(1,'RAZON OFICIAL');
      INSERT INTO labor_entities VALUES(1,'AFP','HABITAT','AFP HABITAT');
      INSERT INTO employee_files VALUES(1,1,'RAZON HISTORICA',
        '{"paternalLastName":"APELLIDO DIFERENTE","maternalLastName":"APELLIDO MATERNO","afp":"INSTITUCION DESCONOCIDA","isapreName":"SIN REFERENCIA","branch":"SUR"}');
      INSERT INTO employee_contract_terms VALUES(1,'{}');
      INSERT INTO employees VALUES(2,'OTRO APELLIDO','OTRO MATERNO');
      INSERT INTO employee_files VALUES(2,NULL,'','{json-ilegible');
    `);
    db.exec('PRAGMA query_only=ON');
    const report=auditNormalization(db);
    assert.equal(report.stage,'P3_COMPARE_ONLY');
    assert.equal(report.writeOperations,0);
    assert.equal(report.counts.legacyPaternalSurnameConflicts,1);
    assert.equal(report.counts.legacyMaternalSurnameConflicts,0);
    assert.equal(report.counts.linkedCompanyNameDifferences,1);
    assert.equal(report.counts.unrecognizedAfpLabel,1);
    assert.equal(report.counts.unrecognizedIsapreLabel,1);
    assert.equal(report.counts.invalidExtrasJson,1,'El informe debe tolerar JSON heredado malformado');
    assert.equal(db.prepare('PRAGMA query_only').get().query_only,1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM employee_files').get().n,2);
    assert.doesNotMatch(JSON.stringify(report),/APELLIDO REAL|APELLIDO DIFERENTE|INSTITUCION DESCONOCIDA|RAZON HISTORICA/);
    assert.ok(FIELD_AUTHORITY_V1.some(x=>x.field==='afp_salud'));
  }finally{db.close();}
});
