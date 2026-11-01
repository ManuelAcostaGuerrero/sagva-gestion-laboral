export async function migrateWorkerIdentity(connection) {
  const id = '20261004_005_worker_identity';
  if ((await connection.execute('SELECT id FROM schema_migrations WHERE id=?', [id]))[0].length) return;
  for (const name of ['first_name','second_name','other_names','first_last_name','second_last_name','legal_full_name'])
    await connection.execute(`ALTER TABLE employees ADD COLUMN ${name} TEXT`);
  // Preserve the legal name literally; never rebuild it from proposed parts.
  await connection.execute('UPDATE employees SET legal_full_name=full_name');
  await connection.execScript(`
    ALTER TABLE employee_files ADD COLUMN is_validated INTEGER NOT NULL DEFAULT 0 CHECK(is_validated IN (0,1));
    ALTER TABLE employee_files ADD COLUMN validated_at TEXT;
    ALTER TABLE employee_files ADD COLUMN validated_by INTEGER REFERENCES admins(id);
    ALTER TABLE employee_files ADD COLUMN validation_notes TEXT;
    UPDATE employee_files SET is_validated=CASE WHEN validation_status='VALIDADO' THEN 1 ELSE 0 END;
    CREATE TRIGGER employee_legal_name_on_insert AFTER INSERT ON employees
    WHEN NEW.legal_full_name IS NULL BEGIN
      UPDATE employees SET legal_full_name=NEW.full_name WHERE id=NEW.id;
    END;
  `);
  const [files] = await connection.execute('SELECT employee_id,extra_json FROM employee_files');
  for (const file of files) {
    const extra = JSON.parse(file.extra_json || '{}');
    const parts = String(extra.firstName || '').trim().split(/\s+/).filter(Boolean);
    await connection.execute('UPDATE employees SET first_name=?,second_name=?,other_names=?,first_last_name=?,second_last_name=? WHERE id=?',
      [parts[0] || null,parts[1] || null,parts.slice(2).join(' ') || null,extra.paternalLastName || null,extra.maternalLastName || null,file.employee_id]);
  }
  await connection.execute('INSERT INTO schema_migrations(id) VALUES(?)',[id]);
}
