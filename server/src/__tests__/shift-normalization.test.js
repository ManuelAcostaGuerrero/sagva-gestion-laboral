import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createSqlitePool } from '../db.js';
import { projectRoot } from '../databasePath.js';
import { migrateRotativoShiftLibrary } from '../shiftNormalizationMigration.js';

test('Normalizar Rotativo consolida duplicados sin alterar horas ni referencias armadas', async () => {
  const database = createSqlitePool(':memory:');
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction({ foreignKeys: false });
    await connection.execute(`CREATE TABLE schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )`);
    await connection.execScript(
      fs.readFileSync(path.join(projectRoot, 'database/schema.sql'), 'utf8'),
    );
    await connection.execScript(
      fs.readFileSync(
        path.join(projectRoot, 'database/migrations/20261002_002_weekly_planner.sql'),
        'utf8',
      ),
    );
    await connection.execScript(
      fs.readFileSync(
        path.join(projectRoot, 'database/migrations/20261004_004_shift_groups.sql'),
        'utf8',
      ),
    );

    const [groups] = await connection.execute(
      "SELECT id FROM shift_groups WHERE name='Rotativo'",
    );
    const rotativoId = groups[0].id;
    const [areas] = await connection.execute(
      "SELECT id,name FROM work_areas WHERE name IN ('Bodega','Cocina') ORDER BY name",
    );
    const areaByName = Object.fromEntries(areas.map(area => [area.name, area.id]));

    const [first] = await connection.execute(
      "INSERT INTO work_shifts(name,start_time,end_time,break_minutes,group_id) VALUES('Bodega 08:00-15:30','08:00','15:30',30,?)",
      [rotativoId],
    );
    const [second] = await connection.execute(
      "INSERT INTO work_shifts(name,start_time,end_time,break_minutes,group_id) VALUES('Cocina 08:00-15:30','08:00','15:30',30,?)",
      [rotativoId],
    );
    for (const shiftId of [first.insertId, second.insertId]) {
      await connection.execute(
        'INSERT INTO work_shift_segments(shift_id,segment_order,start_time,end_time,start_day_offset,end_day_offset) VALUES(?,0,?,?,0,0)',
        [shiftId, '08:00', '15:30'],
      );
    }

    await connection.execute(
      "INSERT INTO shift_area_references(area_id,shift_id,source,reference_frequency) VALUES(?,?, 'bodega',2)",
      [areaByName.Bodega, first.insertId],
    );
    await connection.execute(
      "INSERT INTO shift_area_references(area_id,shift_id,source,reference_frequency) VALUES(?,?, 'cocina',3)",
      [areaByName.Cocina, second.insertId],
    );

    await connection.execute(
      "INSERT INTO employees(id,document_id,full_name) VALUES(1,'TEST-1','Persona prueba')",
    );
    await connection.execute(
      'INSERT INTO employee_shift_assignments(employee_id,shift_id) VALUES(1,?)',
      [second.insertId],
    );
    await connection.execute(
      "INSERT INTO employee_shift_calendar(employee_id,work_date,shift_id,day_type) VALUES(1,'2026-10-05',?,'work')",
      [second.insertId],
    );

    const [week] = await connection.execute(
      "INSERT INTO planner_weeks(area_id,week_start,required_staff_json) VALUES(?,'2026-10-05','[1,0,0,0,0,0,0]')",
      [areaByName.Bodega],
    );
    await connection.execute(
      "INSERT INTO planner_rows(id,week_id,position,label,employee_id) VALUES('row-normalize',?,0,'Persona prueba',1)",
      [week.insertId],
    );
    await connection.execute(
      "INSERT INTO planner_cells(row_id,day_index,shift_id,day_type) VALUES('row-normalize',0,?,'work')",
      [first.insertId],
    );

    const before = (
      await connection.execute(
        'SELECT id,name,start_time AS startTime,end_time AS endTime,break_minutes AS breakMinutes FROM work_shifts WHERE is_active=1 ORDER BY id',
      )
    )[0];
    assert.equal(before.length, 2);

    await migrateRotativoShiftLibrary(connection);
    await migrateRotativoShiftLibrary(connection);

    const [active] = await connection.execute(
      'SELECT id,name,start_time AS startTime,end_time AS endTime,break_minutes AS breakMinutes FROM work_shifts WHERE is_active=1 ORDER BY id',
    );
    assert.deepEqual(active, [{
      id: first.insertId,
      name: 'Rotativo 08:00–15:30',
      startTime: '08:00',
      endTime: '15:30',
      breakMinutes: 30,
    }]);

    const canonicalId = first.insertId;
    assert.equal(
      (await connection.execute('SELECT shift_id AS shiftId FROM employee_shift_assignments WHERE employee_id=1'))[0][0].shiftId,
      canonicalId,
    );
    assert.equal(
      (await connection.execute("SELECT shift_id AS shiftId FROM employee_shift_calendar WHERE employee_id=1 AND work_date='2026-10-05'"))[0][0].shiftId,
      canonicalId,
    );
    assert.equal(
      (await connection.execute("SELECT shift_id AS shiftId FROM planner_cells WHERE row_id='row-normalize' AND day_index=0"))[0][0].shiftId,
      canonicalId,
    );

    const [references] = await connection.execute(
      'SELECT area_id AS areaId,shift_id AS shiftId,reference_frequency AS frequency FROM shift_area_references ORDER BY area_id',
    );
    assert.deepEqual(references, [
      { areaId: areaByName.Bodega, shiftId: canonicalId, frequency: 2 },
      { areaId: areaByName.Cocina, shiftId: canonicalId, frequency: 3 },
    ].sort((a, b) => a.areaId - b.areaId));

    const [archived] = await connection.execute(
      'SELECT id,is_active AS isActive FROM work_shifts WHERE id=?',
      [second.insertId],
    );
    assert.equal(archived[0].isActive, 0);
    assert.deepEqual((await connection.execute('PRAGMA foreign_key_check'))[0], []);

    const [migrations] = await connection.execute(
      "SELECT COUNT(*) AS total FROM schema_migrations WHERE id='20261006_006_normalize_rotativo_shift_library'",
    );
    assert.equal(migrations[0].total, 1);
    await connection.commit();
  } finally {
    try { await connection.rollback(); } catch {}
    connection.release();
    await database.end();
  }
});
