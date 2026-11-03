export async function migrateEmployeeFiles(connection) {
  const id = "20261003_003_employee_files";
  const [applied] = await connection.execute(
    "SELECT id FROM schema_migrations WHERE id=?",
    [id],
  );
  if (applied.length) return;
  const [sequence] = await connection.execute(
    "SELECT seq FROM sqlite_sequence WHERE name='employees'",
  );
  // Rebuild only the parent table with foreign keys disabled by the migration
  // connection. IDs and all columns stay intact; references are checked before commit.
  const [tables] = await connection.execute(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='employees'",
  );
  const definition = tables[0].sql
    .replace(
      /CREATE TABLE(?: IF NOT EXISTS)?\s+["`]?employees["`]?/i,
      "CREATE TABLE employees_file_migration",
    )
    .replace(/(document_id\s+TEXT(?:\s+COLLATE\s+NOCASE)?)\s+NOT NULL/i, "$1");
  await connection.execScript(definition);
  const [columns] = await connection.execute("PRAGMA table_info(employees)");
  const names = columns.map((column) => `"${column.name}"`).join(",");
  await connection.execute(
    `INSERT INTO employees_file_migration (${names}) SELECT ${names} FROM employees`,
  );
  const [indexes] = await connection.execute(
    "SELECT sql FROM sqlite_master WHERE tbl_name='employees' AND sql IS NOT NULL AND type IN ('index','trigger')",
  );
  await connection.execScript(
    "DROP TABLE employees; ALTER TABLE employees_file_migration RENAME TO employees;",
  );
  if (sequence.length)
    await connection.execute(
      "UPDATE sqlite_sequence SET seq=max(seq,?) WHERE name='employees'",
      [sequence[0].seq],
    );
  for (const index of indexes) await connection.execScript(index.sql);
  await connection.execute(
    "UPDATE employees SET document_id=NULL WHERE trim(document_id)=''",
  );
  await connection.execScript(`
    CREATE UNIQUE INDEX employees_document_normalized ON employees (
      upper(replace(replace(replace(trim(document_id),'.',''),'-',''),' ',''))
    ) WHERE document_id IS NOT NULL;
    CREATE TABLE employee_files (
      employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE RESTRICT,
      validation_status TEXT NOT NULL DEFAULT 'NO_VALIDADO' CHECK(validation_status IN ('NO_VALIDADO','VALIDADO')),
      company TEXT, work_schedule TEXT, hire_date TEXT, termination_date TEXT, contract_type TEXT,
      employment_status TEXT, birth_date TEXT, address TEXT, phone TEXT, mobile TEXT,
      observations TEXT, extra_json TEXT NOT NULL DEFAULT '{}',
      revision INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), updated_by INTEGER REFERENCES admins(id)
    );
    CREATE TABLE employee_import_sources (
      source_key TEXT PRIMARY KEY, employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
      sheet TEXT NOT NULL, source_row INTEGER NOT NULL, source_values_json TEXT NOT NULL,
      imported_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    INSERT INTO employee_files(employee_id,employment_status)
      SELECT id, CASE WHEN is_active=1 THEN 'ACTIVO' ELSE 'INACTIVO' END FROM employees;
  `);
  await connection.execute("INSERT INTO schema_migrations(id) VALUES(?)", [id]);
}
