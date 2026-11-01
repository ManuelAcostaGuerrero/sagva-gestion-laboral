import { Router } from 'express';
import { z } from 'zod';
import { requireRoles } from '../auth.js';
import { pool } from '../db.js';
import { runMigrations } from '../migrations.js';
import { recordAudit } from '../auditLog.js';
import { asyncHandler } from '../asyncHandler.js';
import { validContractDate } from '../employeeContracts.js';
import { MEDICAL_KEYS, BLOOD_TYPES, emptyMedicalProfile } from '../medicalProfileFields.js';

export const medicalProfilesRouter = Router();
// Los diagnósticos no forman parte de la ficha general ni se exponen a operadores.
medicalProfilesRouter.use(requireRoles('admin', 'supervisor'));
medicalProfilesRouter.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
medicalProfilesRouter.use(asyncHandler(async (_req, _res, next) => { await runMigrations(); next(); }));

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const idOf = raw => {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};
const condition = z.object({
  answer: z.enum(['', 'SI', 'NO']),
  notes: z.string().trim().max(500)
}).strict();
const schema = z.object({
  revision: z.number().int().nonnegative(),
  filledOn: z.string().trim().max(10),
  bloodType: z.enum(BLOOD_TYPES),
  bloodNotes: z.string().trim().max(500),
  conditions: z.object(Object.fromEntries(MEDICAL_KEYS.map(key => [key, condition]))).strict()
}).strict();
const withoutRevision = data => ({
  filledOn: data.filledOn,
  bloodType: data.bloodType,
  bloodNotes: data.bloodNotes,
  conditions: data.conditions
});

medicalProfilesRouter.get('/workers/:employeeId', asyncHandler(async (req, res) => {
  const id = idOf(req.params.employeeId);
  if (!id) throw fail('Trabajador inválido.');
  const [workers] = await pool.execute('SELECT id FROM employees WHERE id=?', [id]);
  if (!workers.length) throw fail('Trabajador no encontrado.', 404);
  const [rows] = await pool.execute(
    'SELECT profile_data AS profileData, revision, filled_on AS filledOn, updated_at AS updatedAt FROM worker_medical_profiles WHERE employee_id=?',
    [id]
  );
  if (!rows.length) return res.json({ profile: emptyMedicalProfile(), updatedAt: null });
  const saved = JSON.parse(rows[0].profileData);
  res.json({ profile: { ...saved, revision: rows[0].revision }, updatedAt: rows[0].updatedAt });
}));

medicalProfilesRouter.put('/workers/:employeeId', asyncHandler(async (req, res) => {
  const id = idOf(req.params.employeeId);
  const parsed = schema.safeParse(req.body);
  if (!id || !parsed.success) throw fail('Revisa las respuestas, las observaciones y la fecha de la ficha médica.');
  const data = parsed.data;
  if (data.filledOn && !validContractDate(data.filledOn)) throw fail('La fecha de la ficha médica no es válida.');
  const medicalData = withoutRevision(data);
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const [workers] = await db.execute('SELECT id FROM employees WHERE id=?', [id]);
    if (!workers.length) throw fail('Trabajador no encontrado.', 404);
    const [rows] = await db.execute('SELECT revision FROM worker_medical_profiles WHERE employee_id=?', [id]);
    const current = rows.length ? Number(rows[0].revision) : 0;
    if (current !== data.revision) throw fail('Esta ficha médica fue modificada por otro usuario. Actualiza para revisar los cambios.', 409);
    const nextRevision = current + 1;
    if (current) {
      const [changed] = await db.execute(
        "UPDATE worker_medical_profiles SET profile_data=?,filled_on=?,revision=?,updated_by=?,updated_at=datetime('now','localtime') WHERE employee_id=? AND revision=?",
        [JSON.stringify(medicalData), medicalData.filledOn || null, nextRevision, req.admin.id, id, current]
      );
      if (!changed.affectedRows) throw fail('La ficha médica cambió durante el guardado. Actualiza para continuar.', 409);
    } else {
      await db.execute(
        'INSERT INTO worker_medical_profiles(employee_id,filled_on,profile_data,revision,created_by,updated_by) VALUES(?,?,?,?,?,?)',
        [id, medicalData.filledOn || null, JSON.stringify(medicalData), nextRevision, req.admin.id, req.admin.id]
      );
    }
    // La auditoría registra solo quién y cuándo; nunca contenido clínico.
    await recordAudit(req.admin, current ? 'update' : 'create', 'worker_medical_profile', id,
      { employeeId: id, revision: nextRevision }, db);
    await db.commit();
    res.json({ profile: { ...medicalData, revision: nextRevision }, message: 'Ficha médica guardada.' });
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}));
