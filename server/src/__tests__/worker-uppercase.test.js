import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SQLITE_PATH=':memory:';process.env.JWT_SECRET='uppercase-tests';
const {createSqlitePool}=await import('../db.js');
const {migrateWorkerUppercase}=await import('../workerUppercaseMigration.js');
const {formatRut,checkRut}=await import('../rut.js');
const {completeFileMissing}=await import('../workerFileStandards.js');
const {runMigrations}=await import('../migrations.js');
const {pool}=await import('../db.js');
const {fileSchema,saveEmployeeFile,fileSelect,presentFile}=await import('../employeeFiles.js');
test('RUT con puntos mantiene la validación y el correo en mayúsculas se valida correctamente',()=>{
 assert.equal(formatRut('12345678-5'),'12.345.678-5');
 assert.equal(checkRut(formatRut('12345678-5')).valid,true);
 assert.equal(checkRut(formatRut('12345678-0')).valid,false);
 assert.equal(formatRut('6000000k'),'6.000.000-K');
 assert.equal(formatRut(''),'');
 assert.ok(!completeFileMissing({email:'PERSONA@EXAMPLE.COM'}).includes('Correo electrónico válido'));
 assert.ok(completeFileMissing({email:'PERSONA EXAMPLE.COM'}).includes('Correo electrónico válido'));
});
test('Normalización histórica es idempotente, conserva originales, nombre legal y RUT, e invalida revisiones antiguas',async()=>{
 const db=createSqlitePool(':memory:');const c=await db.getConnection();
 try {
  await c.execScript(`CREATE TABLE schema_migrations(id TEXT PRIMARY KEY);
  CREATE TABLE employees(id INTEGER PRIMARY KEY,full_name TEXT,first_name TEXT,second_name TEXT,other_names TEXT,first_last_name TEXT,second_last_name TEXT,email TEXT,legal_full_name TEXT,document_id TEXT);
  CREATE TABLE employee_files(employee_id INTEGER PRIMARY KEY REFERENCES employees(id),revision INTEGER);
  INSERT INTO employees VALUES(1,'Ana María Pérez','Ana','María',NULL,'Pérez',NULL,'ana@example.com','Ana  María Pérez','12.345.678-5');
  INSERT INTO employee_files VALUES(1,3);`);
  await c.beginTransaction();await migrateWorkerUppercase(c);await migrateWorkerUppercase(c);await c.commit();
  const row=(await c.execute('SELECT * FROM employees'))[0][0];
  assert.equal(row.full_name,'ANA MARÍA PÉREZ');assert.equal(row.email,'ANA@EXAMPLE.COM');
  assert.equal(row.first_name,'ANA');assert.equal(row.first_last_name,'PÉREZ');
  assert.equal(row.legal_full_name,'Ana  María Pérez');assert.equal(row.document_id,'12.345.678-5');
  const history=(await c.execute('SELECT * FROM employee_standardization_history'))[0];
  assert.equal(history.length,1);assert.equal(JSON.parse(history[0].previous_values_json).email,'ana@example.com');
  assert.equal((await c.execute('SELECT revision FROM employee_files'))[0][0].revision,4);
  assert.deepEqual((await c.execute('PRAGMA foreign_key_check'))[0],[]);
 } finally {c.release();await db.end();}
});
test('Guardar normaliza nombres/correo y corregir RUT sin campo de motivo conserva historial automático',async()=>{
 await runMigrations();
 try {
  const id=await saveEmployeeFile(null,fileSchema.parse({fullName:'Ana Pérez',firstName:'Ana',firstLastName:'Pérez',documentId:'12345678-5',email:'ana@example.com',validationNotes:'Nota histórica'}),null);
  let file=presentFile((await pool.execute(`${fileSelect} WHERE e.id=?`,[id]))[0][0]);
  assert.equal(file.fullName,'ANA PÉREZ');assert.equal(file.email,'ANA@EXAMPLE.COM');
  await saveEmployeeFile(id,fileSchema.parse({...file,documentId:'12.345.678-5'}),null);
  assert.equal((await pool.execute('SELECT COUNT(*) n FROM employee_document_history WHERE employee_id=?',[id]))[0][0].n,0);
  file=presentFile((await pool.execute(`${fileSelect} WHERE e.id=?`,[id]))[0][0]);
  await saveEmployeeFile(id,fileSchema.parse({...file,documentId:'6.000.000-K'}),null);
  const history=(await pool.execute('SELECT reason FROM employee_document_history WHERE employee_id=?',[id]))[0];
  assert.equal(history.length,1);assert.match(history[0].reason,/Corrección del RUT/);
  assert.equal((await pool.execute('SELECT validation_notes FROM employee_files WHERE employee_id=?',[id]))[0][0].validation_notes,'Nota histórica');
 } finally {await pool.end();}
});
