import { runMigrations } from './migrations.js';
import { pool } from './db.js';

export async function ensureAuditLogTable() {
  await runMigrations();
}

export async function recordAudit(admin, action, entityType, entityId, details = {}, executor = pool) {
  await ensureAuditLogTable();
  await executor.execute(
    `INSERT INTO audit_logs (admin_id, admin_username, action, entity_type, entity_id, details)
     VALUES (:adminId, :adminUsername, :action, :entityType, :entityId, json(:details))`,
    {
      adminId: admin?.id || null,
      adminUsername: admin?.username || null,
      action,
      entityType,
      entityId: entityId == null ? null : String(entityId),
      details: JSON.stringify(details)
    }
  );
}
