import { expectedAttendanceReport, loadAttendanceContext, scheduleIntervals, monthRange, summarizeScheduleDay } from '../attendanceReport.js';
import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAdmin } from '../auth.js';
import { asyncHandler } from '../asyncHandler.js';
import { getConfiguredDateTime, getSystemSettings } from '../systemSettings.js';
import { ensureEmployeeAccessColumns } from '../employeeAccess.js';
import { sendAttendanceNotification } from '../pushNotifications.js';
import { ATTENDANCE_TYPES, ensureAttendanceRecordTypes } from '../attendanceSchema.js';
import bcrypt from 'bcryptjs';
import { recordAudit } from '../auditLog.js';
import { attachAttendanceDurations } from '../attendancePairing.js';
import {createAttendanceProof} from '../attendanceProofs.js';

export const attendanceRouter = Router();

const attendanceSchema = z.object({
  template: z.string().min(10),
  type: z.enum(ATTENDANCE_TYPES)
});

const manualAttendanceSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  type: z.enum(ATTENDANCE_TYPES),
  registeredAt: z.string().min(10),
  reason: z.string().trim().min(5).max(255)
});

const codeAttendanceSchema = z.object({
  documentId: z.string().min(3),
  code: z.string().min(4),
  type: z.enum(ATTENDANCE_TYPES)
});

const voidAttendanceSchema = z.object({
  reason: z.string().trim().min(5).max(255)
});

attendanceRouter.post('/register', (_req,res)=>res.status(410).json({message:'Método de identificación retirado. Usa QR o PIN en una terminal autorizada.'}));
attendanceRouter.post('/register-code', (_req,res)=>res.status(410).json({message:'Método de identificación retirado. Usa QR o PIN en una terminal autorizada.'}));
attendanceRouter.get('/records', requireAdmin, asyncHandler(async (req, res) => {
  await ensureAttendanceRecordTypes();

  const { from, to, employeeId, type } = req.query;
  const params = {
    from: from || '1970-01-01',
    to: to || '2999-12-31',
    employeeId: employeeId ? Number(employeeId) : null,
    type: type || null
  };

  const [rows] = await pool.execute(
    `SELECT ar.id, ar.record_type AS type, ar.registered_at AS registeredAt,
            COALESCE(ar.mark_method,'ANTERIOR') AS markMethod,
            CASE WHEN ar.mark_method IS NOT NULL THEN ar.device_name ELSE 'Registro anterior' END AS terminalName,
            DATE(ar.registered_at) AS recordDate,
            e.id AS employeeId, e.full_name AS fullName, e.document_id AS documentId,
            s.name AS shiftName,
            substr(s.start_time, 1, 5) AS scheduledStart,
            substr(s.end_time, 1, 5) AS scheduledEnd,
            CASE
              WHEN ar.record_type = 'entrada' AND s.start_time IS NOT NULL THEN
                max(0, minutes_between( local_timestamp(DATE(ar.registered_at), s.start_time), ar.registered_at))
              ELSE NULL
            END AS lateMinutes
     FROM attendance_records ar
     INNER JOIN employees e ON e.id = ar.employee_id
     LEFT JOIN employee_shift_calendar esc ON esc.employee_id = ar.employee_id
       AND esc.work_date = DATE(ar.registered_at)
     LEFT JOIN work_shifts s ON s.id = esc.shift_id AND s.is_active = 1
     WHERE DATE(ar.registered_at) BETWEEN date(:from, '-1 day') AND :to
       AND ar.is_void = 0
       AND (:employeeId IS NULL OR e.id = :employeeId)
     ORDER BY ar.registered_at ASC`,
    params
  );

  const context = await loadAttendanceContext(params.from,params.to,params.employeeId || 0);
  for (const record of rows) {
    const schedule=context.recordSchedule.get(record.id);
    if (schedule?.shift) {
      record.shiftName=schedule.shift.name;
      record.scheduledStart=schedule.shift.segments[0].startTime;
      record.scheduledEnd=schedule.shift.segments.at(-1).endTime;
      record.scheduleLabel=schedule.shift.label;
      record.workDate=schedule.workDate;
      if (record.type==='entrada') {
        const time=Date.parse(String(record.registeredAt).replace(' ','T').slice(0,19)+'Z');
        const interval=scheduleIntervals(schedule.workDate,schedule.shift).sort((a,b)=>Math.abs(time-a.start)-Math.abs(time-b.start))[0];
        record.lateMinutes=Math.max(0,Math.trunc((time-interval.start)/60000));
      }
    }
  }
  const recordsWithDuration = attachAttendanceDurations(rows, params);

  res.json({ records: recordsWithDuration });
}));

attendanceRouter.get('/summary', requireAdmin, asyncHandler(async (req, res) => {
  await ensureAttendanceRecordTypes();
  const date = String(req.query.date || new Date().toISOString().slice(0, 10));
  const [employees] = await pool.execute(
    'SELECT id, full_name AS fullName FROM employees WHERE is_active = 1 ORDER BY full_name'
  );
  const [records] = await pool.execute(
    `SELECT ar.id, ar.employee_id AS employeeId, ar.record_type AS type, ar.registered_at AS registeredAt,
            e.full_name AS fullName,
            COALESCE(ar.mark_method,'ANTERIOR') AS markMethod,
            CASE WHEN ar.mark_method IS NOT NULL THEN ar.device_name ELSE 'Registro anterior' END AS terminalName
     FROM attendance_records ar
     INNER JOIN employees e ON e.id = ar.employee_id
     WHERE DATE(ar.registered_at) = :date
       AND ar.is_void = 0
     ORDER BY ar.registered_at ASC`,
    { date }
  );

  const stateByEmployee = new Map();
  const alertItems = [];
  for (const employee of employees) {
    stateByEmployee.set(employee.id, {
      employee,
      inside: false,
      mealOpen: false,
      openMealType: null,
      hasEntrada: false,
      hasSalida: false,
      lastRecord: null
    });
  }

  for (const record of records) {
    const state = stateByEmployee.get(record.employeeId);
    if (!state) continue;
    state.lastRecord = record;
    if (record.type === 'entrada') {
      state.inside = true;
      state.hasEntrada = true;
    }
    if (record.type === 'salida') {
      state.inside = false;
      state.hasSalida = true;
    }
    if (['entrada_colacion', 'salida_colacion'].includes(record.type)) {
      if (!state.mealOpen) {
        state.mealOpen = true;
        state.openMealType = record.type;
      } else if (state.openMealType !== record.type) {
        state.mealOpen = false;
        state.openMealType = null;
      }
    }
  }

  const states = [...stateByEmployee.values()];
  for (const state of states) {
    if (state.hasEntrada && !state.hasSalida) {
      alertItems.push({ type: 'open_shift', label: `${state.employee.fullName} mantiene jornada abierta` });
    }
    if (state.mealOpen) {
      alertItems.push({ type: 'open_meal', label: `${state.employee.fullName} mantiene colacion abierta` });
    }
  }

  res.json({
    summary: {
      date,
      totalEmployees: employees.length,
      presentCount: states.filter((state) => state.inside).length,
      activeMeals: states.filter((state) => state.mealOpen).length,
      openShifts: states.filter((state) => state.hasEntrada && !state.hasSalida).length,
      completedShifts: states.filter((state) => state.hasEntrada && state.hasSalida).length,
      alerts: alertItems,
      recentRecords: records.slice(-8).reverse()
    }
  });
}));

attendanceRouter.get('/calendar', requireAdmin, asyncHandler(async (req, res) => {
  await ensureAttendanceRecordTypes();
  const employeeId=Number(req.query.employeeId || 0);
  const month=String(req.query.month || new Date().toISOString().slice(0,7));
  if (!Number.isInteger(employeeId) || employeeId<0) return res.status(400).json({message:'Empleado invalido.'});
  const {from,to}=monthRange(month);
  const context=await loadAttendanceContext(from,to,employeeId);
  const grouped=new Map();
  for (const day of context.days) {
    if (!day.records.length) continue;
    const summary=summarizeScheduleDay(day,day.records);
    const item=grouped.get(day.workDate) || {date:day.workDate,entries:0,exits:0,mealMarks:0,totalRecords:0,status:'complete'};
    item.entries+=day.records.filter(r=>r.type==='entrada').length;
    item.exits+=day.records.filter(r=>r.type==='salida').length;
    item.mealMarks+=summary.mealMarks;item.totalRecords+=summary.totalRecords;
    const unpaired=day.records.filter(r=>r.type==='entrada').length!==day.records.filter(r=>r.type==='salida').length;
    if (summary.status==='incomplete' || unpaired) item.status='incomplete';
    grouped.set(day.workDate,item);
  }
  res.json({month,from,days:[...grouped.values()].sort((a,b)=>a.date.localeCompare(b.date))});
}));

attendanceRouter.get('/expected-report', requireAdmin, asyncHandler(async (req, res) => {
  await ensureAttendanceRecordTypes();

  const month = String(req.query.month || new Date().toISOString().slice(0, 7));
  const employeeId = Number(req.query.employeeId || 0);
  if (!/^\d{4}-\d{2}$/.test(month) || !Number.isInteger(employeeId) || employeeId < 0) {
    return res.status(400).json({ message: 'Filtros de reporte invalidos' });
  }

  const items = await expectedAttendanceReport(month,employeeId);

  res.json({
    month,
    employeeId,
    summary: {
      reportDays: items.length,
      scheduledDays: items.filter((item) => item.dayType === 'work' && item.shiftId != null).length,
      justifiedDays: items.filter((item) => ['rest', 'leave', 'vacation', 'permit'].includes(item.status)).length,
      unplannedDays: items.filter((item) => item.status === 'unplanned').length,
      absentDays: items.filter((item) => item.status === 'absent').length,
      incompleteDays: items.filter((item) => item.status === 'incomplete').length,
      daysWithObservations: items.filter((item) => item.status === 'with_observations').length,
      totalLateMinutes: items.reduce((total, item) => total + Number(item.lateMinutes || 0), 0),
      totalMealMinutes: items.reduce((total, item) => total + Number(item.mealMinutes || 0), 0),
      totalMissingMinutes: items.reduce((total, item) => total + Number(item.missingMinutes || 0), 0),
      totalOvertimeMinutes: items.reduce((total, item) => total + Number(item.overtimeMinutes || 0), 0)
    },
    items
  });
}));

attendanceRouter.post('/records/manual', requireAdmin, asyncHandler(async (req, res) => {
  await ensureAttendanceRecordTypes();

  const parsed = manualAttendanceSchema.safeParse(req.body);
  if (!parsed.success || Number.isNaN(new Date(parsed.data.registeredAt).getTime())) {
    return res.status(400).json({ message: 'Datos de marca manual invalidos' });
  }

  const [employees] = await pool.execute(
    `SELECT id, full_name AS fullName, document_id AS documentId
     FROM employees
     WHERE id = :employeeId AND is_active = 1
     LIMIT 1`,
    { employeeId: parsed.data.employeeId }
  );

  if (!employees.length) {
    return res.status(404).json({ message: 'Empleado no encontrado' });
  }

  // Los registros nuevos se sellan y auditan en una misma transacción.
  // El flujo DT de oposición de 48 horas sigue pendiente y se marca como brecha.
  const db=await pool.getConnection();
  let id,integrityProof;
  try{
    await db.beginTransaction();
    const [result]=await db.execute(
      `INSERT INTO attendance_records
       (employee_id,record_type,registered_at,notes,correction_reason,created_by_admin_id,device_name,mark_method)
       VALUES(?,?,?,?,?,?,'Administración','MANUAL')`,
      [parsed.data.employeeId,parsed.data.type,parsed.data.registeredAt.replace('T',' '),
       `Marca manual admin ${req.admin.username}`,parsed.data.reason,req.admin.id]
    );
    id=result.insertId;
    integrityProof=await createAttendanceProof(db,id);
    await recordAudit(req.admin,'create_manual_record','attendance_record',id,{
      employeeId:parsed.data.employeeId,type:parsed.data.type,
      registeredAt:parsed.data.registeredAt,reason:parsed.data.reason
    },db);
    await db.commit();
  }catch(e){await db.rollback();throw e;}finally{db.release();}
  await sendAttendanceNotification({
    employee:employees[0],
    record:{id,type:parsed.data.type,registeredAt:parsed.data.registeredAt,integrityProof},
    source:'manual'
  });
  res.status(201).json({
    id,message:'Marca manual creada; el procedimiento DT de rectificación sigue pendiente.',
    integrityProof,integrityStatus:'VERIFIED'
  });
}));

attendanceRouter.delete('/records/:id', requireAdmin, asyncHandler(async (req, res) => {
  await ensureAttendanceRecordTypes();

  const parsed = voidAttendanceSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ message: 'Debes indicar un motivo de anulacion' });
  }

  const recordId = Number(req.params.id);
  if (!Number.isInteger(recordId) || recordId <= 0) {
    return res.status(400).json({ message: 'Registro invalido' });
  }

  const [records] = await pool.execute(
    `SELECT ar.id, ar.employee_id AS employeeId, ar.record_type AS type, ar.registered_at AS registeredAt,
            ar.notes, e.full_name AS fullName
     FROM attendance_records ar
     INNER JOIN employees e ON e.id = ar.employee_id
     WHERE ar.id = :recordId AND ar.is_void = 0
     LIMIT 1`,
    { recordId }
  );

  if (!records.length) {
    return res.status(404).json({ message: 'Registro no encontrado o ya anulado' });
  }

  const [result] = await pool.execute(
    `UPDATE attendance_records
     SET is_void = 1,
         voided_at = (datetime('now', 'localtime')),
         voided_by = :voidedBy,
         void_reason = :voidReason
     WHERE id = :recordId AND is_void = 0`,
    { recordId, voidedBy: req.admin.id, voidReason: parsed.data.reason }
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({ message: 'Registro no encontrado' });
  }

  await recordAudit(req.admin, 'void', 'attendance_record', recordId, {
    reason: parsed.data.reason,
    before: records[0]
  });
  res.json({ message: 'Marca anulada' });
}));
