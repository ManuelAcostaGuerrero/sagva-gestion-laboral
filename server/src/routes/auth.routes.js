import { runMigrations } from '../migrations.js';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import qrcode from 'qrcode';
import { generateSecret, generateURI, verify } from 'otplib';
import { pool } from '../db.js';
import { signAdmin, requireAdmin } from '../auth.js';
import { asyncHandler } from '../asyncHandler.js';
import { ensureAdminMfaColumns } from '../adminMfa.js';
import { ensureAdminSecuritySchema } from '../adminSecurity.js';
import { recordAudit } from '../auditLog.js';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6)
});

const fingerprintLoginSchema = z.object({
  template: z.string().min(10)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6).optional(),
  otpCode: z.string().trim().regex(/^\d{6}$/).optional(),
  newPassword: z.string().min(8)
}).refine((data) => data.currentPassword || data.otpCode, {
  message: 'Debes ingresar la clave actual o un codigo del autenticador'
});

const setupMfaSchema = z.object({
  currentPassword: z.string().min(6)
});

const confirmMfaSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/)
});

const recoverPasswordSchema = z.object({
  username: z.string().min(3),
  otpCode: z.string().trim().regex(/^\d{6}$/),
  newPassword: z.string().min(8)
});

const recoverPasswordBackupSchema = z.object({
  username: z.string().min(3),
  backupCode: z.string().trim().min(8),
  newPassword: z.string().min(8)
});

async function ensureAdminFingerprintsTable() {
  await runMigrations();
}

authRouter.post('/login', asyncHandler(async (req, res) => {
  await ensureAdminMfaColumns();
  await ensureAdminSecuritySchema();
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos de acceso invalidos' });
  }

  const [rows] = await pool.execute(
    'SELECT id, username, password_hash, full_name, role FROM admins WHERE username = :username LIMIT 1',
    { username: parsed.data.username }
  );

  const admin = rows[0];
  if (!admin || !(await bcrypt.compare(parsed.data.password, admin.password_hash))) {
    return res.status(401).json({ message: 'Usuario o clave incorrectos' });
  }

  res.json({
    token: signAdmin(admin),
    admin: { id: admin.id, username: admin.username, fullName: admin.full_name, role: admin.role }
  });
}));

authRouter.post('/login-fingerprint', (_req,res)=>res.status(410).json({message:'Método de identificación retirado. Usa QR o PIN en una terminal autorizada.'}));
authRouter.get('/me', requireAdmin, asyncHandler(async (req, res) => {
  await ensureAdminMfaColumns();
  await ensureAdminSecuritySchema();
  const [rows] = await pool.execute(
    'SELECT id, username, full_name, role FROM admins WHERE id = :id',
    { id: req.admin.id }
  );

  res.json({ admin: rows[0] ? {...rows[0],accessProfile:req.admin.profile||null} : null });
}));

authRouter.post('/refresh-session', requireAdmin, asyncHandler(async (req, res) => {
  await ensureAdminSecuritySchema();
  const [rows] = await pool.execute(
    'SELECT id, username, full_name, role FROM admins WHERE id = :id LIMIT 1',
    { id: req.admin.id }
  );

  const admin = rows[0];
  if (!admin) {
    return res.status(404).json({ message: 'Administrador no encontrado' });
  }

  res.json({
    token: signAdmin(admin),
    admin: { id: admin.id, username: admin.username, fullName: admin.full_name, role: admin.role }
  });
}));

authRouter.put('/password', requireAdmin, asyncHandler(async (req, res) => {
  await ensureAdminMfaColumns();
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos para cambiar clave invalidos' });
  }

  const [rows] = await pool.execute(
    'SELECT id, password_hash, totp_secret AS totpSecret, totp_enabled AS totpEnabled FROM admins WHERE id = :id LIMIT 1',
    { id: req.admin.id }
  );

  const admin = rows[0];
  const validCurrentPassword = parsed.data.currentPassword
    ? await bcrypt.compare(parsed.data.currentPassword, admin?.password_hash || '')
    : false;
  const otpResult = parsed.data.otpCode && admin?.totpEnabled && admin?.totpSecret
    ? await verify({ token: parsed.data.otpCode, secret: admin.totpSecret })
    : { valid: false };
  const validOtp = Boolean(otpResult.valid);

  if (!admin || (!validCurrentPassword && !validOtp)) {
    return res.status(401).json({ message: 'No se pudo validar la clave actual ni el autenticador' });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await pool.execute(
    'UPDATE admins SET password_hash = :passwordHash WHERE id = :id',
    { passwordHash, id: admin.id }
  );
  await recordAudit(req.admin, 'change_password', 'admin_user', admin.id);

  res.json({ message: 'Clave de administrador actualizada' });
}));

authRouter.get('/mfa/status', requireAdmin, asyncHandler(async (req, res) => {
  await ensureAdminMfaColumns();
  const [rows] = await pool.execute(
    'SELECT totp_enabled AS totpEnabled FROM admins WHERE id = :id LIMIT 1',
    { id: req.admin.id }
  );

  res.json({ enabled: Boolean(rows[0]?.totpEnabled) });
}));

authRouter.post('/mfa/setup', requireAdmin, asyncHandler(async (req, res) => {
  await ensureAdminMfaColumns();
  const parsed = setupMfaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Debes confirmar tu clave actual' });
  }

  const [rows] = await pool.execute(
    'SELECT id, username, password_hash FROM admins WHERE id = :id LIMIT 1',
    { id: req.admin.id }
  );
  const admin = rows[0];
  if (!admin || !(await bcrypt.compare(parsed.data.currentPassword, admin.password_hash))) {
    return res.status(401).json({ message: 'La clave actual no coincide' });
  }

  const secret = generateSecret();
  const otpauthUrl = generateURI({
    issuer: 'Red Taurus Codex Asistencia',
    label: admin.username,
    secret
  });
  const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

  await pool.execute(
    'UPDATE admins SET totp_secret = :secret, totp_enabled = 0 WHERE id = :id',
    { secret, id: admin.id }
  );

  res.json({ secret, qrCodeDataUrl });
}));

authRouter.post('/mfa/confirm', requireAdmin, asyncHandler(async (req, res) => {
  await ensureAdminMfaColumns();
  const parsed = confirmMfaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Codigo del autenticador invalido' });
  }

  const [rows] = await pool.execute(
    'SELECT id, totp_secret AS totpSecret FROM admins WHERE id = :id LIMIT 1',
    { id: req.admin.id }
  );
  const admin = rows[0];
  const otpResult = admin?.totpSecret
    ? await verify({ token: parsed.data.code, secret: admin.totpSecret })
    : { valid: false };
  if (!otpResult.valid) {
    return res.status(401).json({ message: 'El codigo no coincide' });
  }

  await pool.execute(
    'UPDATE admins SET totp_enabled = 1 WHERE id = :id',
    { id: admin.id }
  );
  await recordAudit(req.admin, 'enable_mfa', 'admin_user', admin.id);

  res.json({ message: 'Autenticador habilitado' });
}));

authRouter.post('/recover-password-otp', asyncHandler(async (req, res) => {
  await ensureAdminMfaColumns();
  const parsed = recoverPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos de recuperacion invalidos' });
  }

  const [rows] = await pool.execute(
    `SELECT id, password_hash, totp_secret AS totpSecret, totp_enabled AS totpEnabled
     FROM admins
     WHERE username = :username
     LIMIT 1`,
    { username: parsed.data.username }
  );

  const admin = rows[0];
  const otpResult = admin?.totpEnabled && admin?.totpSecret
    ? await verify({ token: parsed.data.otpCode, secret: admin.totpSecret })
    : { valid: false };
  const validOtp = Boolean(otpResult.valid);

  if (!admin || !validOtp) {
    return res.status(401).json({ message: 'No se pudo validar la recuperacion' });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await pool.execute(
    'UPDATE admins SET password_hash = :passwordHash WHERE id = :id',
    { passwordHash, id: admin.id }
  );

  res.json({ message: 'Clave restablecida con autenticador' });
}));

authRouter.post('/recover-password-backup', asyncHandler(async (req, res) => {
  await ensureAdminSecuritySchema();
  const parsed = recoverPasswordBackupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos de recuperacion invalidos' });
  }

  const [admins] = await pool.execute(
    `SELECT id
     FROM admins
     WHERE username = :username
     LIMIT 1`,
    { username: parsed.data.username }
  );
  const admin = admins[0];
  if (!admin) {
    return res.status(401).json({ message: 'No se pudo validar la recuperacion' });
  }

  const [codes] = await pool.execute(
    `SELECT id, code_hash AS codeHash
     FROM admin_backup_codes
     WHERE admin_id = :adminId AND used_at IS NULL`,
    { adminId: admin.id }
  );

  let matchedCode = null;
  for (const code of codes) {
    if (await bcrypt.compare(parsed.data.backupCode, code.codeHash)) {
      matchedCode = code;
      break;
    }
  }

  if (!matchedCode) {
    return res.status(401).json({ message: 'Codigo de respaldo invalido' });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await pool.execute(
    'UPDATE admins SET password_hash = :passwordHash WHERE id = :id',
    { passwordHash, id: admin.id }
  );
  await pool.execute(
    "UPDATE admin_backup_codes SET used_at = (datetime('now', 'localtime')) WHERE id = :id",
    { id: matchedCode.id }
  );

  res.json({ message: 'Clave restablecida con codigo de respaldo' });
}));
