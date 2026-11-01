export const TERMS_MIGRATION='20261011_016_contract_terms';
export const blankContractTerms=()=>({
 revision:0,monthlyBaseSalary:'',gratification:'',weeklyHours:'',
 shiftDistribution:'',breakMinutes:'',workplace:'',paymentMethod:'',
 jobDuties:'',additionalTerms:''
});
export async function migrateContractTerms(db){
 if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[TERMS_MIGRATION]))[0].length)return;
 await db.execScript(`
  CREATE TABLE employee_contract_terms(
   employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE RESTRICT,
   terms_json TEXT NOT NULL CHECK(json_valid(terms_json)),
   revision INTEGER NOT NULL DEFAULT 1,
   created_by INTEGER REFERENCES admins(id),
   updated_by INTEGER REFERENCES admins(id),
   updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE TABLE employee_contract_terms_history(
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
   revision INTEGER NOT NULL,
   snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
   changed_by INTEGER REFERENCES admins(id),
   changed_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
   UNIQUE(employee_id,revision)
  );
 `);
 await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[TERMS_MIGRATION]);
}
