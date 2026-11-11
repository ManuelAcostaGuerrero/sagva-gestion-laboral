export const FAMILY_INCOME_MIGRATION='20261110_030_family_income_reference';
export async function migrateFamilyIncome(db){
 if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[FAMILY_INCOME_MIGRATION]))[0].length)return;
 await db.execScript([
  "CREATE TABLE employee_family_income_reference (employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE RESTRICT, average_income_clp INTEGER CHECK(average_income_clp IS NULL OR average_income_clp>=0), income_period TEXT NOT NULL DEFAULT '', verified INTEGER NOT NULL DEFAULT 0 CHECK(verified IN (0,1)), updated_by INTEGER REFERENCES admins(id), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);"
 ].join('\n'));
 await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[FAMILY_INCOME_MIGRATION]);
}
