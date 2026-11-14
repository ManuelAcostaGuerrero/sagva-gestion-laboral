export const WORKER_QR_VAULT_MIGRATION='20261114_042_worker_qr_vault';
export async function migrateWorkerQrVault(db){
 const [done]=await db.execute('SELECT id FROM schema_migrations WHERE id=?',[WORKER_QR_VAULT_MIGRATION]);
 if(done.length)return;
 // Aditiva. No transforma hashes existentes: no es matemáticamente posible.
 await db.execute('ALTER TABLE worker_tokens ADD COLUMN token_ciphertext TEXT');
 await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[WORKER_QR_VAULT_MIGRATION]);
}
