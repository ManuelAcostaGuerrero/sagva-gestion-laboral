import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAdmin } from '../auth.js';
import { asyncHandler } from '../asyncHandler.js';
import { ensureEmployeeAccessColumns } from '../employeeAccess.js';
import bcrypt from 'bcryptjs';
import { recordAudit } from '../auditLog.js';
import { normalizeDocument } from '../employeeFiles.js';
import { workerName } from '../workerNames.js';
import { resolvePosition } from '../workPositions.js';

export const employeeRouter = Router();

const allowedFingerLabels = [
  'indice_derecho',
  'medio_derecho',
  'indice_izquierdo',
  'medio_izquierdo'
];

const samplesPerFinger = 4;

const employeeSchema = z.object({
  documentId: z.string().trim().optional().nullable(),
  fullName: z.string().min(3),
  email: z.string().email().optional().or(z.literal('')),
  positionName: z.string().optional().or(z.literal('')),
  workAreaId: z.coerce.number().int().positive().optional().or(z.literal(''))
});

const fingerprintSchema = z.object({
  template: z.string().min(10).optional(),
  templates: z.array(z.string().min(10)).min(1).max(samplesPerFinger).optional(),
  fingerLabel: z.enum(allowedFingerLabels)
}).refine((data) => data.template || data.templates?.length, {
  message: 'Debe enviar una o mas muestras de huella'
});

const accessCodeSchema = z.object({
  enabled: z.boolean(),
  code: z.string().min(4).max(20).optional().or(z.literal(''))
});

const deactivateEmployeeSchema = z.object({
  reason: z.string().trim().min(5).max(255)
});

const reactivateEmployeeSchema = z.object({
  reason: z.string().trim().min(5).max(255)
});

const documentChangeSchema = z.object({
  documentId: z.string().trim().min(3).max(40),
  reason: z.string().trim().min(5).max(255)
});

const employeeAreaSchema = z.object({
  workAreaId: z.coerce.number().int().positive().nullable().optional().or(z.literal(''))
});

employeeRouter.use(requireAdmin);

employeeRouter.get('/', asyncHandler(async (req, res) => {
  await ensureEmployeeAccessColumns();

  const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';
  const onlySearch=req.query.onlySearch==='1';
  const q=String(req.query.q||'').trim();
  if(onlySearch&&q.length<2)return res.json({employees:[]});
  if(onlySearch&&q.length>80)return res.status(400).json({message:'La búsqueda es demasiado extensa.'});
  const queryLike='%'+q.replace(/[\\%_]/g,value=>'\\'+value)+'%';
  const [rows] = await pool.execute(`
    SELECT e.id, e.document_id AS documentId, e.full_name AS fullName,
           e.email, e.position_name AS positionName, e.work_area_id AS workAreaId,
           wa.name AS workAreaName, e.is_active AS isActive,
           e.access_code_enabled AS accessCodeEnabled, ef.extra_json AS extraJson,
           e.deleted_at AS deletedAt, e.deletion_reason AS deletionReason,
           e.reactivated_at AS reactivatedAt, e.reactivation_reason AS reactivationReason,
           COUNT(f.id) AS fingerprints,
           COALESCE(json_group_array(f.finger_label), '[]') AS fingerLabels
    FROM employees e
    LEFT JOIN work_areas wa ON wa.id = e.work_area_id
    LEFT JOIN employee_files ef ON ef.employee_id=e.id
    LEFT JOIN fingerprints f ON f.employee_id = e.id
    WHERE (:includeInactive = 1 OR e.is_active = 1)
      AND (:onlySearch = 0 OR e.full_name LIKE :queryLike ESCAPE '\\' OR e.document_id LIKE :queryLike ESCAPE '\\')
    GROUP BY e.id
    ORDER BY e.is_active DESC, e.full_name
    ${onlySearch?'LIMIT 30':''}
  `, { includeInactive: includeInactive ? 1 : 0,onlySearch:onlySearch?1:0,queryLike });

  const employees = rows.map((employee) => ({
    ...employee,
    displayName: workerName(employee),
    fingerLabels: Array.isArray(employee.fingerLabels)
      ? employee.fingerLabels.filter(Boolean)
      : JSON.parse(employee.fingerLabels || '[]').filter(Boolean)
  })).map((employee) => ({
    ...employee,
    enrolledFingerLabels: allowedFingerLabels.filter((label) =>
      employee.fingerLabels.some((storedLabel) => storedLabel === label || storedLabel.startsWith(`${label}_`))
    )
  }));

  res.json({ employees });
}));

employeeRouter.post('/', asyncHandler(async (req, res) => {
  const parsed = employeeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos de empleado invalidos' });
  }

  const data = parsed.data;
  const [existing] = await pool.execute(
    `SELECT id, full_name AS fullName, document_id AS documentId, is_active AS isActive
     FROM employees
     WHERE upper(replace(replace(replace(trim(document_id),'.',''),'-',''),' ','')) = :documentId
     LIMIT 1`,
    { documentId: normalizeDocument(data.documentId) }
  );

  if (existing.length) {
    const employee = existing[0];
    return res.status(409).json({
      message: employee.isActive
        ? 'Ya existe un empleado activo con ese documento. Usa corregir documento si se trata de la misma persona.'
        : 'Este documento pertenece a un empleado desactivado. Reactiva ese empleado para conservar huellas e historial.',
      employee
    });
  }

  if (data.workAreaId) {
    const [areas] = await pool.execute(
      'SELECT id FROM work_areas WHERE id = :workAreaId AND is_active = 1 LIMIT 1',
      { workAreaId: data.workAreaId }
    );
    if (!areas.length) {
      return res.status(404).json({ message: 'Area activa no encontrada' });
    }
  }

  const positionName=await resolvePosition(data.positionName,pool);
  const [result] = await pool.execute(
    `INSERT INTO employees (document_id, full_name, email, position_name, work_area_id)
     VALUES (:documentId, :fullName, :email, :positionName, :workAreaId)`,
    {
      documentId: data.documentId || null,
      fullName: data.fullName,
      email: data.email || null,
      positionName,
      workAreaId: data.workAreaId || null
    }
  );

  await recordAudit(req.admin, 'create', 'employee', result.insertId, {
    documentId: data.documentId,
    fullName: data.fullName
  });

  res.status(201).json({ id: result.insertId });
}));

employeeRouter.put('/:id/area', asyncHandler(async (req, res) => {
  const parsed = employeeAreaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Area de empleado invalida' });
  }

  const employeeId = Number(req.params.id);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return res.status(400).json({ message: 'Empleado invalido' });
  }

  const workAreaId = parsed.data.workAreaId || null;
  if (workAreaId) {
    const [areas] = await pool.execute(
      'SELECT id FROM work_areas WHERE id = :workAreaId AND is_active = 1 LIMIT 1',
      { workAreaId }
    );
    if (!areas.length) {
      return res.status(404).json({ message: 'Area activa no encontrada' });
    }
  }

  const [result] = await pool.execute(
    'UPDATE employees SET work_area_id = :workAreaId WHERE id = :employeeId',
    { employeeId, workAreaId }
  );

  if (!result.affectedRows) {
    return res.status(404).json({ message: 'Empleado no encontrado' });
  }

  await recordAudit(req.admin, 'assign_area', 'employee', employeeId, { workAreaId });
  res.json({ message: workAreaId ? 'Area asignada' : 'Area quitada' });
}));

employeeRouter.put('/:id/document', asyncHandler(async (req, res) => {
  const parsed = documentChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Debes indicar nuevo documento y motivo de correccion' });
  }

  const employeeId = Number(req.params.id);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return res.status(400).json({ message: 'Empleado invalido' });
  }

  const [employees] = await pool.execute(
    `SELECT id, document_id AS documentId, full_name AS fullName, is_active AS isActive
     FROM employees
     WHERE id = :employeeId
     LIMIT 1`,
    { employeeId }
  );
  const employee = employees[0];
  if (!employee) {
    return res.status(404).json({ message: 'Empleado no encontrado' });
  }

  if (employee.documentId === parsed.data.documentId) {
    return res.status(400).json({ message: 'El documento nuevo es igual al documento actual' });
  }

  const [duplicates] = await pool.execute(
    `SELECT id, full_name AS fullName, is_active AS isActive
     FROM employees
     WHERE upper(replace(replace(replace(trim(document_id),'.',''),'-',''),' ','')) = :documentId AND id <> :employeeId
     LIMIT 1`,
    { documentId: normalizeDocument(parsed.data.documentId), employeeId }
  );
  if (duplicates.length) {
    return res.status(409).json({
      message: 'El documento nuevo ya pertenece a otro empleado. No se puede duplicar.',
      employee: duplicates[0]
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE employees
       SET document_id = :documentId
       WHERE id = :employeeId`,
      { documentId: parsed.data.documentId, employeeId }
    );
    await connection.execute(
      `INSERT INTO employee_document_history (employee_id, old_document_id, new_document_id, changed_by, reason)
       VALUES (:employeeId, :oldDocumentId, :newDocumentId, :changedBy, :reason)`,
      {
        employeeId,
        oldDocumentId: employee.documentId || '',
        newDocumentId: parsed.data.documentId,
        changedBy: req.admin.id,
        reason: parsed.data.reason
      }
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await recordAudit(req.admin, 'change_document', 'employee', employeeId, {
    oldDocumentId: employee.documentId,
    newDocumentId: parsed.data.documentId,
    reason: parsed.data.reason
  });

  res.json({ message: 'Documento corregido sin afectar huellas ni historial' });
}));

employeeRouter.post('/:id/reactivate', asyncHandler(async (req, res) => {
  const parsed = reactivateEmployeeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Debes indicar un motivo de reactivacion' });
  }

  const employeeId = Number(req.params.id);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return res.status(400).json({ message: 'Empleado invalido' });
  }

  const [employees] = await pool.execute(
    `SELECT id, document_id AS documentId, full_name AS fullName, is_active AS isActive
     FROM employees
     WHERE id = :employeeId
     LIMIT 1`,
    { employeeId }
  );
  const employee = employees[0];
  if (!employee) {
    return res.status(404).json({ message: 'Empleado no encontrado' });
  }
  if (employee.isActive) {
    return res.status(409).json({ message: 'El empleado ya esta activo' });
  }

  await pool.execute(
    `UPDATE employees
     SET is_active = 1,
         deleted_at = NULL,
         deleted_by = NULL,
         deletion_reason = NULL,
         reactivated_at = (datetime('now', 'localtime')),
         reactivated_by = :reactivatedBy,
         reactivation_reason = :reactivationReason
     WHERE id = :employeeId`,
    {
      employeeId,
      reactivatedBy: req.admin.id,
      reactivationReason: parsed.data.reason
    }
  );

  await recordAudit(req.admin, 'reactivate', 'employee', employeeId, {
    reason: parsed.data.reason,
    employee
  });

  res.json({ message: 'Empleado reactivado con su historial y huellas existentes' });
}));

employeeRouter.delete('/:id', asyncHandler(async (req, res) => {
  const parsed = deactivateEmployeeSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ message: 'Debes indicar un motivo de desactivacion' });
  }

  const employeeId = Number(req.params.id);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return res.status(400).json({ message: 'Empleado invalido' });
  }

  const [employees] = await pool.execute(
    `SELECT id, document_id AS documentId, full_name AS fullName, email, position_name AS positionName, is_active AS isActive
     FROM employees
     WHERE id = :employeeId AND is_active = 1
     LIMIT 1`,
    { employeeId }
  );

  if (!employees.length) {
    return res.status(404).json({ message: 'Empleado no encontrado o ya desactivado' });
  }

  const [result] = await pool.execute(
    `UPDATE employees
     SET is_active = 0,
         deleted_at = (datetime('now', 'localtime')),
         deleted_by = :deletedBy,
         deletion_reason = :deletionReason
     WHERE id = :employeeId AND is_active = 1`,
    {
      employeeId,
      deletedBy: req.admin.id,
      deletionReason: parsed.data.reason
    }
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({ message: 'Empleado no encontrado' });
  }

  await recordAudit(req.admin, 'deactivate', 'employee', employeeId, {
    reason: parsed.data.reason,
    before: employees[0]
  });
  res.json({ message: 'Empleado desactivado sin borrar su historial' });
}));

employeeRouter.put('/:id/fingerprint', (_req,res)=>res.status(410).json({message:'Método de identificación retirado. Usa QR o PIN en una terminal autorizada.'}));
employeeRouter.put('/:id/access-code', asyncHandler(async (req, res) => {
  await ensureEmployeeAccessColumns();

  const parsed = accessCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos de clave invalidos' });
  }

  const employeeId = Number(req.params.id);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return res.status(400).json({ message: 'Empleado invalido' });
  }

  let accessCodeHash = null;
  if (parsed.data.enabled) {
    if (!parsed.data.code) {
      return res.status(400).json({ message: 'Debe ingresar una clave para habilitar el acceso' });
    }
    accessCodeHash = await bcrypt.hash(parsed.data.code, 10);
  }

  const [result] = await pool.execute(
    `UPDATE employees
     SET access_code_enabled = :enabled,
         access_code_hash = :accessCodeHash
     WHERE id = :employeeId`,
    {
      employeeId,
      enabled: parsed.data.enabled,
      accessCodeHash
    }
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({ message: 'Empleado no encontrado' });
  }

  await recordAudit(req.admin, parsed.data.enabled ? 'enable_access_code' : 'disable_access_code', 'employee', employeeId);
  res.json({ message: parsed.data.enabled ? 'Clave habilitada' : 'Clave deshabilitada' });
}));
