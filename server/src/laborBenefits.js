
export const LABOR_BENEFITS_MIGRATION = '20261109_023_labor_benefits';
export const BANKS_CMF_SOURCE = 'https://www.cmfchile.cl/portal/principal/623/w4-propertyvalue-29280.html';
export const FAMILY_SUSESO_SOURCE = 'https://www.suseso.gob.cl/606/w3-article-498133.html';

// Catálogos y registros independientes de la ficha genérica. Migración aditiva.
export async function migrateLaborBenefits(db) {
  const [applied] = await db.execute('SELECT id FROM schema_migrations WHERE id=?',[LABOR_BENEFITS_MIGRATION]);
  if (applied.length) return;
  await db.execScript([
    "CREATE TABLE IF NOT EXISTS labor_banks (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), source_url TEXT, revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);",
    "CREATE TABLE IF NOT EXISTS labor_bank_history (id INTEGER PRIMARY KEY AUTOINCREMENT, bank_id INTEGER NOT NULL REFERENCES labor_banks(id) ON DELETE RESTRICT, before_json TEXT, after_json TEXT NOT NULL, reason TEXT NOT NULL, changed_by INTEGER REFERENCES admins(id), changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);",
    "CREATE TABLE IF NOT EXISTS labor_family_bracket_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, group_code TEXT NOT NULL, tier INTEGER NOT NULL CHECK(tier BETWEEN 1 AND 4), income_from INTEGER NOT NULL CHECK(income_from>=0), income_to INTEGER CHECK(income_to IS NULL OR income_to>=income_from), amount_clp INTEGER NOT NULL CHECK(amount_clp>=0), effective_from TEXT NOT NULL, income_reference TEXT NOT NULL, reason TEXT NOT NULL, source_url TEXT, created_by INTEGER REFERENCES admins(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(group_code,tier));",
    "CREATE INDEX IF NOT EXISTS labor_family_bracket_date ON labor_family_bracket_versions(effective_from,id);",
    "CREATE TABLE IF NOT EXISTS employee_family_state (employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE RESTRICT, status TEXT NOT NULL DEFAULT 'NONE' CHECK(status IN ('NONE','PENDING','RECOGNIZED')), revision INTEGER NOT NULL DEFAULT 1, updated_by INTEGER REFERENCES admins(id), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);",
    "CREATE TABLE IF NOT EXISTS employee_family_dependents (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT, full_name TEXT NOT NULL, relationship TEXT NOT NULL, recognition_status TEXT NOT NULL CHECK(recognition_status IN ('PENDING','RECOGNIZED','ENDED')), institution TEXT, recognition_date TEXT, valid_from TEXT, valid_until TEXT, reference_code TEXT, updated_by INTEGER REFERENCES admins(id), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);",
    "CREATE INDEX IF NOT EXISTS employee_family_by_worker ON employee_family_dependents(employee_id,id);",
    "CREATE TABLE IF NOT EXISTS employee_family_history (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT, revision INTEGER NOT NULL, before_status TEXT, after_status TEXT NOT NULL, changed_ids_json TEXT NOT NULL, snapshot_before_json TEXT, snapshot_after_json TEXT, changed_by INTEGER REFERENCES admins(id), changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);",
    "CREATE TABLE IF NOT EXISTS employee_bank_accounts (employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE RESTRICT, payload_ciphertext TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_by INTEGER REFERENCES admins(id), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);",
    "CREATE TABLE IF NOT EXISTS employee_bank_account_history (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT, revision INTEGER NOT NULL, payload_ciphertext TEXT NOT NULL, superseded_by INTEGER REFERENCES admins(id), archived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);"
  ].join('\n'));
  const banks = [
    ['001','BANCO DE CHILE'],['009','BANCO INTERNACIONAL'],['012','BANCO DEL ESTADO DE CHILE'],
    ['014','SCOTIABANK CHILE'],['016','BANCO DE CRÉDITO E INVERSIONES'],['028','BANCO BICE'],
    ['031','HSBC BANK (CHILE)'],['037','BANCO SANTANDER-CHILE'],['039','BANCO ITAÚ CHILE'],
    ['041','JP MORGAN CHASE BANK, N.A.'],['051','BANCO FALABELLA'],['053','BANCO RIPLEY'],
    ['055','BANCO CONSORCIO'],['059','BANCO BTG PACTUAL CHILE'],
    ['060','CHINA CONSTRUCTION BANK, AGENCIA EN CHILE'],['061','BANK OF CHINA, AGENCIA EN CHILE'],
    ['062','TANNER BANCO DIGITAL'],['063','TENPO BANK CHILE']
  ];
  for (const [code,name] of banks) await db.execute('INSERT INTO labor_banks(code,name,source_url) VALUES(?,?,?)',[code,name,BANKS_CMF_SOURCE]);
  // Mayo y julio comparten montos; cambia el semestre de ingresos de referencia.
  for (const [group,effective,reference] of [
    ['SUSESO_2026_05','2026-05-01','enero a junio de 2025'],
    ['SUSESO_2026_07','2026-07-01','enero a junio de 2026']
  ]) {
    for (const [tier,from,to,amount] of [
      [1,0,649039,22601],[2,649040,947990,13870],[3,947991,1478539,4382],[4,1478540,null,0]
    ]) await db.execute('INSERT INTO labor_family_bracket_versions(group_code,tier,income_from,income_to,amount_clp,effective_from,income_reference,reason,source_url) VALUES(?,?,?,?,?,?,?,?,?)',
      [group,tier,from,to,amount,effective,reference,'Precarga normativa SUSESO 2026',FAMILY_SUSESO_SOURCE]);
  }
  await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[LABOR_BENEFITS_MIGRATION]);
}
