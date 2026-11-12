export const BONUS_MIGRATION='20261110_028_labor_bonus_catalog';

export async function migrateLaborBonuses(db) {
 const [existing]=await db.execute('SELECT id FROM schema_migrations WHERE id=?',[BONUS_MIGRATION]);
 if(existing.length)return;
 await db.execScript([
  "CREATE TABLE labor_bonus_definitions (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('BONO','VIATICO','OTRO')), amount_clp INTEGER NOT NULL DEFAULT 0 CHECK(amount_clp>=0), taxable INTEGER NOT NULL DEFAULT 1 CHECK(taxable IN (0,1)), overtime_base INTEGER NOT NULL DEFAULT 0 CHECK(overtime_base IN (0,1)), with_clause INTEGER NOT NULL DEFAULT 0 CHECK(with_clause IN (0,1)), clause_text TEXT NOT NULL DEFAULT '', evaluation_rules TEXT NOT NULL DEFAULT '', legal_reviewed INTEGER NOT NULL DEFAULT 0 CHECK(legal_reviewed IN (0,1)), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), revision INTEGER NOT NULL DEFAULT 1, updated_by INTEGER REFERENCES admins(id), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);",
  "CREATE TABLE labor_bonus_definition_history (id INTEGER PRIMARY KEY AUTOINCREMENT, bonus_id INTEGER NOT NULL REFERENCES labor_bonus_definitions(id), revision INTEGER NOT NULL, snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)), changed_by INTEGER REFERENCES admins(id), changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(bonus_id,revision));",
  "CREATE TABLE employee_bonus_assignments (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT, bonus_id INTEGER NOT NULL REFERENCES labor_bonus_definitions(id) ON DELETE RESTRICT, amount_override_clp INTEGER CHECK(amount_override_clp IS NULL OR amount_override_clp>=0), valid_from TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), revision INTEGER NOT NULL DEFAULT 1, updated_by INTEGER REFERENCES admins(id), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(employee_id,bonus_id));",
  "CREATE INDEX employee_bonuses_worker ON employee_bonus_assignments(employee_id,active);",
  "CREATE TABLE employee_bonus_assignment_history (id INTEGER PRIMARY KEY AUTOINCREMENT, assignment_id INTEGER NOT NULL REFERENCES employee_bonus_assignments(id), revision INTEGER NOT NULL, snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)), changed_by INTEGER REFERENCES admins(id), changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(assignment_id,revision));",
  "CREATE TABLE employee_bonus_evaluations (id INTEGER PRIMARY KEY AUTOINCREMENT, assignment_id INTEGER NOT NULL REFERENCES employee_bonus_assignments(id), period TEXT NOT NULL, planned_units INTEGER NOT NULL CHECK(planned_units>0), correct_units INTEGER NOT NULL CHECK(correct_units>=0 AND correct_units<=planned_units), suggested_clp INTEGER NOT NULL CHECK(suggested_clp>=0), evidence TEXT NOT NULL DEFAULT '', bonus_snapshot_json TEXT NOT NULL CHECK(json_valid(bonus_snapshot_json)), status TEXT NOT NULL DEFAULT 'PENDIENTE_REVISION' CHECK(status='PENDIENTE_REVISION'), revision INTEGER NOT NULL DEFAULT 1, evaluated_by INTEGER REFERENCES admins(id), evaluated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(assignment_id,period));",
  "CREATE TABLE employee_bonus_evaluation_history (id INTEGER PRIMARY KEY AUTOINCREMENT, evaluation_id INTEGER NOT NULL REFERENCES employee_bonus_evaluations(id), revision INTEGER NOT NULL, snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)), changed_by INTEGER REFERENCES admins(id), changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(evaluation_id,revision));"
 ].join('\n'));
 await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[BONUS_MIGRATION]);
}

// Solo simulación para revisión: jamás modificar automáticamente remuneraciones.
export function calculateBonusPreview(amountClp,plannedUnits,correctUnits){
 if(!Number.isSafeInteger(amountClp)||amountClp<0||!Number.isSafeInteger(plannedUnits)||plannedUnits<1||!Number.isSafeInteger(correctUnits)||correctUnits<0||correctUnits>plannedUnits)
  throw new Error('Evaluación de bono inválida.');
 return Math.round(amountClp*correctUnits/plannedUnits);
}

/* Campo aditivo: observación individual sin modificar bonos ni asignaciones existentes.
   La casilla «Imponible» y la cláusula siguen siendo propiedades del catálogo. */
export const BONUS_NOTES_MIGRATION='20261111_036_bonus_assignment_notes';
export async function migrateLaborBonusNotes(db){
 const [existing]=await db.execute('SELECT id FROM schema_migrations WHERE id=?',[BONUS_NOTES_MIGRATION]);
 if(existing.length)return;
 const [columns]=await db.execute('PRAGMA table_info(employee_bonus_assignments)');
 if(!columns.some(column=>column.name==='notes')){
  await db.execute("ALTER TABLE employee_bonus_assignments ADD COLUMN notes TEXT NOT NULL DEFAULT ''");
 }
 await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[BONUS_NOTES_MIGRATION]);
}
