export const BANK_AUTH_MIGRATION='20261110_029_bank_third_party_authorization';
export async function migrateBankAuthorizations(db){
 if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[BANK_AUTH_MIGRATION]))[0].length)return;
 await db.execScript([
  "CREATE TABLE employee_bank_authorizations (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT, pdf_ciphertext TEXT NOT NULL, sha256 TEXT NOT NULL, uploaded_by INTEGER REFERENCES admins(id), uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(employee_id,sha256));",
  "CREATE INDEX employee_bank_authorizations_employee ON employee_bank_authorizations(employee_id,id);"
 ].join('\n'));
 await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[BANK_AUTH_MIGRATION]);
}
