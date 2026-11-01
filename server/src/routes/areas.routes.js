import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAdmin } from '../auth.js';
import { asyncHandler } from '../asyncHandler.js';
import { recordAudit } from '../auditLog.js';
import { normalizeWorkLabel } from '../workPositions.js';

export const areasRouter = Router();

const areaSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(255).optional().or(z.literal('')),
  requiredStaff: z.coerce.number().int().min(0).max(200).optional()
});

const deactivateAreaSchema = z.object({
  reason: z.string().trim().min(5).max(255)
});

areasRouter.use(requireAdmin);

areasRouter.get('/', asyncHandler(async (req, res) => {
  const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';
  const [areas] = await pool.execute(
    `SELECT wa.id, wa.name, wa.description, wa.required_staff AS requiredStaff,
            wa.is_active AS isActive, wa.created_at AS createdAt,
            wa.deactivated_at AS deactivatedAt, wa.deactivation_reason AS deactivationReason,
            COUNT(e.id) AS employeeCount
     FROM work_areas wa
     LEFT JOIN employees e ON e.work_area_id = wa.id AND e.is_active = 1
     WHERE (:includeInactive = 1 OR wa.is_active = 1)
     GROUP BY wa.id
     ORDER BY wa.is_active DESC, wa.name`,
    { includeInactive: includeInactive ? 1 : 0 }
  );

  res.json({
    areas: areas.map((area) => ({
      ...area,
      requiredStaff: Number(area.requiredStaff || 0),
      employeeCount: Number(area.employeeCount || 0),
      isActive: Boolean(area.isActive)
    }))
  });
}));

areasRouter.post('/', asyncHandler(async (req, res) => {
  const parsed = areaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos de area invalidos' });
  }

  const [dupes]=await pool.execute('SELECT id FROM work_areas WHERE name=?',[normalizeWorkLabel(parsed.data.name)]);
  if(dupes.length)return res.status(409).json({message:'El área ya existe.'});
  const [result] = await pool.execute(
    `INSERT INTO work_areas (name, description, required_staff, created_by)
     VALUES (:name, :description, :requiredStaff, :createdBy)`,
    {
      name: normalizeWorkLabel(parsed.data.name),
      description: parsed.data.description || null,
      requiredStaff: parsed.data.requiredStaff || 0,
      createdBy: req.admin.id
    }
  );

  await recordAudit(req.admin, 'create', 'work_area', result.insertId, parsed.data);
  res.status(201).json({ id: result.insertId });
}));

areasRouter.put('/:id', asyncHandler(async (req, res) => {
  const parsed = areaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos de area invalidos' });
  }

  const areaId = Number(req.params.id);
  if (!Number.isInteger(areaId) || areaId <= 0) {
    return res.status(400).json({ message: 'Area invalida' });
  }

  const [dupes]=await pool.execute('SELECT id FROM work_areas WHERE name=? AND id<>?',[normalizeWorkLabel(parsed.data.name),areaId]);
  if(dupes.length)return res.status(409).json({message:'Ya existe un área con ese nombre.'});
  const [result] = await pool.execute(
    `UPDATE work_areas
     SET name = :name,
         description = :description,
         required_staff = :requiredStaff
     WHERE id = :areaId`,
    {
      areaId,
      name: normalizeWorkLabel(parsed.data.name),
      description: parsed.data.description || null,
      requiredStaff: parsed.data.requiredStaff || 0
    }
  );

  if (!result.affectedRows) {
    return res.status(404).json({ message: 'Area no encontrada' });
  }

  await recordAudit(req.admin, 'update', 'work_area', areaId, parsed.data);
  res.json({ message: 'Area actualizada' });
}));


/**
 * Eliminación definitiva con comprobación transaccional.
 * Incluye trabajadores inactivos; los horarios semanales se conservan siempre.
 */
areasRouter.delete('/:id/permanent', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({message:'Área inválida.'});
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const [areas] = await db.execute('SELECT id,name,description,is_active AS isActive FROM work_areas WHERE id=?',[id]);
    if (!areas.length) return res.status(404).json({message:'Área no encontrada.'});
    const [assignedEmployees] = await db.execute(
      'SELECT id,full_name AS fullName,document_id AS documentId,is_active AS isActive FROM employees WHERE work_area_id=? ORDER BY is_active DESC,full_name',
      [id]
    );
    if (assignedEmployees.length)
      return res.status(409).json({
        message:`No se puede eliminar el área ${areas[0].name}: tiene ${assignedEmployees.length} trabajador(es) asignado(s). Retira el área en sus fichas.`,
        assignedEmployees:assignedEmployees.map(employee=>({...employee,isActive:!!employee.isActive}))
      });
    const [weeks] = await db.execute('SELECT COUNT(*) AS total FROM planner_weeks WHERE area_id=?',[id]);
    if (weeks[0].total)
      return res.status(409).json({
        message:`No se puede eliminar el área ${areas[0].name}: tiene ${weeks[0].total} semana(s) de planificación guardada(s). Desactívala para conservar ese historial.`,
        historyCount:weeks[0].total
      });
    // Las referencias a bibliotecas de turnos no son planificaciones.
    const [references] = await db.execute('SELECT COUNT(*) AS total FROM shift_area_references WHERE area_id=?',[id]);
    await db.execute('DELETE FROM shift_area_references WHERE area_id=?',[id]);
    await db.execute('DELETE FROM work_areas WHERE id=?',[id]);
    await recordAudit(req.admin,'delete','work_area',id,{area:areas[0],removedShiftLibraryReferences:references[0].total},db);
    await db.commit();
    return res.json({message:'Área eliminada definitivamente.'});
  } catch(error) {
    if (String(error.code||'').includes('SQLITE_CONSTRAINT'))
      return res.status(409).json({message:'El área tiene otras referencias que impiden eliminarla. Puedes desactivarla.'});
    throw error;
  } finally { db.release(); }
}));

areasRouter.delete('/:id', asyncHandler(async (req, res) => {
  const parsed = deactivateAreaSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ message: 'Debes indicar un motivo de desactivacion' });
  }

  const areaId = Number(req.params.id);
  if (!Number.isInteger(areaId) || areaId <= 0) {
    return res.status(400).json({ message: 'Area invalida' });
  }

  const [result] = await pool.execute(
    `UPDATE work_areas
     SET is_active = 0,
         deactivated_at = (datetime('now', 'localtime')),
         deactivated_by = :deactivatedBy,
         deactivation_reason = :deactivationReason
     WHERE id = :areaId AND is_active = 1`,
    {
      areaId,
      deactivatedBy: req.admin.id,
      deactivationReason: parsed.data.reason
    }
  );

  if (!result.affectedRows) {
    return res.status(404).json({ message: 'Area no encontrada o ya desactivada' });
  }

  await recordAudit(req.admin, 'deactivate', 'work_area', areaId, { reason: parsed.data.reason });
  res.json({ message: 'Area desactivada sin borrar historial' });
}));

areasRouter.post('/:id/reactivate', asyncHandler(async (req, res) => {
  const areaId = Number(req.params.id);
  if (!Number.isInteger(areaId) || areaId <= 0) {
    return res.status(400).json({ message: 'Area invalida' });
  }

  const [result] = await pool.execute(
    `UPDATE work_areas
     SET is_active = 1,
         deactivated_at = NULL,
         deactivated_by = NULL,
         deactivation_reason = NULL
     WHERE id = :areaId AND is_active = 0`,
    { areaId }
  );

  if (!result.affectedRows) {
    return res.status(404).json({ message: 'Area no encontrada o ya activa' });
  }

  await recordAudit(req.admin, 'reactivate', 'work_area', areaId);
  res.json({ message: 'Area reactivada' });
}));
