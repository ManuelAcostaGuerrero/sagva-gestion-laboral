import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SQLITE_PATH = ':memory:';
process.env.JWT_SECRET = 'test-worker-medical-profile-20261010';
const { app } = await import('../app.js');
const { pool } = await import('../db.js');
const { runMigrations } = await import('../migrations.js');
const { signAdmin } = await import('../auth.js');
const { emptyMedicalProfile, MEDICAL_KEYS } = await import('../medicalProfileFields.js');
const { medicalProfileMigrationId } = await import('../medicalProfiles.js');

test('La ficha médica es privada, editable, auditada y se guarda sin invadir la ficha laboral', async () => {
  await runMigrations();
  await runMigrations();
  const [migrations] = await pool.execute('SELECT id FROM schema_migrations WHERE id=?', [medicalProfileMigrationId]);
  assert.equal(migrations.length, 1);
  assert.equal(MEDICAL_KEYS.length, 15);
  const [admin] = await pool.execute(
    "INSERT INTO admins(username,password_hash,full_name,role) VALUES('health-admin','hash','Admin','admin')"
  );
  const [operator] = await pool.execute(
    "INSERT INTO admins(username,password_hash,full_name,role) VALUES('health-oper','hash','Operador','operator')"
  );
  const [worker] = await pool.execute('INSERT INTO employees(full_name) VALUES(?)', ['Trabajador ficticio']);
  const adminToken = signAdmin({ id: admin.insertId, username: 'health-admin', role: 'admin' });
  const operatorToken = signAdmin({ id: operator.insertId, username: 'health-oper', role: 'operator' });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const url = '/medical-profiles/workers/' + worker.insertId;
  async function request(endpoint, method = 'GET', body, expected = 200, token = adminToken) {
    const response = await fetch(base + endpoint, {
      method,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const result = await response.json();
    assert.equal(response.status, expected, endpoint + ': ' + JSON.stringify(result));
    return { result, response };
  }
  try {
    await request(url, 'GET', undefined, 403, operatorToken);
    await request(url, 'PUT', emptyMedicalProfile(), 403, operatorToken);
    const initial = (await request(url)).result.profile;
    assert.equal(initial.revision, 0);
    assert.equal(initial.conditions.epilepsia.answer, '');
    const record = structuredClone(initial);
    record.filledOn = '2026-10-10';
    record.bloodType = 'O+';
    record.conditions.epilepsia.answer = 'NO';
    record.conditions.alergias.answer = 'SI';
    record.conditions.alergias.notes = 'Registro ficticio de prueba';
    const saved = (await request(url, 'PUT', record)).result.profile;
    assert.equal(saved.revision, 1);
    assert.equal(saved.bloodType, 'O+');
    const { result: retrieved, response } = await request(url);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.deepEqual(retrieved.profile.conditions, record.conditions);
    assert.equal(retrieved.profile.filledOn, record.filledOn);
    await request(url, 'PUT', record, 409);
    const changed = structuredClone(saved);
    changed.conditions.alergias.answer = 'NO';
    const second = (await request(url, 'PUT', changed)).result.profile;
    assert.equal(second.revision, 2);
    assert.equal(second.conditions.alergias.answer, 'NO');
    // "Quitar selección" deja el antecedente sin informar sin borrar sus observaciones.
    const cleared = structuredClone(second);
    cleared.conditions.alergias.answer = '';
    const clearedResult = (await request(url, 'PUT', cleared)).result.profile;
    assert.equal(clearedResult.revision, 3);
    assert.equal(clearedResult.conditions.alergias.answer, '');
    assert.equal(clearedResult.conditions.alergias.notes, 'Registro ficticio de prueba');
    assert.equal(clearedResult.conditions.epilepsia.answer, 'NO');
    const invalid = structuredClone(clearedResult);
    invalid.filledOn = '2026-02-30';
    await request(url, 'PUT', invalid, 400);
    const [audit] = await pool.execute(
      "SELECT details FROM audit_logs WHERE entity_type='worker_medical_profile' AND entity_id=? ORDER BY id",
      [String(worker.insertId)]
    );
    assert.equal(audit.length, 3);
    for (const row of audit) {
      assert.ok(!row.details.includes('alergias'));
      assert.ok(!row.details.includes('Registro ficticio'));
      assert.ok(!row.details.includes('O+'));
    }
    const file = (await request('/employee-files', 'GET', undefined, 200, operatorToken)).result;
    assert.ok(!JSON.stringify(file).includes('Registro ficticio'));
    assert.ok(!JSON.stringify(file).includes('conditions'));
    assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0], []);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});
