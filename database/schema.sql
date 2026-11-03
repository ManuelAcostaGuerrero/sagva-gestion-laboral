CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT COLLATE NOCASE NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'supervisor', 'operator')) NOT NULL DEFAULT 'admin',
  totp_secret TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT FALSE,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT COLLATE NOCASE UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  position_name TEXT,
  work_area_id INTEGER NULL,
  is_active INTEGER NOT NULL DEFAULT TRUE,
  access_code_enabled INTEGER NOT NULL DEFAULT FALSE,
  access_code_hash TEXT,
  deleted_at TEXT NULL,
  deleted_by INTEGER NULL,
  deletion_reason TEXT,
  reactivated_at TEXT NULL,
  reactivated_by INTEGER NULL,
  reactivation_reason TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS work_areas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT COLLATE NOCASE NOT NULL UNIQUE,
  description TEXT,
  required_staff INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT TRUE,
  created_by INTEGER NULL,
  deactivated_at TEXT NULL,
  deactivated_by INTEGER NULL,
  deactivation_reason TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  CONSTRAINT fk_work_areas_created_by
    FOREIGN KEY (created_by) REFERENCES admins(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_work_areas_deactivated_by
    FOREIGN KEY (deactivated_by) REFERENCES admins(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS work_positions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT COLLATE NOCASE NOT NULL UNIQUE,
 description TEXT,
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN(0,1)),
 created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
 deactivated_at TEXT,
 deactivated_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
 deactivation_reason TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TRIGGER IF NOT EXISTS work_positions_updated_at AFTER UPDATE ON work_positions
BEGIN UPDATE work_positions SET updated_at=datetime('now','localtime') WHERE id=NEW.id; END;

CREATE TABLE IF NOT EXISTS employee_document_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  old_document_id TEXT NOT NULL,
  new_document_id TEXT NOT NULL,
  changed_by INTEGER,
  reason TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  CONSTRAINT fk_document_history_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_document_history_admin
    FOREIGN KEY (changed_by) REFERENCES admins(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS fingerprints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  finger_label TEXT NOT NULL DEFAULT 'indice_derecho',
  template TEXT NOT NULL,
  template_hash TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  UNIQUE (employee_id, finger_label),
  CONSTRAINT fk_fingerprints_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  record_type TEXT CHECK (record_type IN ('entrada', 'salida', 'salida_colacion', 'entrada_colacion')) NOT NULL,
  registered_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  device_name TEXT DEFAULT 'Terminal',
  notes TEXT,
  is_void INTEGER NOT NULL DEFAULT FALSE,
  voided_at TEXT NULL,
  voided_by INTEGER NULL,
  void_reason TEXT,
  correction_reason TEXT,
  created_by_admin_id INTEGER NULL,
  CONSTRAINT fk_attendance_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER,
  admin_username TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  CONSTRAINT fk_audit_admin
    FOREIGN KEY (admin_id) REFERENCES admins(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS admin_backup_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  code_hash TEXT NOT NULL,
  used_at TEXT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  CONSTRAINT fk_backup_codes_admin
    FOREIGN KEY (admin_id) REFERENCES admins(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_fingerprints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  template TEXT NOT NULL,
  template_hash TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  UNIQUE (admin_id),
  CONSTRAINT fk_admin_fingerprints_admin
    FOREIGN KEY (admin_id) REFERENCES admins(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL UNIQUE,
  subscription_json TEXT NOT NULL,
  user_agent TEXT,
  is_active INTEGER NOT NULL DEFAULT TRUE,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS work_shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT COLLATE NOCASE NOT NULL UNIQUE,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT TRUE,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS employee_shift_assignments (
  employee_id INTEGER PRIMARY KEY,
  shift_id INTEGER NOT NULL,
  assigned_at TEXT DEFAULT (datetime('now', 'localtime')),
  CONSTRAINT fk_shift_assignment_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_shift_assignment_shift
    FOREIGN KEY (shift_id) REFERENCES work_shifts(id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS employee_shift_calendar (
  employee_id INTEGER NOT NULL,
  work_date TEXT NOT NULL,
  shift_id INTEGER NULL,
  day_type TEXT CHECK (day_type IN ('work', 'rest', 'leave', 'permit', 'absence')) NOT NULL DEFAULT 'work',
  assigned_at TEXT DEFAULT (datetime('now', 'localtime')),
  PRIMARY KEY (employee_id, work_date),
  CONSTRAINT fk_shift_calendar_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_shift_calendar_shift
    FOREIGN KEY (shift_id) REFERENCES work_shifts(id)
    ON DELETE RESTRICT
);

INSERT INTO system_settings (setting_key, setting_value)
VALUES
  ('timeMode', 'auto'),
  ('country', 'Chile'),
  ('timeZone', 'America/Santiago'),
  ('manualUtcOffset', '-03:00'),
  ('companyName', 'Red Taurus Codex Asistencia'),
  ('companyTagline', 'Control de asistencia y permanencia'),
  ('workdayTargetHours', '8'),
  ('lateToleranceMinutes', '10')
ON CONFLICT(setting_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_employee_document_history_employee ON employee_document_history (employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records (registered_at);
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_records (employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_shift_calendar_date ON employee_shift_calendar (work_date);

CREATE TRIGGER IF NOT EXISTS work_areas_updated_at AFTER UPDATE ON work_areas
BEGIN
  UPDATE work_areas SET updated_at = datetime('now', 'localtime') WHERE rowid = NEW.rowid;
END;

CREATE TRIGGER IF NOT EXISTS system_settings_updated_at AFTER UPDATE ON system_settings
BEGIN
  UPDATE system_settings SET updated_at = datetime('now', 'localtime') WHERE rowid = NEW.rowid;
END;

CREATE TRIGGER IF NOT EXISTS push_subscriptions_updated_at AFTER UPDATE ON push_subscriptions
BEGIN
  UPDATE push_subscriptions SET updated_at = datetime('now', 'localtime') WHERE rowid = NEW.rowid;
END;


CREATE INDEX IF NOT EXISTS idx_attendance_void ON attendance_records (is_void);
CREATE INDEX IF NOT EXISTS idx_backup_codes_admin ON admin_backup_codes (admin_id);
