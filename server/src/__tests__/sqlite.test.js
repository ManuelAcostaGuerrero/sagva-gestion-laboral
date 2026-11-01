import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';
import { createSqlitePool } from '../db.js';
import { projectRoot } from '../databasePath.js';

const schema=fs.readFileSync(path.join(projectRoot,'database/schema.sql'),'utf8');
async function initialize(pool) {
  const connection=await pool.getConnection();
  try { await connection.beginTransaction(); await connection.execScript(schema); await connection.commit(); }
  finally { connection.release(); }
}
test('SQLite conserva restricciones, ids, parametros y configura fechas locales',async()=> {
  const pool=createSqlitePool(':memory:');
  try {
    await initialize(pool);
    const [admin]=await pool.execute('INSERT INTO admins(username,password_hash,full_name) VALUES(:username,:hash,:name)',{username:'admin',hash:'hash',name:'Administrador',unused:true});
    assert.equal(admin.insertId,1);
    await assert.rejects(pool.execute("INSERT INTO admins(username,password_hash,full_name) VALUES('ADMIN','hash','Duplicado')"));
    const [employee]=await pool.execute("INSERT INTO employees(document_id,full_name) VALUES('123','Persona')");
    await assert.rejects(pool.execute("INSERT INTO attendance_records(employee_id,record_type) VALUES(999,'entrada')"));
    await assert.rejects(pool.execute('INSERT INTO attendance_records(employee_id,record_type) VALUES(?,?)',[employee.insertId,'invalido']));
    await pool.execute('INSERT INTO attendance_records(employee_id,record_type,registered_at) VALUES(?,?,?)',[employee.insertId,'entrada','2026-10-02 09:15:59']);
    const [rows]=await pool.execute("SELECT registered_at, date(registered_at) AS day, minutes_between(local_timestamp(date(registered_at),'09:00'), registered_at) AS late FROM attendance_records");
    assert.deepEqual(rows,[{registered_at:'2026-10-02 09:15:59',day:'2026-10-02',late:15}]);
    const [now]=await pool.execute("SELECT created_at = datetime('now','localtime') AS local FROM admins");
    assert.equal(now[0].local,1);
    await initialize(pool);
    const [count]=await pool.execute('SELECT COUNT(*) AS total FROM admins');
    assert.equal(count[0].total,1);
  } finally { await pool.end(); }
});
test('Una transaccion fallida revierte y las consultas concurrentes esperan su final',async()=> {
  const pool=createSqlitePool(':memory:');
  try {
    await initialize(pool);
    const connection=await pool.getConnection();
    await connection.beginTransaction();
    await connection.execute("INSERT INTO employees(document_id,full_name) VALUES('rollback','Temporal')");
    const reading=pool.execute('SELECT COUNT(*) AS total FROM employees');
    await connection.rollback(); connection.release();
    const [rows]=await reading;
    assert.equal(rows[0].total,0);
    const committed=await pool.getConnection();
    await committed.beginTransaction();
    await committed.execute("INSERT INTO employees(document_id,full_name) VALUES('kept','Persistente')");
    await committed.commit();
    // La auditoria despues de COMMIT no debe quedar bloqueada por release pendiente.
    const [count]=await pool.execute('SELECT COUNT(*) AS total FROM employees');
    assert.equal(count[0].total,1); committed.release();
  } finally { await pool.end(); }
});
test('Respaldo SQLite incorpora WAL y permite recuperar datos sin duplicarlos',async()=> {
  const base=path.join(projectRoot,'.local'); fs.mkdirSync(base,{recursive:true});
  const directory=fs.mkdtempSync(path.join(base,'test-sqlite-'));
  const filename=path.join(directory,'source.db');
  const saved=path.join(directory,'backup.db');
  const pool=createSqlitePool(filename);
  let source, restored;
  try {
    await initialize(pool);
    await pool.execute("INSERT INTO employees(document_id,full_name) VALUES('persist','Persona persistente')");
    source=new DatabaseSync(filename,{readOnly:true});
    await backup(source,saved);
    restored=new DatabaseSync(saved,{readOnly:true});
    assert.equal(restored.prepare('SELECT COUNT(*) AS total FROM employees').get().total,1);
    assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    assert.equal(restored.prepare('PRAGMA foreign_key_check').all().length,0);
    await pool.execute("INSERT INTO employees(document_id,full_name) VALUES('second','Otra persona')");
    assert.equal(restored.prepare('SELECT COUNT(*) AS total FROM employees').get().total,1);
  } finally {
    restored?.close(); source?.close(); await pool.end();
    for (const file of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory,file));
    fs.rmdirSync(directory);
  }
});
