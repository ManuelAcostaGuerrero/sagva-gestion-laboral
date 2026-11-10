import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createWebApp } from '../../../tools/start-web.mjs';
import { resolveApiUrl } from '../../../client/src/services/apiUrl.js';

process.env.SQLITE_PATH = ':memory:';
process.env.JWT_SECRET = 'shift-library-test-secret-000000000000000';
process.env.ADMIN_SESSION_EXPIRES_IN = '8h';
const { app } = await import('../app.js');
const { pool } = await import('../db.js');
const { runMigrations } = await import('../migrations.js');
const { signAdmin } = await import('../auth.js');

test('Login por la web local, Rotativo común a todas las áreas y CRUD de turnos/horarios conservan referencias', async () => {
  await runMigrations();
  const [admin] = await pool.execute('INSERT INTO admins(username,password_hash,full_name) VALUES(?,?,?)', ['admin', await bcrypt.hash('admin123', 10), 'Administrador de prueba']);
  const backend = app.listen(0, '127.0.0.1');
  await new Promise(resolve => backend.once('listening', resolve));
  const web = createWebApp({ apiTarget: `http://127.0.0.1:${backend.address().port}` }).listen(0, '127.0.0.1');
  await new Promise(resolve => web.once('listening', resolve));
  const base = `http://127.0.0.1:${web.address().port}${resolveApiUrl({ hostname: 'localhost', protocol: 'http:' }, 'http://localhost:4000/api')}`;
  let token;
  async function request(route, method = 'GET', body, status = 200, auth = token) {
    const response = await fetch(base + route, {
      method, headers: { 'Content-Type': 'application/json', Origin: `http://localhost:${web.address().port}`, ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json();
    assert.equal(response.status, status, `${method} ${route}: ${JSON.stringify(data)}`);
    return data;
  }
  try {
    assert.equal((await request('/health')).service, 'attendance-fingerprint-api');
    await request('/auth/login', 'POST', { username: 'admin', password: 'incorrecta' }, 401);
    token = (await request('/auth/login', 'POST', { username: 'admin', password: 'admin123' })).token;
    assert.ok(token);
    const session = jwt.decode(token);
    assert.equal(session.exp - session.iat, 8 * 60 * 60, 'La sesión administrativa respeta ADMIN_SESSION_EXPIRES_IN.');
    const initial = await request('/schedules');
    const rotativo = initial.groups.find(group => group.name === 'Rotativo');
    const oficina = initial.groups.find(group => group.name === 'Oficina');
    assert.equal(initial.shifts.length, 36);
    assert.equal(rotativo.scheduleCount, 36);
    assert.equal(oficina.scheduleCount, 0);
    assert.ok(initial.shifts.every(shift => shift.groupId === rotativo.id));
    assert.equal(new Set(initial.shifts.map(shift => shift.label)).size, initial.shifts.length, 'La biblioteca activa no debe repetir horarios equivalentes.');
    assert.ok(initial.shifts.every(shift => shift.name.startsWith('Rotativo ')), 'Los horarios históricos activos quedan normalizados como Rotativo + horas.');
    const [initialReferences] = await pool.execute('SELECT * FROM shift_area_references ORDER BY area_id,shift_id');
    const [areas] = await pool.execute('SELECT id FROM work_areas WHERE is_active=1');
    const ids = initial.shifts.map(shift => shift.id).sort((a, b) => a - b);
    for (const area of areas) {
      const library = await request(`/planner/library?areaId=${area.id}`);
      assert.deepEqual(library.shifts.map(shift => shift.id).sort((a, b) => a - b), ids);
      const starts = library.shifts.map(shift => shift.startTime);
      assert.deepEqual(starts, [...starts].sort((a, b) => a.localeCompare(b)), 'La biblioteca debe ir de la hora más temprana a la más tarde.');
    }

    const plannerCreated = await request('/planner/library', 'POST', {
      areaId: areas[0].id,
      breakMinutes: 30,
      segments: [{ startTime: '06:00', endTime: '14:00' }]
    }, 201);
    const plannerLibrary = await request(`/planner/library?areaId=${areas[0].id}`);
    assert.equal(plannerLibrary.shifts.find(shift => shift.id === plannerCreated.id)?.name, 'Rotativo 06:00–14:00');

    const [operatorUser]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('turnos-operator','hash','Operador sintético','operator')");
    const operator = signAdmin({ id: operatorUser.insertId, username: 'turnos-operator', role: 'operator' });
    await request('/schedules/groups', 'POST', { name: 'No autorizado' }, 403, operator);
    const group = await request('/schedules/groups', 'POST', { name: ' Fin de semana ' }, 201);
    await request('/schedules/groups', 'POST', { name: 'fin de semana' }, 409);
    const split = await request('/schedules/shifts', 'POST', {
      groupId: group.id, breakMinutes: 30,
      segments: [{ startTime: '12:00', endTime: '15:00' }, { startTime: '20:00', endTime: '02:30' }]
    }, 201);
    await request(`/schedules/groups/${group.id}`, 'DELETE', undefined, 409);
    await request('/schedules/shifts', 'POST', {
      groupId: group.id, breakMinutes: 30,
      segments: [{ startTime: '12:00', endTime: '15:00' }, { startTime: '20:00', endTime: '02:30' }]
    }, 409);
    const createdGroupSchedule = (await request('/schedules')).shifts.find(shift => shift.id === split.id);
    assert.equal(createdGroupSchedule.name, 'Fin de semana 12:00–15:00 / 20:00–02:30');
    assert.ok((await request(`/planner/library?areaId=${areas[0].id}`)).shifts.some(shift => shift.id === split.id && shift.segments.length === 2 && shift.workMinutes === 540));
    await request(`/schedules/shifts/${split.id}`, 'DELETE');
    const [archived] = await pool.execute('SELECT is_active AS active FROM work_shifts WHERE id=?', [split.id]);
    assert.equal(archived[0].active, 0);
    const [segments] = await pool.execute('SELECT * FROM work_shift_segments WHERE shift_id=?', [split.id]);
    assert.equal(segments.length, 2);
    await request(`/schedules/groups/${group.id}`, 'DELETE');
    assert.ok(!(await request('/schedules')).groups.some(item => item.id === group.id));
    const revived = await request('/schedules/groups', 'POST', { name: 'Fin de semana' }, 201);
    assert.equal(revived.id, group.id);
    await request(`/schedules/groups/${rotativo.id}`, 'DELETE', undefined, 409);

    await request('/schedules/shifts', 'POST', { groupId: rotativo.id, startTime: '08:00', endTime: '15:30', breakMinutes: 30 }, 409);
    const repeated = await request('/schedules/shifts', 'POST', { groupId: rotativo.id, startTime: '05:45', endTime: '13:45', breakMinutes: 30 }, 201);
    const repeatedSchedule = (await request('/schedules')).shifts.find(shift => shift.id === repeated.id);
    assert.equal(repeatedSchedule.name, 'Rotativo 05:45–13:45');
    assert.ok((await request(`/planner/library?areaId=${areas.at(-1).id}`)).shifts.some(shift => shift.id === repeated.id));
    const [reference] = await pool.execute('SELECT shift_id AS id FROM shift_area_references WHERE area_id=? LIMIT 1', [areas[0].id]);
    const protectedId = reference[0].id;
    const days = Array(7).fill(null);
    days[0] = { dayType: 'work', shiftId: protectedId, availability: null };
    await request(`/planner/week?areaId=${areas.at(-1).id}&weekStart=2026-10-05`, 'PUT', { revision: 0, requiredStaff: Array(7).fill(0), rows: [{ id: 'shared-model-draft', label: 'Prueba', employeeId: null, days }] });
    await request(`/schedules/shifts/${protectedId}`, 'DELETE', undefined, 409);
    const draft = await request(`/planner/week?areaId=${areas.at(-1).id}&weekStart=2026-10-05`);
    assert.equal(draft.rows[0].days[0].shiftId, protectedId);
    assert.ok((await request('/schedules')).shifts.some(shift => shift.id === protectedId));
    await runMigrations();
    const [references] = await pool.execute('SELECT * FROM shift_area_references ORDER BY area_id,shift_id');
    assert.equal(references.length, initialReferences.length + 1, 'El horario creado añade una referencia sin borrar las anteriores.');
    assert.deepEqual(references.filter(reference => reference.shift_id !== plannerCreated.id), initialReferences);
    const createdReferences = references.filter(reference => reference.shift_id === plannerCreated.id);
    assert.equal(createdReferences.length, 1);
    assert.equal(createdReferences[0].area_id, areas[0].id);
    const [checks] = await pool.execute('PRAGMA foreign_key_check');
    assert.deepEqual(checks, []);
  } finally {
    await new Promise(resolve => web.close(resolve));
    await new Promise(resolve => backend.close(resolve));
    await pool.end();
  }
});
