import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
process.env.SQLITE_PATH = ':memory:';
process.env.JWT_SECRET = 'contracts-isolated-tests';
const {pool,createSqlitePool} = await import('../db.js');
const {runMigrations} = await import('../migrations.js');
const {saveEmployeeFile,fileSelect,presentFile,fileSchema} = await import('../employeeFiles.js');
const {migrateEmployeeContracts,validateContract,currentContractEnd} = await import('../employeeContracts.js');
const {importDifference} = await import('../importReview.js');
const {projectRoot} = await import('../databasePath.js');
const {migrateEmployeeFiles} = await import('../employeeFilesMigration.js');
const base = {fullName:'Persona contrato',contractType:'PLAZO_FIJO',hireDate:'2026-01-01',terminationDate:'2026-03-31',employmentStatus:'ACTIVO',annexes:[]};
const first = {annexDate:'2026-03-15',endDate:'2026-06-30'};
const second = {annexDate:'2026-06-15',endDate:'2026-09-30'};
async function get(id) { return presentFile((await pool.execute(`${fileSelect} WHERE e.id=?`,[id]))[0][0]); }
test('Contratos 0/1/2 anexos, fechas reales, prórroga posterior y orden', () => {
  assert.equal(currentContractEnd(base),'2026-03-31');
  assert.equal(currentContractEnd({...base,annexes:[first]}),'2026-06-30');
  assert.equal(currentContractEnd({...base,annexes:[first,second]}),'2026-09-30');
  assert.equal(currentContractEnd({...base,contractType:'INDEFINIDO',annexes:[first]}),null);
  for (const annexes of [[],[first],[first,second]]) validateContract({...base,annexes});
  validateContract({contractType:'INDEFINIDO',hireDate:'2026-01-01'});
  for (const data of [
    {...base,annexes:[first,second,second]},
    {...base,annexes:[{...first,endDate:'2026-03-31'}]},
    {...base,annexes:[{...first,annexDate:'2026-02-30'}]},
    {...base,annexes:[first,{...second,annexDate:'2026-03-01'}]},
    {...base,annexes:[{...first,annexDate:'2026-07-01'}]},
    {...base,terminationDate:null,annexes:[first]},
    {...base,contractType:'INDEFINIDO',annexes:[first]},
    {...base,contractType:'INDEFINIDO',terminationDate:'2025-12-31'},
    {...base,birthDate:'2025-02-29'},
    {...base,terminationDate:'2025-12-31'},
  ]) assert.throws(() => validateContract(data));
  assert.equal(fileSchema.safeParse({...base,annexes:[first,second,second]}).success,false);
});
test('Migración aditiva idempotente conserva registros históricos y verifica claves foráneas',async () => {
  const db=createSqlitePool(':memory:');
  const connection=await db.getConnection();
  try {
    await connection.beginTransaction({foreignKeys:false});
    await connection.execScript('CREATE TABLE schema_migrations(id TEXT PRIMARY KEY)');
    await connection.execScript(fs.readFileSync(path.join(projectRoot,'database/schema.sql'),'utf8'));
    await connection.execScript(fs.readFileSync(path.join(projectRoot,'database/migrations/20261002_002_weekly_planner.sql'),'utf8'));
    await connection.execScript(`
      INSERT INTO employees(id,document_id,full_name,is_active) VALUES(7,'12.345.678-5','Histórico',0);
      INSERT INTO work_shifts(id,name,start_time,end_time,break_minutes) VALUES(900,'Histórico','09:00','18:00',30);
      INSERT INTO planner_weeks(id,area_id,week_start,status,required_staff_json,revision) VALUES(900,(SELECT min(id) FROM work_areas),'2026-10-05','published','{}',4);
      INSERT INTO planner_rows(id,week_id,position,label,employee_id) VALUES('historical',900,0,'Histórico',7);
      INSERT INTO planner_cells(row_id,day_index,shift_id,day_type) VALUES('historical',0,900,'work');
      INSERT INTO employee_shift_calendar(employee_id,work_date,shift_id,day_type,source_week_id) VALUES(7,'2026-10-05',900,'work',900);
      INSERT INTO attendance_records(employee_id,record_type) VALUES(7,'entrada');
      INSERT INTO fingerprints(employee_id,finger_label,template,template_hash) VALUES(7,'indice_derecho','fixture','hash');
      INSERT INTO employee_document_history(employee_id,old_document_id,new_document_id,reason) VALUES(7,'previo','12.345.678-5','histórico');
    `);
    await migrateEmployeeFiles(connection);
    await connection.execute(`UPDATE employee_files SET termination_date='2026-04-01',extra_json='{"legacy":true}' WHERE employee_id=7`);
    const historicalTables=['employees','attendance_records','fingerprints','employee_document_history','employee_shift_calendar','planner_weeks','planner_rows','planner_cells'];
    const before=Object.fromEntries(await Promise.all(historicalTables.map(async table=>[table,(await connection.execute(`SELECT * FROM ${table}`))[0]])));
    const fileBefore=(await connection.execute('SELECT * FROM employee_files'))[0];
    await migrateEmployeeContracts(connection);
    await migrateEmployeeContracts(connection);
    for (const table of historicalTables) assert.deepEqual((await connection.execute(`SELECT * FROM ${table}`))[0],before[table]);
    const originalColumns=Object.keys(fileBefore[0]).join(',');
    assert.deepEqual((await connection.execute(`SELECT ${originalColumns} FROM employee_files`))[0],fileBefore);
    assert.deepEqual((await connection.execute('SELECT employee_id,termination_date,extra_json FROM employee_files'))[0],[{employee_id:7,termination_date:'2026-04-01',extra_json:'{"legacy":true}'}]);
    assert.equal((await connection.execute("SELECT COUNT(*) n FROM schema_migrations WHERE id='20261008_008_employee_contract_annexes'"))[0][0].n,1);
    assert.equal((await connection.execute('PRAGMA table_info(employee_files)'))[0].some(c=>c.name==='settlement_date'),false);
    assert.deepEqual((await connection.execute('PRAGMA foreign_key_check'))[0],[]);
    await assert.rejects(connection.execute("INSERT INTO employee_contract_annexes(employee_id,annex_order,annex_date,end_date) VALUES(7,2,'2026-03-01','2026-05-01')"));
    await connection.commit();
  } finally { connection.release(); await db.end(); }
});
test('Guardar anexos es atómico, auditado y concurrente; conserva históricos, estado inactivo y término inicial',async () => {
  await runMigrations();
  const [result]=await pool.execute("INSERT INTO admins(username,password_hash,full_name) VALUES('contracts','test','Contratos')");
  const admin={id:result.insertId,username:'contracts',role:'admin'};
  const id=await saveEmployeeFile(null,fileSchema.parse(base),admin);
  let file=await get(id);
  assert.deepEqual(file.annexes,[]);
  await pool.execute("INSERT INTO attendance_records(employee_id,record_type) VALUES(?,'entrada')",[id]);
  const tables=(await pool.execute("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%week%' OR name LIKE '%calendar%' OR name LIKE '%assignment%' OR name IN ('attendance_records','fingerprints','employee_document_history'))"))[0];
  const snapshot=async()=>Object.fromEntries(await Promise.all(tables.map(async ({name})=>[name,(await pool.execute(`SELECT * FROM "${name}"`))[0]])));
  const history=await snapshot();
  await saveEmployeeFile(id,fileSchema.parse({...file,annexes:[first]}),admin);
  file=await get(id);
  assert.equal(file.currentContractEnd,first.endDate);
  const stale=file;
  await saveEmployeeFile(id,fileSchema.parse({...file,annexes:[first,second]}),admin);
  await assert.rejects(saveEmployeeFile(id,fileSchema.parse({...stale,annexes:[first]}),admin),/otra sesión/);
  file=await get(id);
  const [rows]=await pool.execute('SELECT * FROM employee_contract_annexes WHERE employee_id=? ORDER BY annex_order',[id]);
  assert.equal(rows.length,2); assert.equal(rows[0].created_by,admin.id); assert.equal(rows[1].updated_by,admin.id);
  assert.equal(file.terminationDate,base.terminationDate);
  assert.equal(file.currentContractEnd,second.endDate);
  assert.deepEqual(JSON.parse((await pool.execute('SELECT extra_json FROM employee_files WHERE employee_id=?',[id]))[0][0].extra_json).annexes,undefined);
  await saveEmployeeFile(id,fileSchema.parse(file),admin);
  assert.deepEqual((await pool.execute('SELECT * FROM employee_contract_annexes WHERE employee_id=? ORDER BY annex_order',[id]))[0],rows);
  file=await get(id);
  await assert.rejects(saveEmployeeFile(id,fileSchema.parse({...file,annexes:[]}),admin),/historial/);
  await assert.rejects(saveEmployeeFile(id,fileSchema.parse({...file,terminationDate:'',clearFields:['terminationDate']}),admin),/término inicial/);
  await saveEmployeeFile(id,fileSchema.parse({...file,contractType:'INDEFINIDO'}),admin);
  file=await get(id); assert.equal(file.currentContractEnd,null); assert.equal(file.annexes.length,2);
  await saveEmployeeFile(id,fileSchema.parse({...file,contractType:'PLAZO_FIJO',employmentStatus:'FINIQUITADO',terminationReason:'Término acordado'}),admin);
  file=await get(id); assert.equal(file.isActive,0); assert.equal(file.settlementDate,undefined); assert.equal(file.terminationDate,base.terminationDate);
  await assert.rejects(saveEmployeeFile(id,fileSchema.parse({...file,employmentStatus:'ACTIVO'}),admin),/Usuarios/);
  await saveEmployeeFile(id,fileSchema.parse({...file,company:'Empresa nueva',terminationReason:''}),admin);
  file=await get(id); assert.equal(file.isActive,0); assert.equal(file.settlementDate,undefined); assert.equal(file.terminationReason,'Término acordado');
  const [audit]=await pool.execute("SELECT details FROM audit_logs WHERE entity_id=? AND action='update_file' ORDER BY id DESC LIMIT 1",[String(id)]);
  assert.equal(JSON.parse(audit[0].details).after.annexes.length,2);
  await pool.execute("CREATE TRIGGER fail_contract_audit BEFORE INSERT ON audit_logs WHEN NEW.action='update_file' BEGIN SELECT RAISE(ABORT,'audit failure'); END");
  await assert.rejects(saveEmployeeFile(id,fileSchema.parse({...file,annexes:[first,{...second,endDate:'2026-11-30'}]}),admin),/audit failure/);
  await pool.execute('DROP TRIGGER fail_contract_audit');
  assert.equal((await get(id)).currentContractEnd,second.endDate);
  assert.equal((await get(id)).revision,file.revision);
  assert.deepEqual(await snapshot(),history);
  assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
  const [legacy]=await pool.execute("INSERT INTO employees(full_name,is_active) VALUES('Fechas pendientes',0)");
  await pool.execute("INSERT INTO employee_files(employee_id,hire_date,birth_date) VALUES(?,'fecha por revisar','fecha por revisar')",[legacy.insertId]);
  await pool.execute('ALTER TABLE employee_files ADD COLUMN settlement_date TEXT');
  await pool.execute("UPDATE employee_files SET settlement_date='2026-04-02',termination_date='2026-04-01',contract_type='INDEFINIDO' WHERE employee_id=?",[legacy.insertId]);
  const legacyFile=await get(legacy.insertId);
  assert.equal(legacyFile.currentContractEnd,'2026-04-01');
  assert.equal(legacyFile.settlementDate,undefined);
  await saveEmployeeFile(legacy.insertId,fileSchema.parse({...legacyFile,company:'Empresa',birthDate:'2000-01-01'}),admin);
  const preserved=await get(legacy.insertId);
  assert.equal((await pool.execute('SELECT settlement_date FROM employee_files WHERE employee_id=?',[legacy.insertId]))[0][0].settlement_date,'2026-04-02');
  assert.equal(preserved.terminationDate,'2026-04-01');
  await saveEmployeeFile(legacy.insertId,fileSchema.parse({...preserved,hireDate:'2026-01-01',terminationDate:'2026-05-01',employmentStatus:'FINIQUITADO'}),admin);
  assert.equal((await get(legacy.insertId)).currentContractEnd,'2026-05-01');
  assert.equal(preserved.hireDate,'fecha por revisar'); assert.equal(preserved.birthDate,'2000-01-01'); assert.equal(preserved.isActive,0);
});
test('Avisos del informe muestran etiqueta y ambos valores; avisos antiguos se presentan sin reescribirlos', () => {
  const message=importDifference('hire_date','2026-03-15','2026-03-01');
  assert.match(message,/Fecha de contratación/);assert.match(message,/15\/03\/2026/);assert.match(message,/01\/03\/2026/);assert.doesNotMatch(message,/hire_date/);
  const raw='Informe: hire_date distinto. Se conserva el valor actual.';
  const file=presentFile({observations:raw,hireDate:'2026-03-01',reportJson:JSON.stringify({'FECHA CONTRATO':'15/03/2026'})});
  assert.equal(file.observations,raw);assert.equal(file.readableObservations,'');
  assert.ok(file.warnings.some(w=>w.includes('15/03/2026') && w.includes('01/03/2026')));
});
