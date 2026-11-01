export async function migrateTokens(connection){
  const id='20261004_004_qr_tokens';
  if((await connection.execute('SELECT id FROM schema_migrations WHERE id=?',[id]))[0].length)return;
  await connection.execScript(`
    CREATE TABLE attendance_terminals(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,
      activation_hash TEXT UNIQUE,activation_expires INTEGER,token_hash TEXT UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1,activated_at TEXT,created_by INTEGER REFERENCES admins(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),revoked_at TEXT);
    CREATE TABLE worker_tokens(id INTEGER PRIMARY KEY AUTOINCREMENT,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
      token_hash TEXT NOT NULL UNIQUE,created_by INTEGER REFERENCES admins(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),revoked_at TEXT);
    CREATE UNIQUE INDEX worker_one_active_token ON worker_tokens(employee_id) WHERE revoked_at IS NULL;
    CREATE TABLE pin_attempts(id INTEGER PRIMARY KEY AUTOINCREMENT,terminal_id INTEGER NOT NULL REFERENCES attendance_terminals(id),
      employee_id INTEGER NOT NULL,attempted_at INTEGER NOT NULL,outcome TEXT NOT NULL);
    CREATE INDEX pin_attempt_lookup ON pin_attempts(employee_id,attempted_at);
    ALTER TABLE attendance_records ADD COLUMN mark_method TEXT;
    ALTER TABLE attendance_records ADD COLUMN terminal_id INTEGER REFERENCES attendance_terminals(id);
    ALTER TABLE attendance_records ADD COLUMN request_key TEXT;
    CREATE UNIQUE INDEX attendance_request_key ON attendance_records(request_key) WHERE request_key IS NOT NULL;
  `);
  await connection.execute('INSERT INTO schema_migrations(id) VALUES(?)',[id]);
}
