export const BANK_AUTH_MIGRATION='20261110_029_bank_third_party_authorization';
export async function migrateBankAuthorizations(db){
 if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[BANK_AUTH_MIGRATION]))[0].length)return;
 await db.execScript([
  "CREATE TABLE employee_bank_authorizations (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT, pdf_ciphertext TEXT NOT NULL, sha256 TEXT NOT NULL, uploaded_by INTEGER REFERENCES admins(id), uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(employee_id,sha256));",
  "CREATE INDEX employee_bank_authorizations_employee ON employee_bank_authorizations(employee_id,id);"
 ].join('\n'));
 await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[BANK_AUTH_MIGRATION]);
}

 
// Migración destructiva solicitada: retirar requestedOn incluso del historial
// cifrado, sin alterar revisiones, sellos de auditoría o datos bancarios restantes.
import {bankReady,encryptBank,decryptBank} from './benefitSecurity.js';
export const BANK_PURGE_REQUESTED_ON='20261113_041_purge_bank_requested_on';
export async function migrateBankRequestedOn(db){
 const [done]=await db.execute('SELECT id FROM schema_migrations WHERE id=?',[BANK_PURGE_REQUESTED_ON]);
 if(done.length)return;
 // Sin la clave no podemos descifrar. No declarar migración aplicada;
 // la operación se ejecutará al iniciar con la clave configurada.
 if(!bankReady())return;
 let removed=0;
 for(const table of ['employee_bank_accounts','employee_bank_account_history']){
  const key=table==='employee_bank_accounts'?'employee_id':'id';
  const [rows]=await db.execute('SELECT '+key+' AS recordId,payload_ciphertext AS payload FROM '+table);
  for(const row of rows){
   const data=decryptBank(row.payload);
   if(!Object.hasOwn(data,'requestedOn'))continue;
   delete data.requestedOn;
   await db.execute('UPDATE '+table+' SET payload_ciphertext=? WHERE '+key+'=?',[encryptBank(data),row.recordId]);
   removed++;
  }
 }
 await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[BANK_PURGE_REQUESTED_ON]);
 return removed;
}
