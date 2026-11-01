import { getShiftLibrary } from './planner.routes.js';
import { normalizeSegments, shiftPresentation } from '../shiftTime.js';
import { runMigrations } from '../migrations.js';
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAdmin, requireRoles } from '../auth.js';
import { asyncHandler } from '../asyncHandler.js';
import { recordAudit } from '../auditLog.js';

export const schedulesRouter = Router();

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);
const edit = requireRoles('admin', 'supervisor');
const groupSchema = z.object({ name: z.string().trim().min(2).max(100) });

const shiftSchema = z.object({
  name: z.string().trim().min(3).max(100).optional(),
  groupId: z.coerce.number().int().positive(),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  segments: z.array(z.object({ startTime: timeSchema, endTime: timeSchema })).min(1).max(4).optional(),
  breakMinutes: z.coerce.number().int().min(0).max(240).default(30)
}).refine(data => data.segments || (data.startTime && data.endTime));

const assignmentSchema = z.object({
  shiftId: z.coerce.number().int().positive().nullable()
});

const calendarAssignmentSchema = z.object({
  shiftId: z.coerce.number().int().positive().nullable(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayType: z.enum(['work', 'rest', 'leave', 'vacation', 'permit', 'absence']).optional()
});

const bulkCalendarSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  shiftId: z.coerce.number().int().positive().nullable(),
  mode: z.enum(['all', 'weekdays'])
});

const weeklyAssignmentSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayType: z.enum(['work', 'rest', 'leave', 'vacation', 'permit', 'absence']).nullable().optional(),
  shiftId: z.coerce.number().int().positive().nullable().optional()
});

async function ensureScheduleTables() {
  await runMigrations();
}

function monthDays(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  return Array.from({ length: daysInMonth }, (_value, index) => {
    const day = String(index + 1).padStart(2, '0');
    return `${month}-${day}`;
  });
}

function weekDays(weekStart) {
  return Array.from({ length: 7 }, (_value, index) => {
    const date = new Date(`${weekStart}T00:00:00`);
    date.setDate(date.getDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function shiftMinutes(startTime, endTime, breakMinutes = 0) {
  if (!startTime || !endTime) {
    return 0;
  }

  const [startHour, startMinute] = String(startTime).slice(0, 5).split(':').map(Number);
  const [endHour, endMinute] = String(endTime).slice(0, 5).split(':').map(Number);
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end <= start) {
    end += 24 * 60;
  }

  return Math.max(0, end - start - Number(breakMinutes || 0));
}

async function assertActiveEmployee(employeeId) {
  const [employees] = await pool.execute(
    'SELECT id FROM employees WHERE id = :employeeId AND is_active = 1 LIMIT 1',
    { employeeId }
  );
  return employees.length > 0;
}

async function assertActiveShift(shiftId) {
  if (shiftId === null) {
    return true;
  }

  const [shifts] = await pool.execute(
    'SELECT id FROM work_shifts WHERE id = :shiftId AND is_active = 1 LIMIT 1',
    { shiftId }
  );
  return shifts.length > 0;
}

schedulesRouter.use(requireAdmin);

schedulesRouter.get('/', asyncHandler(async (_req, res) => {
  await ensureScheduleTables();

  const [groups] = await pool.execute(`
    SELECT id, name, is_active AS isActive,
           (SELECT COUNT(*) FROM work_shifts WHERE group_id=shift_groups.id AND is_active=1) AS scheduleCount
    FROM shift_groups
    WHERE is_active = 1
    ORDER BY CASE name WHEN 'Rotativo' THEN 0 WHEN 'Oficina' THEN 1 ELSE 2 END, name
  `);

  const [shifts] = await pool.execute(`
    SELECT s.id, s.name, s.group_id AS groupId, g.name AS groupName,
           substr(s.start_time, 1, 5) AS startTime,
           substr(s.end_time, 1, 5) AS endTime,
           s.break_minutes AS breakMinutes, s.is_active AS isActive
    FROM work_shifts s
    LEFT JOIN shift_groups g ON g.id = s.group_id
    WHERE s.is_active = 1 AND g.is_active = 1
    ORDER BY CASE g.name WHEN 'Rotativo' THEN 0 WHEN 'Oficina' THEN 1 ELSE 2 END,
             s.start_time, s.name
  `);

  const [assignments] = await pool.execute(`
    SELECT e.id AS employeeId, e.full_name AS fullName, e.document_id AS documentId,
           s.id AS shiftId, s.name AS shiftName,
           substr(s.start_time, 1, 5) AS startTime,
           substr(s.end_time, 1, 5) AS endTime,
           s.break_minutes AS breakMinutes
    FROM employees e
    LEFT JOIN employee_shift_assignments esa ON esa.employee_id = e.id
    LEFT JOIN work_shifts s ON s.id = esa.shift_id AND s.is_active = 1
    WHERE e.is_active = 1
    ORDER BY e.full_name
  `);

  const [segments]=await pool.execute('SELECT shift_id AS shiftId,start_time AS startTime,end_time AS endTime FROM work_shift_segments ORDER BY shift_id,segment_order');
  res.json({
    groups,
    shifts: shifts.map((shift) =>
      shiftPresentation(
        shift,
        segments.filter((segment) => segment.shiftId === shift.id),
      ),
    ),
    assignments,
  });
}));

schedulesRouter.post('/groups', edit, asyncHandler(async (req, res) => {
  await ensureScheduleTables();
  const parsed = groupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Indica un nombre de turno de entre 2 y 100 caracteres.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute('SELECT id,is_active AS isActive FROM shift_groups WHERE name=?', [parsed.data.name]);
    if (existing[0]?.isActive) return res.status(409).json({ message: 'Ya existe un turno con ese nombre.' });
    let id;
    if (existing.length) {
      id = existing[0].id;
      await connection.execute('UPDATE shift_groups SET is_active=1 WHERE id=?', [id]);
    } else {
      const [result] = await connection.execute('INSERT INTO shift_groups(name) VALUES(?)', [parsed.data.name]);
      id = result.insertId;
    }
    await recordAudit(req.admin, existing.length ? 'reactivate' : 'create', 'shift_group', id, parsed.data, connection);
    await connection.commit();
    res.status(201).json({ id, message: 'Turno creado. Puedes agregar sus horarios.' });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}));

schedulesRouter.delete('/groups/:id', edit, asyncHandler(async (req, res) => {
  await ensureScheduleTables();
  const groupId = Number(req.params.id);
  if (!Number.isInteger(groupId) || groupId < 1) return res.status(400).json({ message: 'Turno inválido.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [groups] = await connection.execute('SELECT id,name FROM shift_groups WHERE id=? AND is_active=1', [groupId]);
    if (!groups.length) return res.status(404).json({ message: 'Turno no encontrado.' });
    if (groups[0].name.toLowerCase() === 'rotativo') return res.status(409).json({ message: 'Rotativo reúne la biblioteca común. Puedes administrar sus horarios, pero este turno se conserva.' });
    const [counts] = await connection.execute('SELECT COUNT(*) AS total FROM work_shifts WHERE group_id=? AND is_active=1', [groupId]);
    if (counts[0].total) return res.status(409).json({ message: 'Este turno tiene horarios. Revisa y elimina sus horarios antes de borrar el turno.' });
    await connection.execute('UPDATE shift_groups SET is_active=0 WHERE id=?', [groupId]);
    await recordAudit(req.admin, 'delete', 'shift_group', groupId, { name: groups[0].name }, connection);
    await connection.commit();
    res.json({ message: 'Turno borrado. El historial se conserva.' });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}));

schedulesRouter.post('/shifts', edit, asyncHandler(async (req, res) => {
  await ensureScheduleTables();

  const parsed = shiftSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos de turno invalidos' });
  }

  let normalized;
  try { normalized=normalizeSegments(parsed.data.segments || [{startTime:parsed.data.startTime,endTime:parsed.data.endTime}],parsed.data.breakMinutes); }
  catch(error) { return res.status(400).json({message:error.message}); }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [groups] = await connection.execute('SELECT id,name FROM shift_groups WHERE id=? AND is_active=1', [parsed.data.groupId]);
    if (!groups.length) return res.status(400).json({ message: 'Turno de destino inválido.' });
    const automaticName = `${groups[0].name} ${normalized.segments.map(segment => `${segment.startTime}–${segment.endTime}`).join(' / ')}`;
    const [existing] = await connection.execute('SELECT id FROM work_shifts WHERE name=?', [automaticName]);
    if (existing.length) return res.status(409).json({ message: 'Ese horario ya existe en este turno.' });
    const [result] = await connection.execute(
      'INSERT INTO work_shifts(name,start_time,end_time,break_minutes,group_id) VALUES(?,?,?,?,?)',
      [automaticName, normalized.segments[0].startTime, normalized.segments.at(-1).endTime, normalized.breakMinutes, parsed.data.groupId]
    );
    for (const [index, segment] of normalized.segments.entries()) {
      await connection.execute('INSERT INTO work_shift_segments VALUES(?,?,?,?,?,?)', [result.insertId,index,segment.startTime,segment.endTime,segment.startDayOffset,segment.endDayOffset]);
    }
    await recordAudit(req.admin, 'create', 'work_shift', result.insertId, { ...parsed.data, name: automaticName, ...normalized }, connection);
    await connection.commit();
    res.status(201).json({ id: result.insertId, message: 'Horario creado y disponible en todas las áreas.' });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}));

schedulesRouter.delete('/shifts/:id', edit, asyncHandler(async (req, res) => {
  await ensureScheduleTables();

  const shiftId = Number(req.params.id);
  if (!Number.isInteger(shiftId) || shiftId <= 0) {
    return res.status(400).json({ message: 'Turno invalido' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [shifts] = await connection.execute('SELECT id FROM work_shifts WHERE id=? AND is_active=1', [shiftId]);
    if (!shifts.length) return res.status(404).json({ message: 'Horario no encontrado.' });
    const [assigned] = await connection.execute(
      `SELECT
         (SELECT COUNT(*) FROM employee_shift_assignments WHERE shift_id = :shiftId) +
         (SELECT COUNT(*) FROM employee_shift_calendar WHERE shift_id = :shiftId) +
         (SELECT COUNT(*) FROM planner_cells WHERE shift_id = :shiftId) AS total`,
      { shiftId }
    );
    if (assigned[0].total > 0) return res.status(409).json({ message: 'Este horario está usado en usuarios, calendario o semanas del planificador. Se conserva para proteger esas asignaciones.' });
    await connection.execute('UPDATE work_shifts SET is_active=0 WHERE id=?', [shiftId]);
    await recordAudit(req.admin, 'delete', 'work_shift', shiftId, null, connection);
    await connection.commit();
    res.json({ message: 'Horario borrado de la biblioteca. El historial se conserva.' });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}));

schedulesRouter.get('/calendar', asyncHandler(async (req, res) => {
  await ensureScheduleTables();

  const employeeId = Number(req.query.employeeId || 0);
  const month = String(req.query.month || new Date().toISOString().slice(0, 7));
  if (!Number.isInteger(employeeId) || employeeId <= 0 || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ message: 'Calendario invalido' });
  }

  if (!(await assertActiveEmployee(employeeId))) {
    return res.status(404).json({ message: 'Empleado no encontrado' });
  }

  const [rows] = await pool.execute(
    `SELECT esc.employee_id AS employeeId,
            strftime('%Y-%m-%d', esc.work_date) AS workDate,
            esc.day_type AS dayType,
            s.id AS shiftId, s.name AS shiftName,
            substr(s.start_time, 1, 5) AS startTime,
            substr(s.end_time, 1, 5) AS endTime,
            s.break_minutes AS breakMinutes
     FROM employee_shift_calendar esc
     LEFT JOIN work_shifts s ON s.id = esc.shift_id
     WHERE esc.employee_id = :employeeId
       AND strftime('%Y-%m', esc.work_date) = :month
     ORDER BY esc.work_date`,
    { employeeId, month }
  );

  const [segments]=await pool.execute('SELECT shift_id AS shiftId,start_time AS startTime,end_time AS endTime FROM work_shift_segments ORDER BY shift_id,segment_order');
  const byDate = new Map(rows.map(row=>[row.workDate,row.shiftId?{...row,...shiftPresentation(row,segments.filter(segment=>segment.shiftId===row.shiftId))}:row]));
  const days = monthDays(month).map((date) => ({
    date,
    assignment: byDate.get(date) || null
  }));

  res.json({ employeeId, month, days });
}));

schedulesRouter.put('/calendar/:employeeId', asyncHandler(async (req, res) => {
  await ensureScheduleTables();

  const employeeId = Number(req.params.employeeId);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return res.status(400).json({ message: 'Empleado invalido' });
  }

  const parsed = calendarAssignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Asignacion de calendario invalida' });
  }

  if (!(await assertActiveEmployee(employeeId))) {
    return res.status(404).json({ message: 'Empleado no encontrado' });
  }

  if (!(await assertActiveShift(parsed.data.shiftId))) {
    return res.status(404).json({ message: 'Turno no encontrado' });
  }

  const dayType = parsed.data.dayType || (parsed.data.shiftId ? 'work' : null);

  if (parsed.data.shiftId === null && !dayType) {
    await pool.execute(
      `DELETE FROM employee_shift_calendar
       WHERE employee_id = :employeeId AND work_date = :workDate`,
      { employeeId, workDate: parsed.data.workDate }
    );
    await recordAudit(req.admin, 'unassign_calendar_shift', 'employee', employeeId, {
      workDate: parsed.data.workDate
    });
    return res.json({ message: 'Turno quitado del calendario' });
  }

  if (dayType === 'work' && !parsed.data.shiftId) {
    return res.status(400).json({ message: 'Selecciona un turno para un dia trabajado' });
  }

  await pool.execute(
    `INSERT INTO employee_shift_calendar (employee_id, work_date, shift_id, day_type)
     VALUES (:employeeId, :workDate, :shiftId, :dayType)
     ON CONFLICT DO UPDATE SET shift_id = excluded.shift_id, day_type = excluded.day_type, assigned_at = (datetime('now', 'localtime')), source_week_id = NULL`,
    {
      employeeId,
      workDate: parsed.data.workDate,
      shiftId: dayType === 'work' ? parsed.data.shiftId : null,
      dayType
    }
  );

  await recordAudit(req.admin, 'assign_calendar_shift', 'employee', employeeId, {
    workDate: parsed.data.workDate,
    shiftId: parsed.data.shiftId
  });
  res.json({ message: 'Turno asignado al calendario' });
}));

schedulesRouter.post('/calendar/bulk', asyncHandler(async (req, res) => {
  await ensureScheduleTables();

  const parsed = bulkCalendarSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Programacion masiva invalida' });
  }

  const { employeeId, month, shiftId, mode } = parsed.data;
  if (!(await assertActiveEmployee(employeeId))) {
    return res.status(404).json({ message: 'Empleado no encontrado' });
  }

  if (!(await assertActiveShift(shiftId))) {
    return res.status(404).json({ message: 'Turno no encontrado' });
  }

  const dates = monthDays(month).filter((date) => {
    if (mode === 'all') {
      return true;
    }
    const day = new Date(`${date}T00:00:00`).getDay();
    return day >= 1 && day <= 5;
  });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const workDate of dates) {
      if (shiftId === null) {
        await connection.execute(
          `DELETE FROM employee_shift_calendar
           WHERE employee_id = :employeeId AND work_date = :workDate`,
          { employeeId, workDate }
        );
      } else {
        await connection.execute(
          `INSERT INTO employee_shift_calendar (employee_id, work_date, shift_id, day_type)
           VALUES (:employeeId, :workDate, :shiftId, 'work')
           ON CONFLICT DO UPDATE SET shift_id = excluded.shift_id, day_type = 'work', assigned_at = (datetime('now', 'localtime')), source_week_id = NULL`,
          { employeeId, workDate, shiftId }
        );
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await recordAudit(req.admin, shiftId === null ? 'clear_calendar_month' : 'bulk_assign_calendar_shift', 'employee', employeeId, {
    month,
    mode,
    shiftId,
    affectedDays: dates.length
  });
  res.json({ message: 'Calendario actualizado', affectedDays: dates.length });
}));

schedulesRouter.get('/weekly', asyncHandler(async (req, res) => {
  await ensureScheduleTables();

  const areaId = Number(req.query.areaId || 0);
  const weekStart = String(req.query.weekStart || '');
  if (!Number.isInteger(areaId) || areaId <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return res.status(400).json({ message: 'Filtros de horario semanal invalidos' });
  }

  const [areas] = await pool.execute(
    `SELECT id, name, required_staff AS requiredStaff
     FROM work_areas
     WHERE id = :areaId AND is_active = 1
     LIMIT 1`,
    { areaId }
  );
  const area = areas[0];
  if (!area) {
    return res.status(404).json({ message: 'Area activa no encontrada' });
  }

  const dates = weekDays(weekStart);
  const [employees] = await pool.execute(
    `SELECT id, full_name AS fullName, document_id AS documentId, position_name AS positionName
     FROM employees
     WHERE is_active = 1 AND work_area_id = :areaId
     ORDER BY full_name`,
    { areaId }
  );

  if (!employees.length) {
    return res.json({ area, weekStart, dates, employees: [], coverage: [] });
  }

  const employeeIds = employees.map((employee) => employee.id);
  const placeholders = employeeIds.map(() => '?').join(',');
  const [assignments] = await pool.query(
    `SELECT esc.employee_id AS employeeId,
            strftime('%Y-%m-%d', esc.work_date) AS workDate,
            esc.day_type AS dayType,
            s.id AS shiftId, s.name AS shiftName,
            substr(s.start_time, 1, 5) AS startTime,
            substr(s.end_time, 1, 5) AS endTime,
            s.break_minutes AS breakMinutes
     FROM employee_shift_calendar esc
     LEFT JOIN work_shifts s ON s.id = esc.shift_id
     WHERE esc.employee_id IN (${placeholders})
       AND esc.work_date BETWEEN ? AND ?
     ORDER BY esc.work_date`,
    [...employeeIds, dates[0], dates[6]]
  );

  const library=await getShiftLibrary(areaId);
  for (const assignment of assignments) {
    const shift=library.find(s=>s.id===assignment.shiftId);
    if (shift) { assignment.segments=shift.segments; assignment.workMinutes=shift.workMinutes; assignment.scheduleLabel=shift.label; }
  }
  const assignmentMap = new Map(assignments.map((assignment) => [
    `${assignment.employeeId}-${assignment.workDate}`,
    {
      ...assignment,
      dayType: assignment.dayType || 'work',
      shiftId: assignment.shiftId == null ? null : Number(assignment.shiftId),
      breakMinutes: Number(assignment.breakMinutes || 0),
      minutes: assignment.dayType === 'work'
        ? assignment.workMinutes ?? shiftMinutes(assignment.startTime, assignment.endTime, assignment.breakMinutes)
        : 0
    }
  ]));

  const employeesWithDays = employees.map((employee) => {
    const days = dates.map((date) => assignmentMap.get(`${employee.id}-${date}`) || {
      employeeId: employee.id,
      workDate: date,
      dayType: null,
      shiftId: null,
      shiftName: null,
      startTime: null,
      endTime: null,
      breakMinutes: 0,
      minutes: 0
    });
    return {
      ...employee,
      days,
      weeklyMinutes: days.reduce((total, day) => total + Number(day.minutes || 0), 0)
    };
  });

  const coverage = dates.map((date) => {
    const assignedStaff = employeesWithDays.filter((employee) => {
      const day = employee.days.find((item) => item.workDate === date);
      return day?.dayType === 'work' && day.shiftId;
    }).length;
    const requiredStaff = Number(area.requiredStaff || 0);
    return {
      date,
      requiredStaff,
      assignedStaff,
      missingStaff: Math.max(0, requiredStaff - assignedStaff),
      status: requiredStaff > 0 && assignedStaff < requiredStaff ? 'missing' : 'ok'
    };
  });

  res.json({ area, weekStart, dates, employees: employeesWithDays, coverage });
}));

schedulesRouter.put('/weekly/:employeeId', asyncHandler(async (req, res) => {
  await ensureScheduleTables();

  const employeeId = Number(req.params.employeeId);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return res.status(400).json({ message: 'Empleado invalido' });
  }

  const parsed = weeklyAssignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Asignacion semanal invalida' });
  }

  if (!(await assertActiveEmployee(employeeId))) {
    return res.status(404).json({ message: 'Empleado no encontrado' });
  }

  const dayType = parsed.data.dayType || null;
  const shiftId = parsed.data.shiftId || null;
  if (!dayType) {
    await pool.execute(
      'DELETE FROM employee_shift_calendar WHERE employee_id = :employeeId AND work_date = :workDate',
      { employeeId, workDate: parsed.data.workDate }
    );
    await recordAudit(req.admin, 'clear_weekly_schedule_day', 'employee', employeeId, {
      workDate: parsed.data.workDate
    });
    return res.json({ message: 'Dia limpiado' });
  }

  if (dayType === 'work') {
    if (!shiftId) {
      return res.status(400).json({ message: 'Selecciona un turno para un dia trabajado' });
    }
    if (!(await assertActiveShift(shiftId))) {
      return res.status(404).json({ message: 'Turno no encontrado' });
    }
  }

  await pool.execute(
    `INSERT INTO employee_shift_calendar (employee_id, work_date, shift_id, day_type)
     VALUES (:employeeId, :workDate, :shiftId, :dayType)
     ON CONFLICT DO UPDATE SET shift_id = excluded.shift_id, day_type = excluded.day_type, assigned_at = (datetime('now', 'localtime')), source_week_id = NULL`,
    {
      employeeId,
      workDate: parsed.data.workDate,
      shiftId: dayType === 'work' ? shiftId : null,
      dayType
    }
  );

  await recordAudit(req.admin, 'assign_weekly_schedule_day', 'employee', employeeId, {
    workDate: parsed.data.workDate,
    dayType,
    shiftId: dayType === 'work' ? shiftId : null
  });
  res.json({ message: 'Horario semanal actualizado' });
}));

schedulesRouter.put('/employees/:id', asyncHandler(async (req, res) => {
  await ensureScheduleTables();

  const employeeId = Number(req.params.id);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return res.status(400).json({ message: 'Empleado invalido' });
  }

  const parsed = assignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Asignacion invalida' });
  }

  if (parsed.data.shiftId === null) {
    await pool.execute(
      'DELETE FROM employee_shift_assignments WHERE employee_id = :employeeId',
      { employeeId }
    );
    await recordAudit(req.admin, 'unassign_shift', 'employee', employeeId);
    return res.json({ message: 'Turno quitado' });
  }

  const [employees] = await pool.execute(
    'SELECT id FROM employees WHERE id = :employeeId AND is_active = 1 LIMIT 1',
    { employeeId }
  );
  if (!employees.length) {
    return res.status(404).json({ message: 'Empleado no encontrado' });
  }

  const [shifts] = await pool.execute(
    'SELECT id FROM work_shifts WHERE id = :shiftId AND is_active = 1 LIMIT 1',
    { shiftId: parsed.data.shiftId }
  );
  if (!shifts.length) {
    return res.status(404).json({ message: 'Turno no encontrado' });
  }

  await pool.execute(
    `INSERT INTO employee_shift_assignments (employee_id, shift_id)
     VALUES (:employeeId, :shiftId)
     ON CONFLICT DO UPDATE SET shift_id = excluded.shift_id, assigned_at = (datetime('now', 'localtime'))`,
    { employeeId, shiftId: parsed.data.shiftId }
  );

  await recordAudit(req.admin, 'assign_shift', 'employee', employeeId, {
    shiftId: parsed.data.shiftId
  });
  res.json({ message: 'Turno asignado' });
}));
