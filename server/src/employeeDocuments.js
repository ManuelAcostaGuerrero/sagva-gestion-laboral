import { validContractDate } from './employeeContracts.js';
import { normalizeWorkLabel } from './workPositions.js';

export const normalizeDocumentName = normalizeWorkLabel;
export const expiryModes = ['NONE', 'PERIOD', 'MANUAL', 'EVENT'];
export const expiryUnits = ['DAYS', 'WEEKS', 'MONTHS', 'YEARS'];

export function calculateDocumentExpiry(startDate, count, unit) {
  if (!validContractDate(startDate) || !Number.isInteger(count) || count < 1 || count > 1200 || !expiryUnits.includes(unit)) {
    throw Object.assign(new Error('Fecha o período de vencimiento inválido.'), { status: 400 });
  }
  const [year, month, day] = startDate.split('-').map(Number);
  let date;
  if (unit === 'DAYS' || unit === 'WEEKS') {
    date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + count * (unit === 'WEEKS' ? 7 : 1));
  } else {
    const targetMonths = (year * 12 + month - 1) + count * (unit === 'YEARS' ? 12 : 1);
    const targetYear = Math.floor(targetMonths / 12);
    const targetMonth = targetMonths % 12;
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    date = new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)));
  }
  return date.toISOString().slice(0, 10);
}

export async function migrateEmployeeDocuments(connection) {
  const migrationId = '20261009_010_employee_documents';
  if ((await connection.execute('SELECT id FROM schema_migrations WHERE id=?', [migrationId]))[0].length) return;

  await connection.execScript([
    'CREATE TABLE employee_document_types (',
    'id INTEGER PRIMARY KEY AUTOINCREMENT,',
    'name TEXT COLLATE NOCASE NOT NULL UNIQUE,',
    "expiry_mode TEXT NOT NULL CHECK(expiry_mode IN ('NONE','PERIOD','MANUAL','EVENT')),",
    'period_value INTEGER CHECK(period_value IS NULL OR period_value BETWEEN 1 AND 1200),',
    "period_unit TEXT CHECK(period_unit IS NULL OR period_unit IN ('DAYS','WEEKS','MONTHS','YEARS')),",
    'created_by INTEGER REFERENCES admins(id),',
    "created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))",
    ');',
    'CREATE TABLE employee_document_entries (',
    'id INTEGER PRIMARY KEY AUTOINCREMENT,',
    'employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,',
    'document_type_id INTEGER NOT NULL REFERENCES employee_document_types(id) ON DELETE RESTRICT,',
    'document_name TEXT NOT NULL,',
    "expiry_mode TEXT NOT NULL CHECK(expiry_mode IN ('NONE','PERIOD','MANUAL','EVENT')),",
    'delivered_on TEXT NOT NULL, start_on TEXT, expires_on TEXT, version_label TEXT, notes TEXT,',
    'created_by INTEGER REFERENCES admins(id),',
    "created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))",
    ');',
    'CREATE INDEX employee_document_entries_worker ON employee_document_entries(employee_id,document_type_id,id DESC);',
    'CREATE TABLE employee_document_attachments (',
    'id INTEGER PRIMARY KEY AUTOINCREMENT,',
    'entry_id INTEGER NOT NULL REFERENCES employee_document_entries(id) ON DELETE RESTRICT,',
    'filename TEXT NOT NULL, pdf BLOB NOT NULL, sha256 TEXT NOT NULL,',
    'signed_physical INTEGER NOT NULL DEFAULT 0 CHECK(signed_physical IN (0,1)),',
    'signed_on TEXT, uploaded_by INTEGER REFERENCES admins(id),',
    "uploaded_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),",
    'UNIQUE(entry_id,sha256)',
    ');',
    'CREATE INDEX employee_document_attachments_entry ON employee_document_attachments(entry_id);'
  ].join('\n'));

  // Único documento precargado. El administrador incorporará los demás desde la interfaz.
  await connection.execute(
    'INSERT INTO employee_document_types(name,expiry_mode,period_value,period_unit) VALUES(?,?,?,?)',
    ['PACTO DE HORAS', 'PERIOD', 3, 'MONTHS']
  );
  await connection.execute('INSERT INTO schema_migrations(id) VALUES(?)', [migrationId]);
}


// Catálogo administrable sin modificar ni reconstruir las entregas/archivos existentes.
export async function migrateDocumentCatalog(connection) {
  const id = '20261009_011_document_catalog';
  if ((await connection.execute('SELECT id FROM schema_migrations WHERE id=?', [id]))[0].length) return;
  await connection.execScript([
    'ALTER TABLE employee_document_types ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN(0,1));',
    "ALTER TABLE employee_document_types ADD COLUMN applicability TEXT NOT NULL DEFAULT 'ALL' CHECK(applicability IN('ALL','SELECTED'));",
    'ALTER TABLE employee_document_types ADD COLUMN updated_by INTEGER REFERENCES admins(id);',
    "ALTER TABLE employee_document_types ADD COLUMN updated_at TEXT NOT NULL DEFAULT '2026-10-09 00:00:00';",
    'ALTER TABLE employee_document_types ADD COLUMN deactivation_reason TEXT;',
    'CREATE TABLE employee_document_applicability (',
    'type_id INTEGER NOT NULL REFERENCES employee_document_types(id) ON DELETE RESTRICT,',
    'employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,',
    'assigned_by INTEGER REFERENCES admins(id),',
    "assigned_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),",
    'PRIMARY KEY(type_id,employee_id));',
    'CREATE INDEX employee_document_applicability_worker ON employee_document_applicability(employee_id,type_id);'
  ].join('\n'));
  await connection.execute('INSERT INTO schema_migrations(id) VALUES(?)', [id]);
}

export const DOCUMENT_PHYSICAL_STATUS_MIGRATION='20261110_028_document_physical_status';
export async function migrateDocumentPhysicalStatus(db){
 if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[DOCUMENT_PHYSICAL_STATUS_MIGRATION]))[0].length)return;
 await db.execScript("CREATE TABLE employee_document_physical_status (employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT, document_type_id INTEGER NOT NULL REFERENCES employee_document_types(id) ON DELETE RESTRICT, status TEXT NOT NULL CHECK(status IN ('UNVERIFIED','AVAILABLE','MISSING')), revision INTEGER NOT NULL DEFAULT 1, updated_by INTEGER NOT NULL REFERENCES admins(id), updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')), PRIMARY KEY(employee_id,document_type_id));");
 await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[DOCUMENT_PHYSICAL_STATUS_MIGRATION]);
}
