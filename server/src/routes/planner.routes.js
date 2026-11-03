import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin, requireRoles } from "../auth.js";
import { asyncHandler } from "../asyncHandler.js";
import { runMigrations } from "../migrations.js";
import {
  normalizeSegments,
  shiftPresentation,
  weekDates,
} from "../shiftTime.js";
import { recordAudit } from "../auditLog.js";
import {medicalLeaveDays} from "../medicalLeaves.js";

export const plannerRouter = Router();
const edit = requireRoles("admin", "supervisor");
const fail = (status, message) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};
const types = ["work", "rest", "leave", "vacation", "permit", "absence"];
const cellSchema = z
  .object({
    dayType: z.enum(types),
    shiftId: z.number().int().positive().nullable(),
    availability: z
      .enum(["leave", "vacation", "permit", "absence"])
      .nullable()
      .optional(),
  })
  .nullable();
const weekSchema = z.object({
  revision: z.number().int().nonnegative(),
  requiredStaff: z.array(z.number().int().min(0).max(200)).length(7),
  rows: z
    .array(
      z.object({
        id: z.string().regex(/^[\w-]{1,80}$/),
        label: z.string().trim().min(1).max(80),
        employeeId: z.number().int().positive().nullable(),
        days: z.array(cellSchema).length(7),
      }),
    )
    .max(200),
});
const parsed = (schema, body) => {
  const result = schema.safeParse(body);
  if (!result.success)
    fail(
      400,
      "Datos del planificador invalidos. Revisa las filas, fechas y turnos.",
    );
  return result.data;
};
function selector(req) {
  const areaId = Number(req.query.areaId),
    weekStart = String(req.query.weekStart || "");
  if (!Number.isInteger(areaId) || areaId < 1) fail(400, "Selecciona un area.");
  try {
    weekDates(weekStart);
  } catch (error) {
    fail(400, error.message);
  }
  return { areaId, weekStart };
}
async function area(areaId, db = pool) {
  const [areas] = await db.execute(
    "SELECT id,name,required_staff AS requiredStaff FROM work_areas WHERE id=? AND is_active=1",
    [areaId],
  );
  if (!areas.length) fail(404, "Area activa no encontrada.");
  return areas[0];
}
export async function getShiftLibrary(areaId, db = pool) {
  const [shifts] = await db.execute(
    `SELECT s.id,s.name,s.group_id AS groupId,g.name AS groupName,substr(s.start_time,1,5) AS startTime,substr(s.end_time,1,5) AS endTime,s.break_minutes AS breakMinutes,
    COALESCE(ref.reference_frequency,0) AS referenceFrequency,COALESCE(ref.source,'existente') AS source,
    (SELECT COUNT(*) FROM planner_cells pc JOIN planner_rows pr ON pr.id=pc.row_id JOIN planner_weeks pw ON pw.id=pr.week_id WHERE pw.area_id=:areaId AND pc.shift_id=s.id) AS usageCount
    FROM work_shifts s JOIN shift_groups g ON g.id=s.group_id AND g.is_active=1
    LEFT JOIN shift_area_references ref ON ref.shift_id=s.id AND ref.area_id=:areaId
    WHERE s.is_active=1
    ORDER BY s.start_time ASC,s.end_time ASC,s.name ASC,usageCount DESC,referenceFrequency DESC`,
    { areaId },
  );
  const [segments] = await db.execute(
    "SELECT shift_id AS shiftId,start_time AS startTime,end_time AS endTime,start_day_offset AS startDayOffset,end_day_offset AS endDayOffset FROM work_shift_segments ORDER BY shift_id,segment_order",
  );
  return shifts.map((s) =>
    shiftPresentation(
      s,
      segments.filter((segment) => segment.shiftId === s.id),
    ),
  );
}
async function readWeek({ areaId, weekStart }, db = pool) {
  const selectedArea = await area(areaId, db),
    dates = weekDates(weekStart);
  const [weeks] = await db.execute(
    "SELECT id,status,revision,required_staff_json AS requiredJson,published_at AS publishedAt FROM planner_weeks WHERE area_id=? AND week_start=?",
    [areaId, weekStart],
  );
  const leaveDays = await medicalLeaveDays(dates[0], dates[6], db);
  const week = weeks[0];
  if (!week)
    return {
      id: null,
      area: selectedArea,
      weekStart,
      dates,
      status: "draft",
      revision: 0,
      requiredStaff: Array(7).fill(selectedArea.requiredStaff),
      rows: [],
      publishedAt: null,
      medicalLeaveDays: leaveDays,
    };
  const [rows] = await db.execute(
    `SELECT pr.id,pr.label,pr.employee_id AS employeeId,
    CASE WHEN e.is_active=1 AND e.work_area_id=? THEN 1 ELSE 0 END AS employeeAvailable
    FROM planner_rows pr LEFT JOIN employees e ON e.id=pr.employee_id WHERE pr.week_id=? ORDER BY pr.position`,
    [areaId, week.id],
  );
  const [cells] = await db.execute(
    "SELECT pc.row_id AS rowId,pc.day_index AS dayIndex,pc.shift_id AS shiftId,pc.day_type AS dayType,pc.availability FROM planner_cells pc JOIN planner_rows pr ON pr.id=pc.row_id WHERE pr.week_id=?",
    [week.id],
  );
  return {
    id: week.id,
    area: selectedArea,
    weekStart,
    dates,
    status: week.status,
    revision: week.revision,
    publishedAt: week.publishedAt,
    medicalLeaveDays: leaveDays,
    requiredStaff: JSON.parse(week.requiredJson),
    rows: rows.map((row) => ({
      ...row,
      days: dates.map((_date, index) => {
        const cell = cells.find(
          (c) => c.rowId === row.id && c.dayIndex === index,
        );
        return cell
          ? {
              dayType: cell.dayType,
              shiftId: cell.shiftId,
              availability: cell.availability,
            }
          : null;
      }),
    })),
  };
}
function coverage(week) {
  return week.dates.map((date, index) => {
    const workRows = week.rows.filter(
      (row) => row.days[index]?.dayType === "work",
    );
    const assigned = workRows.filter((row) => row.employeeId);
    const available = assigned.filter(
      (row) => row.employeeAvailable && !row.days[index].availability && !week.medicalLeaveDays.some(leave=>leave.employeeId===row.employeeId && leave.date===date),
    );
    return {
      date,
      requiredStaff: week.requiredStaff[index],
      planned: workRows.length,
      assigned: assigned.length,
      available: available.length,
      missing: Math.max(0, week.requiredStaff[index] - available.length),
    };
  });
}
plannerRouter.use(
  requireAdmin,
  asyncHandler(async (_req, _res, next) => {
    await runMigrations();
    next();
  }),
);
plannerRouter.get(
  "/library",
  asyncHandler(async (req, res) => {
    const areaId = Number(req.query.areaId);
    await area(areaId);
    res.json({ shifts: await getShiftLibrary(areaId) });
  }),
);
plannerRouter.post(
  "/library",
  edit,
  asyncHandler(async (req, res) => {
    const data = parsed(
      z.object({
        areaId: z.number().int().positive(),
        name: z.string().trim().min(2).max(100).optional(),
        breakMinutes: z.number().int().min(0).max(240).default(30),
        segments: z
          .array(z.object({ startTime: z.string(), endTime: z.string() }))
          .min(1)
          .max(4),
      }),
      req.body,
    );
    await area(data.areaId);
    let model;
    try {
      model = normalizeSegments(data.segments, data.breakMinutes);
    } catch (error) {
      fail(400, error.message);
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const automaticName = `Rotativo ${model.segments.map((segment) => `${segment.startTime}–${segment.endTime}`).join(" / ")}`;
      const [existing] = await connection.execute(
        "SELECT id FROM work_shifts WHERE name=?",
        [automaticName],
      );
      if (existing.length)
        fail(
          409,
          "Ese horario ya existe en Rotativo. Selecciona el horario existente.",
        );
      const [result] = await connection.execute(
        "INSERT INTO work_shifts(name,start_time,end_time,break_minutes,group_id) VALUES(?,?,?,?,(SELECT id FROM shift_groups WHERE name='Rotativo'))",
        [
          automaticName,
          model.segments[0].startTime,
          model.segments.at(-1).endTime,
          model.breakMinutes,
        ],
      );
      for (const [index, s] of model.segments.entries())
        await connection.execute(
          "INSERT INTO work_shift_segments VALUES(?,?,?,?,?,?)",
          [
            result.insertId,
            index,
            s.startTime,
            s.endTime,
            s.startDayOffset,
            s.endDayOffset,
          ],
        );
      await connection.execute(
        "INSERT INTO shift_area_references(area_id,shift_id) VALUES(?,?)",
        [data.areaId, result.insertId],
      );
      await recordAudit(
        req.admin,
        "create_segmented_shift",
        "work_shift",
        result.insertId,
        { areaId: data.areaId, name: automaticName, ...model },
        connection,
      );
      await connection.commit();
      res.status(201).json({ id: result.insertId });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }),
);
plannerRouter.get(
  "/week",
  asyncHandler(async (req, res) => {
    const week = await readWeek(selector(req));
    res.json({ ...week, coverage: coverage(week) });
  }),
);
plannerRouter.put(
  "/week",
  edit,
  asyncHandler(async (req, res) => {
    const select = selector(req),
      data = parsed(weekSchema, req.body);
    const ids = data.rows.map((row) => row.id),
      employees = data.rows
        .filter((row) => row.employeeId)
        .map((row) => row.employeeId);
    if (
      new Set(ids).size !== ids.length ||
      new Set(employees).size !== employees.length
    )
      fail(400, "Una persona solo puede ocupar una fila de esta semana.");
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const week = await readWeek(select, connection);
      if (week.status === "published")
        fail(
          409,
          "El horario esta publicado. Abre una revision antes de editar.",
        );
      if (week.revision !== data.revision)
        fail(409, "Otra persona cambio la semana. Actualiza antes de guardar.");
      for (const id of ids) {
        const [existingRows] = await connection.execute(
          "SELECT week_id FROM planner_rows WHERE id=?",
          [id],
        );
        if (existingRows.length && existingRows[0].week_id !== week.id)
          fail(
            409,
            "Una fila pertenece a otra semana. Copia los puestos usando filas nuevas.",
          );
      }
      // La licencia no borra turnos históricos: se rechaza únicamente una nueva asignación.
      for (const proposed of data.rows) {
        if (!proposed.employeeId) continue;
        for (const [day,cell] of proposed.days.entries()) {
          if (!cell || cell.dayType !== "work") continue;
          const date=week.dates[day];
          if (!week.medicalLeaveDays.some(leave=>leave.employeeId===proposed.employeeId && leave.date===date)) continue;
          const original=week.rows.find(row=>row.id===proposed.id);
          const prior=original?.days[day];
          if (original?.employeeId!==proposed.employeeId || prior?.dayType!=='work' || prior.shiftId!==cell.shiftId)
            fail(409, "No se puede asignar un turno nuevo durante una licencia médica. Los turnos anteriores se mantienen resaltados en rojo.");
        }
      }
      const library = await getShiftLibrary(select.areaId, connection),
        shiftIds = new Set(library.map((s) => s.id));
      for (const row of data.rows) {
        if (row.employeeId) {
          const [person] = await connection.execute(
            "SELECT id FROM employees WHERE id=? AND is_active=1 AND work_area_id=?",
            [row.employeeId, select.areaId],
          );
          if (!person.length)
            fail(400, "El trabajador debe estar activo y pertenecer al area.");
        }
        for (const cell of row.days)
          if (cell) {
            if (cell.dayType === "work" && !shiftIds.has(cell.shiftId))
              fail(400, "Hay un horario que ya no está disponible en la biblioteca de turnos.");
            if (
              cell.dayType !== "work" &&
              (cell.shiftId !== null || cell.availability)
            )
              fail(400, "Descanso y ausencias no deben tener un turno.");
          }
      }
      let weekId = week.id;
      if (!weekId) {
        const [created] = await connection.execute(
          "INSERT INTO planner_weeks(area_id,week_start,required_staff_json) VALUES(?,?,?)",
          [select.areaId, select.weekStart, JSON.stringify(data.requiredStaff)],
        );
        weekId = created.insertId;
      }
      await connection.execute("DELETE FROM planner_rows WHERE week_id=?", [
        weekId,
      ]);
      for (const [position, row] of data.rows.entries()) {
        await connection.execute("INSERT INTO planner_rows VALUES(?,?,?,?,?)", [
          row.id,
          weekId,
          position,
          row.label,
          row.employeeId,
        ]);
        for (const [index, cell] of row.days.entries())
          if (cell)
            await connection.execute(
              "INSERT INTO planner_cells VALUES(?,?,?,?,?)",
              [
                row.id,
                index,
                cell.shiftId,
                cell.dayType,
                cell.availability || null,
              ],
            );
      }
      await connection.execute(
        "UPDATE planner_weeks SET required_staff_json=?,revision=revision+1 WHERE id=?",
        [JSON.stringify(data.requiredStaff), weekId],
      );
      await recordAudit(
        req.admin,
        "save_weekly_draft",
        "planner_week",
        weekId,
        {
          rows: data.rows.length,
          weekStart: select.weekStart,
          areaId: select.areaId,
        },
        connection,
      );
      await connection.commit();
      res.json(await readWeek(select));
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }),
);
plannerRouter.post(
  "/week/publish",
  edit,
  asyncHandler(async (req, res) => {
    const select = selector(req),
      data = parsed(
        z.object({
          revision: z.number().int().nonnegative(),
          allowIncomplete: z.boolean().default(false),
          replaceExisting: z.boolean().default(false),
        }),
        req.body,
      );
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const week = await readWeek(select, connection);
      if (
        !week.id ||
        week.status !== "draft" ||
        week.revision !== data.revision
      )
        fail(409, "Guarda el borrador actual antes de publicar.");
      if (!week.rows.length || !week.rows.some((row) => row.days.some(Boolean)))
        fail(400, "La semana no contiene horarios para publicar.");
      const totals = coverage(week);
      const unassigned = week.rows.filter(
        (row) =>
          !row.employeeId && row.days.some((cell) => cell?.dayType === "work"),
      ).length;
      if (
        !data.allowIncomplete &&
        (unassigned || totals.some((day) => day.missing))
      )
        fail(
          409,
          "Hay puestos sin asignar o cobertura incompleta. Revisa el resumen y confirma si deseas publicar con faltantes.",
        );
      const library = await getShiftLibrary(select.areaId, connection),
        shiftIds = new Set(library.map((s) => s.id));
      for (const row of week.rows)
        if (row.employeeId) {
          const [person] = await connection.execute(
            "SELECT id FROM employees WHERE id=? AND is_active=1 AND work_area_id=?",
            [row.employeeId, select.areaId],
          );
          if (!person.length)
            fail(
              409,
              "Un trabajador ya no esta disponible en el area. Revisa su asignacion.",
            );
          for (const [index, cell] of row.days.entries())
            if (cell) {
              if (cell.dayType === "work" && !shiftIds.has(cell.shiftId))
                fail(409, "Un turno ya no esta activo. Revisa la semana.");
              const [existing] = await connection.execute(
                "SELECT source_week_id AS source FROM employee_shift_calendar WHERE employee_id=? AND work_date=?",
                [row.employeeId, week.dates[index]],
              );
              if (
                existing.length &&
                existing[0].source !== week.id &&
                !data.replaceExisting
              )
                fail(
                  409,
                  "Hay asignaciones previas fuera de este plan. Confirma su reemplazo en el resumen de publicacion.",
                );
            }
        }
      await connection.execute(
        "DELETE FROM employee_shift_calendar WHERE source_week_id=?",
        [week.id],
      );
      for (const row of week.rows)
        if (row.employeeId)
          for (const [index, cell] of row.days.entries())
            if (cell) {
              const dayType = cell.availability || cell.dayType;
              await connection.execute(
                `INSERT INTO employee_shift_calendar(employee_id,work_date,shift_id,day_type,source_week_id) VALUES(?,?,?,?,?)
        ON CONFLICT(employee_id,work_date) DO UPDATE SET shift_id=excluded.shift_id,day_type=excluded.day_type,source_week_id=excluded.source_week_id,assigned_at=datetime('now','localtime')`,
                [
                  row.employeeId,
                  week.dates[index],
                  dayType === "work" ? cell.shiftId : null,
                  dayType,
                  week.id,
                ],
              );
            }
      await connection.execute(
        "UPDATE planner_weeks SET status='published',revision=revision+1,published_at=datetime('now','localtime'),published_by=? WHERE id=?",
        [req.admin.id, week.id],
      );
      await recordAudit(
        req.admin,
        "publish_weekly_schedule",
        "planner_week",
        week.id,
        { coverage: totals, unassigned, ...data },
        connection,
      );
      await connection.commit();
      res.json(await readWeek(select));
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }),
);
plannerRouter.post(
  "/week/reopen",
  edit,
  asyncHandler(async (req, res) => {
    const select = selector(req),
      data = parsed(
        z.object({ revision: z.number().int().nonnegative() }),
        req.body,
      );
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const week = await readWeek(select, connection);
      if (
        !week.id ||
        week.status !== "published" ||
        week.revision !== data.revision
      )
        fail(409, "La semana cambio. Actualiza antes de abrir una revision.");
      await connection.execute(
        "UPDATE planner_weeks SET status='draft',revision=revision+1 WHERE id=?",
        [week.id],
      );
      await recordAudit(
        req.admin,
        "reopen_weekly_schedule",
        "planner_week",
        week.id,
        { weekStart: select.weekStart },
        connection,
      );
      await connection.commit();
      res.json(await readWeek(select));
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }),
);
