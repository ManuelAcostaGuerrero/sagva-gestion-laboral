import { runMigrations } from '../migrations.js';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { pool } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requireRoles } from '../auth.js';
import { ensureAdminSecuritySchema } from '../adminSecurity.js';
import { ensureAuditLogTable, recordAudit } from '../auditLog.js';

export const adminRouter = Router();

const adminUserSchema = z.object({
  username: z.string().min(3).max(60),
  fullName: z.string().min(3).max(120),
  password: z.string().min(8),
  role: z.enum(['admin', 'supervisor', 'operator'])
});

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'supervisor', 'operator'])
});

const backupCodeSchema = z.object({
  currentPassword: z.string().min(6)
});

const adminFingerprintSchema = z.object({
  template: z.string().min(10).optional(),
  templates: z.array(z.string().min(10)).min(1).max(4).optional()
}).refine((data) => data.template || data.templates?.length, {
  message: 'Debe enviar una o mas muestras de huella'
});

async function ensureAdminFingerprintsTable() {
  await runMigrations();
}

adminRouter.use(requireRoles('admin'));

adminRouter.get('/users', asyncHandler(async (_req, res) => {
  await ensureAdminSecuritySchema();
  await ensureAdminFingerprintsTable();
  const [users] = await pool.execute(
    `SELECT a.id, a.username, a.full_name AS fullName, a.role, a.created_at AS createdAt,
            COUNT(af.id) AS fingerprints
     FROM admins a
     LEFT JOIN admin_fingerprints af ON af.admin_id = a.id
     GROUP BY a.id
     ORDER BY full_name`
  );
  res.json({ users });
}));

adminRouter.post('/users', asyncHandler(async (req, res) => {
  await ensureAdminSecuritySchema();
  const parsed = adminUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos de usuario administrativo invalidos' });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const [result] = await pool.execute(
    `INSERT INTO admins (username, password_hash, full_name, role)
     VALUES (:username, :passwordHash, :fullName, :role)`,
    {
      username: parsed.data.username,
      passwordHash,
      fullName: parsed.data.fullName,
      role: parsed.data.role
    }
  );

  await recordAudit(req.admin, 'create', 'admin_user', result.insertId, {
    username: parsed.data.username,
    role: parsed.data.role
  });

  res.status(201).json({ id: result.insertId });
}));

adminRouter.put('/users/:id/role', asyncHandler(async (req, res) => {
  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Rol invalido' });
  }

  const adminId = Number(req.params.id);
  const [result] = await pool.execute(
    'UPDATE admins SET role = :role WHERE id = :adminId',
    { adminId, role: parsed.data.role }
  );

  if (!result.affectedRows) {
    return res.status(404).json({ message: 'Usuario administrativo no encontrado' });
  }

  await recordAudit(req.admin, 'update_role', 'admin_user', adminId, { role: parsed.data.role });
  res.json({ message: 'Rol actualizado' });
}));

adminRouter.put('/users/:id/fingerprint', (_req,res)=>res.status(410).json({message:'Método de identificación retirado. Usa QR o PIN en una terminal autorizada.'}));
adminRouter.get('/audit', asyncHandler(async (_req, res) => {
  await ensureAuditLogTable();
  const [logs] = await pool.execute(
    `SELECT id, admin_username AS adminUsername, action, entity_type AS entityType,
            entity_id AS entityId, details, created_at AS createdAt
     FROM audit_logs
     ORDER BY created_at DESC
     LIMIT 80`
  );
  // MySQL entregaba JSON como objeto; SQLite lo almacena como texto.
  res.json({ logs: logs.map(log => ({
    ...log,
    details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details
  })) });
}));

adminRouter.get('/backup-codes/status', asyncHandler(async (req, res) => {
  await ensureAdminSecuritySchema();
  const [rows] = await pool.execute(
    `SELECT
       COUNT(*) AS totalCodes,
       SUM(CASE WHEN used_at IS NULL THEN 1 ELSE 0 END) AS availableCodes
     FROM admin_backup_codes
     WHERE admin_id = :adminId`,
    { adminId: req.admin.id }
  );
  res.json({
    totalCodes: Number(rows[0]?.totalCodes || 0),
    availableCodes: Number(rows[0]?.availableCodes || 0)
  });
}));

adminRouter.post('/backup-codes', asyncHandler(async (req, res) => {
  await ensureAdminSecuritySchema();
  const parsed = backupCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Debes confirmar tu clave actual' });
  }

  const [admins] = await pool.execute(
    'SELECT id, password_hash AS passwordHash FROM admins WHERE id = :adminId LIMIT 1',
    { adminId: req.admin.id }
  );
  const admin = admins[0];
  if (!admin || !(await bcrypt.compare(parsed.data.currentPassword, admin.passwordHash))) {
    return res.status(401).json({ message: 'La clave actual no coincide' });
  }

  const codes = Array.from({ length: 8 }, () => {
    const raw = Math.random().toString(36).slice(2, 6).toUpperCase();
    const tail = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${raw}-${tail}`;
  });

  await pool.execute('DELETE FROM admin_backup_codes WHERE admin_id = :adminId', { adminId: req.admin.id });
  for (const code of codes) {
    await pool.execute(
      `INSERT INTO admin_backup_codes (admin_id, code_hash)
       VALUES (:adminId, :codeHash)`,
      { adminId: req.admin.id, codeHash: await bcrypt.hash(code, 10) }
    );
  }

  await recordAudit(req.admin, 'regenerate', 'backup_codes', req.admin.id, { count: codes.length });
  res.status(201).json({ codes });
}));
