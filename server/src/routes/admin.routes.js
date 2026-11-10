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
import {ACCESS_CATALOG,permissionKnown} from '../securityPermissions.js';

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
const rootOnly=(req,res,next)=>req.admin?.profile==='root'?next():res.status(403).json({message:'Solo Root puede administrar permisos individuales.'});
const forbidLegacyOnceRoot=(req,res,next)=>req.admin?.hasRoot&&req.admin?.profile!=='root'
 ? res.status(403).json({message:'La gestión de usuarios requiere una cuenta Root.'})
 : next();
const profileSchema=z.object({profile:z.enum(['root','accounting','admin_local'])}).strict();
const accessSchema=z.object({
 permission:z.string().min(3).max(140),
 effect:z.enum(['ALLOW','DENY']),
 scopeKind:z.enum(['GLOBAL','COMPANY','BRANCH']).default('GLOBAL'),
 companyId:z.number().int().positive().nullable().optional(),
 branch:z.string().trim().min(2).max(120).nullable().optional(),
 validUntil:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
 reason:z.string().trim().min(10).max(500)
}).strict();
const idOf=x=>Number.isSafeInteger(Number(x))&&Number(x)>0?Number(x):null;
adminRouter.get('/access/self',asyncHandler(async(req,res)=>{
 res.json({profile:req.admin.profile||null,hasRoot:req.admin.hasRoot===true});
}));
adminRouter.get('/access/catalog',rootOnly,asyncHandler(async(_req,res)=>{
 res.json({permissions:ACCESS_CATALOG.map(([key,group,label])=>({key,group,label}))});
}));
adminRouter.get('/access/users',rootOnly,asyncHandler(async(_req,res)=>{
 const [rows]=await pool.execute('SELECT a.id,a.username,a.full_name AS fullName,a.role,p.profile FROM admins a LEFT JOIN security_user_profiles p ON p.user_id=a.id ORDER BY a.full_name');
 res.json({users:rows});
}));
adminRouter.get('/access/users/:id',rootOnly,asyncHandler(async(req,res)=>{
 const id=idOf(req.params.id);if(!id)return res.status(400).json({message:'Usuario inválido'});
 const [users]=await pool.execute('SELECT a.id,a.username,a.role,p.profile FROM admins a LEFT JOIN security_user_profiles p ON p.user_id=a.id WHERE a.id=?',[id]);
 if(!users.length)return res.status(404).json({message:'Usuario inexistente'});
 const [overrides]=await pool.execute('SELECT id,permission_key AS permission,effect,scope_kind AS scopeKind,company_id AS companyId,branch,valid_until AS validUntil,reason,created_at AS createdAt,revoked_at AS revokedAt FROM security_permission_overrides WHERE user_id=? ORDER BY id DESC',[id]);
 res.json({user:users[0],overrides});
}));
adminRouter.put('/access/users/:id/profile',rootOnly,asyncHandler(async(req,res)=>{
 const id=idOf(req.params.id),parsed=profileSchema.safeParse(req.body);
 if(!id||!parsed.success)return res.status(400).json({message:'Perfil inválido'});
 if(parsed.data.profile==='admin_local')return res.status(409).json({message:'El perfil Administrador local requiere aislar previamente TODAS las rutas por empresa/sucursal. No puede activarse todavía.'});
 const db=await pool.getConnection();
 try{
  await db.beginTransaction();
  const [users]=await db.execute('SELECT id FROM admins WHERE id=?',[id]);
  if(!users.length)return res.status(404).json({message:'Usuario no encontrado'});
  const [current]=await db.execute('SELECT profile FROM security_user_profiles WHERE user_id=?',[id]);
  if(current[0]?.profile==='root'&&parsed.data.profile!=='root'){
   const [count]=await db.execute("SELECT count(*) AS n FROM security_user_profiles WHERE profile='root'");
   if(count[0].n<=1)return res.status(409).json({message:'No puedes degradar la única cuenta Root'});
  }
  await db.execute('INSERT INTO security_user_profiles(user_id,profile,assigned_by) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET profile=excluded.profile,assigned_by=excluded.assigned_by,assigned_at=CURRENT_TIMESTAMP',[id,parsed.data.profile,req.admin.id]);
  await recordAudit(req.admin,'change_profile','security_user',id,{from:current[0]?.profile||null,to:parsed.data.profile},db);
  await db.commit();res.json({message:'Perfil aplicado; las sesiones usan permisos nuevos inmediatamente.'});
 }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
adminRouter.post('/access/users/:id/permissions',rootOnly,asyncHandler(async(req,res)=>{
 const id=idOf(req.params.id),parsed=accessSchema.safeParse(req.body);
 if(!id||!parsed.success||!permissionKnown(parsed.data.permission)||parsed.data.permission==='security.access.manage')
  return res.status(400).json({message:'Concesión inválida o no delegable'});
 const d=parsed.data;
 if(d.scopeKind==='GLOBAL'&&(d.companyId||d.branch)||d.scopeKind!=='GLOBAL'&&!d.companyId||d.scopeKind==='BRANCH'&&!d.branch)
  return res.status(400).json({message:'Revisa el ámbito de empresa y sucursal'});
 if(d.validUntil&&new Date(d.validUntil+'T23:59:59Z').getTime()<=Date.now())
  return res.status(400).json({message:'El vencimiento debe ser futuro'});
 const db=await pool.getConnection();
 try{
  await db.beginTransaction();
  const [users]=await db.execute('SELECT a.id,p.profile FROM admins a LEFT JOIN security_user_profiles p ON p.user_id=a.id WHERE a.id=?',[id]);
  if(!users.length)return res.status(404).json({message:'Usuario inexistente'});
  if(users[0].profile==='root')return res.status(400).json({message:'Root administra acceso por perfil, no por excepciones'});
  if(users[0].profile==='admin_local'&&d.permission.startsWith('labor.')&&d.permission.endsWith('.manage'))
   return res.status(403).json({message:'El administrador local no puede configurar parámetros globales'});
  if(d.companyId){
   const [company]=await db.execute('SELECT id FROM company_profiles WHERE id=?',[d.companyId]);
   if(!company.length)return res.status(400).json({message:'Empresa inexistente'});
  }
  const [created]=await db.execute('INSERT INTO security_permission_overrides(user_id,permission_key,effect,scope_kind,company_id,branch,valid_until,reason,created_by) VALUES(?,?,?,?,?,?,?,?,?)',
   [id,d.permission,d.effect,d.scopeKind,d.companyId||null,d.branch||null,d.validUntil?d.validUntil+'T23:59:59Z':null,d.reason,req.admin.id]);
  await recordAudit(req.admin,'grant_permission','security_user',id,{permission:d.permission,effect:d.effect,scope:d.scopeKind,companyId:d.companyId||null,branch:d.branch||null,expires:d.validUntil||null},db);
  await db.commit();res.status(201).json({id:created.insertId,message:'Excepción individual registrada con historial.'});
 }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
adminRouter.post('/access/permissions/:id/revoke',rootOnly,asyncHandler(async(req,res)=>{
 const id=idOf(req.params.id);if(!id)return res.status(400).json({message:'Permiso inválido'});
 const db=await pool.getConnection();
 try{
  await db.beginTransaction();
  const [old]=await db.execute('SELECT id,user_id AS userId,permission_key AS key,revoked_at AS revokedAt FROM security_permission_overrides WHERE id=?',[id]);
  if(!old.length)return res.status(404).json({message:'Permiso inexistente'});
  if(old[0].revokedAt)return res.status(409).json({message:'Ya estaba revocado'});
  await db.execute('UPDATE security_permission_overrides SET revoked_at=CURRENT_TIMESTAMP,revoked_by=? WHERE id=?',[req.admin.id,id]);
  await recordAudit(req.admin,'revoke_permission','security_user',old[0].userId,{permission:old[0].key,grantId:id},db);
  await db.commit();res.json({message:'Permiso revocado. La próxima solicitud respetará el cambio.'});
 }catch(e){await db.rollback();throw e;}finally{db.release();}
}));


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

adminRouter.post('/users',forbidLegacyOnceRoot, asyncHandler(async (req, res) => {
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

adminRouter.put('/users/:id/role',forbidLegacyOnceRoot, asyncHandler(async (req, res) => {
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
