import { pool } from "./db.js";
import { shiftPresentation } from "./shiftTime.js";

const stamp = (value) =>
  Date.parse(String(value).replace(" ", "T").slice(0, 19) + "Z");
const dateOf = (value) => String(value).slice(0, 10);
const addDate = (date, days) =>
  new Date(stamp(`${date} 12:00:00`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
const minutes = (ms) => Math.max(0, Math.trunc(ms / 60000));
export function monthRange(month) {
  const first = new Date(`${month}-01T12:00:00Z`);
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
    !Number.isFinite(first.getTime())
  ) {
    const error = new Error("Mes invalido.");
    error.status = 400;
    throw error;
  }
  const last = new Date(first);
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  return { from: `${month}-01`, to: last.toISOString().slice(0, 10) };
}
export function scheduleIntervals(workDate, shift) {
  const midnight = stamp(`${workDate} 00:00:00`);
  return shift.segments.map((s) => ({
    start: midnight + s.startMinute * 60000,
    end: midnight + s.endMinute * 60000,
  }));
}
export function summarizeScheduleDay(schedule, records) {
  const intervals = schedule.shift
    ? scheduleIntervals(schedule.workDate, schedule.shift)
    : [];
  const ordered = [...records].sort(
    (a, b) => stamp(a.registeredAt) - stamp(b.registeredAt),
  );
  const sessions = [];
  let open = null,
    openMeal = null,
    mealMs = 0,
    incomplete = false;
  for (const record of ordered) {
    const time = stamp(record.registeredAt);
    if (record.type === "entrada") {
      if (open !== null) incomplete = true;
      open = time;
      openMeal = null;
    } else if (
      ["salida_colacion", "entrada_colacion"].includes(record.type) &&
      open !== null
    ) {
      if (!openMeal) openMeal = { type: record.type, time };
      else if (openMeal.type !== record.type) {
        mealMs += Math.max(0, time - openMeal.time);
        openMeal = null;
      } else incomplete = true;
    } else if (record.type === "salida") {
      if (open === null) incomplete = true;
      else {
        if (openMeal) incomplete = true;
        sessions.push({ start: open, end: time });
        open = null;
        openMeal = null;
      }
    }
  }
  if (open !== null) incomplete = true;
  const totalRecords = ordered.length,
    mealMarks = ordered.filter((r) => r.type.includes("colacion")).length;
  const gross = minutes(
    sessions.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0),
  );
  const mealMinutes = mealMs ? minutes(mealMs) : null;
  const actualMinutes = sessions.length
    ? Math.max(0, gross - (mealMinutes ?? schedule.shift?.breakMinutes ?? 0))
    : null;
  const work = schedule.dayType === "work";
  let lateMinutes = null,
    earlyLeaveMinutes = null,
    missingSegments = 0;
  if (work && intervals.length && sessions.length) {
    lateMinutes = 0;
    earlyLeaveMinutes = 0;
    for (const interval of intervals) {
      const matches = sessions.filter(
        (s) => s.start < interval.end && s.end > interval.start,
      );
      if (!matches.length) {
        missingSegments++;
        continue;
      }
      lateMinutes += minutes(
        Math.min(...matches.map((s) => s.start)) - interval.start,
      );
      earlyLeaveMinutes += minutes(
        interval.end - Math.max(...matches.map((s) => s.end)),
      );
    }
  }
  const expectedMinutes = work ? (schedule.shift?.workMinutes ?? null) : null;
  const overtimeMinutes =
    expectedMinutes !== null && actualMinutes !== null
      ? Math.max(0, actualMinutes - expectedMinutes)
      : null;
  const missingMinutes =
    expectedMinutes !== null && actualMinutes !== null
      ? Math.max(0, expectedMinutes - actualMinutes)
      : null;
  const status =
    !work && !totalRecords
      ? schedule.dayType
      : !work || !schedule.shift
        ? totalRecords
          ? "unplanned"
          : "no_shift"
        : !totalRecords
          ? "absent"
          : incomplete || missingSegments || !sessions.length
            ? "incomplete"
            : lateMinutes || earlyLeaveMinutes || missingMinutes
              ? "with_observations"
              : "complete";
  return {
    employeeId: schedule.employeeId,
    fullName: schedule.fullName,
    documentId: schedule.documentId,
    workDate: schedule.workDate,
    dayType: schedule.dayType,
    shiftId: schedule.shift?.id ?? null,
    shiftName: schedule.shift?.name ?? null,
    scheduledStart: schedule.shift?.segments[0].startTime ?? null,
    scheduledEnd: schedule.shift?.segments.at(-1).endTime ?? null,
    scheduleLabel: schedule.shift?.label ?? null,
    segments: schedule.shift?.segments ?? [],
    breakMinutes: schedule.shift?.breakMinutes ?? 0,
    firstEntry: ordered.find((r) => r.type === "entrada")?.registeredAt ?? null,
    lastExit:
      ordered.findLast((r) => r.type === "salida")?.registeredAt ?? null,
    mealStart:
      ordered.find((r) => r.type === "salida_colacion")?.registeredAt ?? null,
    mealEnd:
      ordered.findLast((r) => r.type === "entrada_colacion")?.registeredAt ??
      null,
    totalRecords,
    mealMarks,
    mealMinutes,
    actualMinutes,
    expectedMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    overtimeMinutes,
    missingMinutes,
    status,
  };
}
export async function loadAttendanceContext(from, to, employeeId = 0) {
  const [schedules] = await pool.execute(
    `SELECT esc.employee_id AS employeeId,esc.work_date AS workDate,esc.day_type AS dayType,e.full_name AS fullName,e.document_id AS documentId,
    s.id AS shiftId,s.name AS shiftName,substr(s.start_time,1,5) AS startTime,substr(s.end_time,1,5) AS endTime,s.break_minutes AS breakMinutes
    FROM employee_shift_calendar esc JOIN employees e ON e.id=esc.employee_id LEFT JOIN work_shifts s ON s.id=esc.shift_id
    WHERE esc.work_date BETWEEN :from AND :to AND (:employeeId=0 OR e.id=:employeeId)`,
    { from: addDate(from, -2), to: addDate(to, 1), employeeId },
  );
  const [segments] = await pool.execute(
    "SELECT shift_id AS shiftId,start_time AS startTime,end_time AS endTime FROM work_shift_segments ORDER BY shift_id,segment_order",
  );
  const days = schedules.map((s) => ({
    ...s,
    shift: s.shiftId
      ? shiftPresentation(
          {
            id: s.shiftId,
            name: s.shiftName,
            startTime: s.startTime,
            endTime: s.endTime,
            breakMinutes: s.breakMinutes,
          },
          segments.filter((p) => p.shiftId === s.shiftId),
        )
      : null,
    records: [],
  }));
  const [records] = await pool.execute(
    `SELECT ar.id,ar.employee_id AS employeeId,ar.record_type AS type,ar.registered_at AS registeredAt,e.full_name AS fullName,e.document_id AS documentId
    FROM attendance_records ar JOIN employees e ON e.id=ar.employee_id
    WHERE ar.is_void=0 AND date(ar.registered_at) BETWEEN :from AND :to AND (:employeeId=0 OR e.id=:employeeId) ORDER BY ar.registered_at,ar.id`,
    { from: addDate(from, -2), to: addDate(to, 2), employeeId },
  );
  const opening = new Map(),
    recordSchedule = new Map();
  for (const record of records) {
    const time = stamp(record.registeredAt),
      person = record.employeeId;
    let day = opening.get(person);
    if (record.type === "entrada" || !day) {
      const candidates = days
        .filter(
          (d) => d.employeeId === person && d.dayType === "work" && d.shift,
        )
        .map((d) => {
          const intervals = scheduleIntervals(d.workDate, d.shift);
          return {
            day: d,
            score: Math.min(...intervals.map((i) => Math.abs(time - i.start))),
            within:
              time >= intervals[0].start - 4 * 3600000 &&
              time <= intervals.at(-1).end + 4 * 3600000,
          };
        })
        .filter((c) => c.within)
        .sort((a, b) => a.score - b.score);
      day =
        candidates[0]?.day ||
        days.find(
          (d) =>
            d.employeeId === person &&
            d.workDate === dateOf(record.registeredAt),
        );
      if (!day) {
        day = {
          employeeId: person,
          fullName: record.fullName,
          documentId: record.documentId,
          workDate: dateOf(record.registeredAt),
          dayType: "work",
          shift: null,
          records: [],
        };
        days.push(day);
      }
    }
    if (record.type === "entrada") opening.set(person, day);
    day.records.push(record);
    recordSchedule.set(record.id, day);
    if (record.type === "salida") opening.delete(person);
  }
  return {
    days: days.filter((d) => d.workDate >= from && d.workDate <= to),
    recordSchedule,
  };
}
export async function expectedAttendanceReport(month, employeeId) {
  const { from, to } = monthRange(month);
  const { days } = await loadAttendanceContext(from, to, employeeId);
  return days
    .map((day) => summarizeScheduleDay(day, day.records))
    .sort(
      (a, b) =>
        a.workDate.localeCompare(b.workDate) ||
        a.fullName.localeCompare(b.fullName),
    );
}
