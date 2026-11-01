import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createSqlitePool} from '../db.js';
import {projectRoot} from '../databasePath.js';
import {migrateWorkPositions,normalizeWorkLabel,resolvePosition} from '../workPositions.js';

test('Migración de cargos idempotente, nombres mayúsculos y referencias conservadas',async()=>{
 const db=createSqlitePool(':memory:');
 const conn=await db.getConnection();
 try {
  await conn.beginTransaction();
  await conn.execScript(fs.readFileSync(path.join(projectRoot,'database/schema.sql'),'utf8'));
  await conn.execScript('CREATE TABLE schema_migrations(id TEXT PRIMARY KEY)');
  const [area]=await conn.execute('INSERT INTO work_areas(name) VALUES(?)',['Cocina ensayo']);
  await conn.execute('INSERT INTO employees(full_name,position_name,work_area_id) VALUES(?,?,?)',['Persona 1','garzón',area.insertId]);
  await conn.execute('INSERT INTO employees(full_name,position_name,work_area_id) VALUES(?,?,?)',['Persona 2','GARZÓN',area.insertId]);
  await conn.execute("INSERT INTO attendance_records(employee_id,record_type) VALUES(1,'entrada')");
  await migrateWorkPositions(conn);
  await migrateWorkPositions(conn);
  assert.equal((await conn.execute('SELECT name FROM work_areas WHERE id=?',[area.insertId]))[0][0].name,'COCINA ENSAYO');
  assert.deepEqual((await conn.execute('SELECT DISTINCT position_name AS name FROM employees'))[0].map(r=>r.name),['GARZÓN']);
  assert.equal((await conn.execute('SELECT COUNT(*) AS n FROM work_positions'))[0][0].n,1);
  assert.equal((await conn.execute('SELECT COUNT(*) AS n FROM attendance_records'))[0][0].n,1);
  assert.deepEqual((await conn.execute('PRAGMA foreign_key_check'))[0],[]);
  assert.equal(await resolvePosition(' garzón ',conn),'GARZÓN');
  await assert.rejects(()=>resolvePosition('cargo no registrado',conn),/Selecciona un cargo activo/);
  await conn.commit();
 }finally{conn.release();await db.end();}
 assert.equal(normalizeWorkLabel('  área   de   atención  '),'ÁREA DE ATENCIÓN');
});
