import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeSegments, weekDates } from "../shiftTime.js";
import { summarizeScheduleDay } from "../attendanceReport.js";
process.env.SQLITE_PATH = ":memory:";
process.env.JWT_SECRET = "weekly-planner-test-secret-000000000000";
// attendanceReport imports the lazy pool; no connection is opened before this setting.
const { app } = await import("../app.js");
const { pool } = await import("../db.js");
const { runMigrations } = await import("../migrations.js");
const { signAdmin } = await import("../auth.js");

const record = (type, registeredAt) => ({ type, registeredAt });
const summarize = (segments, records, breakMinutes = 30) =>
  summarizeScheduleDay(
    {
      employeeId: 1,
      fullName: "Prueba",
      documentId: "test",
      workDate: "2026-10-05",
      dayType: "work",
      shift: {
        id: 1,
        name: "Modelo prueba",
        ...normalizeSegments(segments, breakMinutes),
      },
    },
    records,
  );
test("Modelos: normal, nocturno y partido descuentan una sola colacion", () => {
  assert.equal(
    normalizeSegments([{ startTime: "08:00", endTime: "15:30" }]).workMinutes,
    420,
  );
  const night = normalizeSegments([{ startTime: "19:00", endTime: "02:30" }]);
  assert.equal(night.workMinutes, 420);
  assert.equal(night.segments[0].endDayOffset, 1);
  const split = normalizeSegments([
    { startTime: "12:00", endTime: "15:00" },
    { startTime: "20:00", endTime: "02:30" },
  ]);
  assert.equal(split.workMinutes, 540);
  assert.equal(split.segments[1].endDayOffset, 1);
  assert.throws(
    () =>
      normalizeSegments([
        { startTime: "12:00", endTime: "15:00" },
        { startTime: "14:00", endTime: "18:00" },
      ]),
    /superponen/,
  );
  assert.throws(() =>
    normalizeSegments([{ startTime: "08:00", endTime: "08:00" }]),
  );
  assert.throws(() =>
    normalizeSegments([{ startTime: "08:00", endTime: "09:00" }], 60),
  );
  assert.throws(() => weekDates("2026-10-06"), /lunes/);
});
test("Reportes: noche y tramos partidos excluyen el intervalo, mantienen atrasos e incompletos", () => {
  const night = summarize(
    [{ startTime: "19:00", endTime: "02:30" }],
    [
      record("entrada", "2026-10-05 19:00:00"),
      record("salida", "2026-10-06 02:30:00"),
    ],
  );
  assert.equal(night.status, "complete");
  assert.equal(night.actualMinutes, 420);
  const segments = [
    { startTime: "12:00", endTime: "15:00" },
    { startTime: "20:00", endTime: "02:30" },
  ];
  const records = [
    record("entrada", "2026-10-05 12:00:00"),
    record("salida", "2026-10-05 15:00:00"),
    record("entrada", "2026-10-05 20:10:00"),
    record("salida_colacion", "2026-10-05 23:00:00"),
    record("entrada_colacion", "2026-10-05 23:30:00"),
    record("salida", "2026-10-06 02:30:00"),
  ];
  const day = summarize(segments, records);
  assert.equal(day.expectedMinutes, 540);
  assert.equal(day.actualMinutes, 530);
  assert.equal(day.lateMinutes, 10);
  assert.equal(day.missingMinutes, 10);
  assert.equal(day.mealMinutes, 30);
  assert.equal(summarize(segments, records.slice(0, 2)).status, "incomplete");
  assert.equal(summarize(segments, records.slice(0, -1)).status, "incomplete");
  assert.equal(summarize(segments, []).status, "absent");
});
test("Migracion conserva asignaciones anteriores y aplica cada modelo una sola vez", async () => {
  const { createSqlitePool } = await import("../db.js");
  const { projectRoot } = await import("../databasePath.js");
  const path = await import("node:path");
  const database = createSqlitePool(":memory:");
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execScript(
      fs.readFileSync(path.join(projectRoot, "database/schema.sql"), "utf8"),
    );
    await connection.execute(
      "INSERT INTO employees(id,document_id,full_name) VALUES(1,'123','Persona anterior')",
    );
    await connection.execute(
      "INSERT INTO work_shifts(id,name,start_time,end_time,break_minutes) VALUES(1,'Anterior','19:00','02:30',30)",
    );
    await connection.execute(
      "INSERT INTO employee_shift_calendar(employee_id,work_date,shift_id,day_type) VALUES(1,'2026-10-05',1,'work')",
    );
    await connection.execScript(
      fs.readFileSync(
        path.join(
          projectRoot,
          "database/migrations/20261002_002_weekly_planner.sql",
        ),
        "utf8",
      ),
    );
    const [rows] = await connection.execute(
      "SELECT employee_id,work_date,shift_id,day_type,source_week_id FROM employee_shift_calendar",
    );
    assert.deepEqual(rows, [
      {
        employee_id: 1,
        work_date: "2026-10-05",
        shift_id: 1,
        day_type: "work",
        source_week_id: null,
      },
    ]);
    const [segments] = await connection.execute(
      "SELECT end_day_offset FROM work_shift_segments",
    );
    assert.equal(segments[0].end_day_offset, 1);
    await connection.commit();
  } finally {
    connection.release();
    await database.end();
  }
});
test("Planificador API: borrador, cobertura, conflictos, revision, publicacion atomica y reporte nocturno", async () => {
  await runMigrations();
  const [firstMigrations] = await pool.execute(
    "SELECT id FROM schema_migrations ORDER BY id",
  );
  for (const id of ['20261002_001_sqlite_schema', '20261002_002_weekly_planner', '20261004_004_shift_groups'])
    assert.ok(firstMigrations.some(migration => migration.id === id), `Falta migración requerida: ${id}`);
  await runMigrations();
  const [secondMigrations] = await pool.execute(
    "SELECT id FROM schema_migrations ORDER BY id",
  );
  assert.deepEqual(secondMigrations, firstMigrations, 'Repetir las migraciones no debe agregar ni cambiar registros');
  assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0], []);
  const [count] = await pool.execute(
    "SELECT COUNT(*) AS n FROM shift_area_references",
  );
  assert.equal(count[0].n, 77);
  const [admin] = await pool.execute(
    "INSERT INTO admins(username,password_hash,full_name) VALUES('planner','test','Prueba')",
  );
  const token = signAdmin({
    id: admin.insertId,
    username: "planner",
    role: "admin",
  });
  const viewer = signAdmin({
    id: admin.insertId,
    username: "planner",
    role: "viewer",
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(
    route,
    method = "GET",
    body,
    status = 200,
    auth = token,
  ) {
    const response = await fetch(base + route, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${auth}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    assert.equal(
      response.status,
      status,
      `${method} ${route}: ${JSON.stringify(data)}`,
    );
    return data;
  }
  try {
    const [areas] = await pool.execute(
      "SELECT id FROM work_areas WHERE name='Delivery'",
    );
    const areaId = areas[0].id;
    const [person] = await pool.execute(
      "INSERT INTO employees(document_id,full_name,work_area_id) VALUES('weekly','Persona semanal',?)",
      [areaId],
    );
    const employeeId = person.insertId;
    const [other] = await pool.execute(
      "INSERT INTO employees(document_id,full_name,work_area_id) VALUES('other','Persona otra',NULL)",
    );
    const library = (await request(`/planner/library?areaId=${areaId}`)).shifts;
    const shift = library.find(
      (s) => s.segments.length === 2 && s.segments[1].startTime === "20:00",
    );
    assert.ok(shift);
    assert.equal(shift.workMinutes, 540);
    const query = `?areaId=${areaId}&weekStart=2026-10-05`;
    await request(
      `/planner/week?areaId=${areaId}&weekStart=2026-10-06`,
      "GET",
      undefined,
      400,
    );
    const empty = await request(`/planner/week${query}`);
    assert.equal(empty.id, null);
    const days = Array(7).fill(null);
    days[0] = { dayType: "work", shiftId: shift.id, availability: null };
    days[1] = { dayType: "work", shiftId: shift.id, availability: "vacation" };
    let payload = {
      revision: 0,
      requiredStaff: [1, 1, 0, 0, 0, 0, 0],
      rows: [{ id: "test-row", label: "Puesto 1", employeeId: null, days }],
    };
    await request(`/planner/week${query}`, "PUT", payload, 403, viewer);
    let draft = await request(`/planner/week${query}`, "PUT", payload);
    assert.equal(draft.revision, 1);
    const [officialBefore] = await pool.execute(
      "SELECT * FROM employee_shift_calendar",
    );
    assert.equal(officialBefore.length, 0);
    await request(
      `/planner/week/publish${query}`,
      "POST",
      { revision: 1 },
      409,
    );
    await request(`/planner/week${query}`, "PUT", payload, 409); // stale draft
    payload = {
      ...payload,
      revision: 1,
      rows: [{ ...payload.rows[0], employeeId: other.insertId }],
    };
    await request(`/planner/week${query}`, "PUT", payload, 400);
    assert.equal((await request(`/planner/week${query}`)).revision, 1); // failed save rollback
    payload.rows[0].employeeId = employeeId;
    draft = await request(`/planner/week${query}`, "PUT", payload);
    const coverage = (await request(`/planner/week${query}`)).coverage;
    assert.deepEqual(
      [coverage[1].planned, coverage[1].assigned, coverage[1].available],
      [1, 1, 0],
    );
    await pool.execute("UPDATE employees SET is_active=0 WHERE id=?", [
      employeeId,
    ]);
    assert.equal(
      (await request(`/planner/week${query}`)).coverage[0].available,
      0,
    );
    await pool.execute("UPDATE employees SET is_active=1 WHERE id=?", [
      employeeId,
    ]);
    // A conflicting second date must not partly publish the first date.
    await pool.execute(
      "INSERT INTO employee_shift_calendar(employee_id,work_date,day_type) VALUES(?,'2026-10-06','rest')",
      [employeeId],
    );
    await request(
      `/planner/week/publish${query}`,
      "POST",
      { revision: draft.revision, allowIncomplete: true },
      409,
    );
    const [notPublished] = await pool.execute(
      "SELECT work_date,day_type FROM employee_shift_calendar",
    );
    assert.deepEqual(notPublished, [
      { work_date: "2026-10-06", day_type: "rest" },
    ]);
    const [audit] = await pool.execute(
      "SELECT COUNT(*) AS n FROM audit_logs WHERE action='publish_weekly_schedule'",
    );
    assert.equal(audit[0].n, 0);
    // Force a failure during the second write: first write and deletion roll back.
    await pool.execute(
      "CREATE TRIGGER fail_second_publish BEFORE INSERT ON employee_shift_calendar WHEN NEW.work_date='2026-10-06' BEGIN SELECT RAISE(ABORT,'forced publication failure'); END",
    );
    const logError = console.error;
    console.error = (error, ...args) => {
      if (error?.message === "forced publication failure") return;
      logError(error, ...args);
    };
    try {
      await request(
        `/planner/week/publish${query}`,
        "POST",
        {
          revision: draft.revision,
          allowIncomplete: true,
          replaceExisting: true,
        },
        500,
      );
    } finally {
      console.error = logError;
    }
    await pool.execute("DROP TRIGGER fail_second_publish");
    assert.deepEqual(
      (
        await pool.execute(
          "SELECT work_date,day_type FROM employee_shift_calendar",
        )
      )[0],
      notPublished,
    );
    assert.equal((await request(`/planner/week${query}`)).status, "draft");
    let published = await request(`/planner/week/publish${query}`, "POST", {
      revision: draft.revision,
      allowIncomplete: true,
      replaceExisting: true,
    });
    assert.equal(published.status, "published");
    const [official] = await pool.execute(
      "SELECT work_date,day_type,shift_id,source_week_id FROM employee_shift_calendar ORDER BY work_date",
    );
    assert.equal(official.length, 2);
    assert.equal(official[1].day_type, "vacation");
    assert.equal(official[1].shift_id, null);
    assert.equal(official[0].source_week_id, published.id);
    await request(
      `/planner/week${query}`,
      "PUT",
      { ...payload, revision: published.revision },
      409,
    );
    draft = await request(`/planner/week/reopen${query}`, "POST", {
      revision: published.revision,
    });
    assert.equal(draft.status, "draft");
    assert.equal(
      (
        await pool.execute("SELECT COUNT(*) AS n FROM employee_shift_calendar")
      )[0][0].n,
      2,
    );
    // Morning and evening attendances count as one operational day, never the gap.
    for (const [type, time] of [
      ["entrada", "2026-10-05 12:00:00"],
      ["salida", "2026-10-05 15:00:00"],
      ["entrada", "2026-10-05 20:00:00"],
      ["salida", "2026-10-06 02:30:00"],
    ])
      await pool.execute(
        "INSERT INTO attendance_records(employee_id,record_type,registered_at) VALUES(?,?,?)",
        [employeeId, type, time],
      );
    const report = await request(
      `/attendance/expected-report?month=2026-10&employeeId=${employeeId}`,
    );
    const day = report.items.find((r) => r.workDate === "2026-10-05");
    assert.equal(day.actualMinutes, 540);
    assert.equal(day.expectedMinutes, 540);
    assert.equal(day.status, "complete");
    assert.equal(
      report.items.find((r) => r.workDate === "2026-10-06").status,
      "vacation",
    );
    const calendar = await request(
      `/attendance/calendar?month=2026-10&employeeId=${employeeId}`,
    );
    assert.equal(calendar.days.length, 1);
    assert.equal(calendar.days[0].date, "2026-10-05");
    assert.equal(calendar.days[0].totalRecords, 4);
    assert.equal(calendar.days[0].status, "complete");
    await request(
      `/attendance/expected-report?month=2026-99&employeeId=${employeeId}`,
      "GET",
      undefined,
      400,
    );
    const records = (
      await request(
        `/attendance/records?from=2026-10-05&to=2026-10-06&employeeId=${employeeId}`,
      )
    ).records;
    assert.equal(
      records.find((r) => r.registeredAt.endsWith("02:30:00")).workDate,
      "2026-10-05",
    );
    assert.equal(
      records.find((r) => r.registeredAt.endsWith("20:00:00")).lateMinutes,
      0,
    );
    // Republish a cleared draft removes only that plan's official assignments.
    payload = {
      revision: draft.revision,
      requiredStaff: [0, 0, 0, 0, 0, 0, 0],
      rows: [
        {
          ...payload.rows[0],
          days: [{ dayType: "rest", shiftId: null }, ...Array(6).fill(null)],
        },
      ],
    };
    draft = await request(`/planner/week${query}`, "PUT", payload);
    published = await request(`/planner/week/publish${query}`, "POST", {
      revision: draft.revision,
    });
    assert.equal(
      (
        await pool.execute("SELECT COUNT(*) AS n FROM employee_shift_calendar")
      )[0][0].n,
      1,
    );
    await request(
      "/planner/library",
      "POST",
      {
        areaId,
        segments: [{ startTime: "05:30", endTime: "13:30" }],
      },
      201,
    );
    const created = (
      await request(`/planner/library?areaId=${areaId}`)
    ).shifts.find((s) => s.name === "Rotativo 05:30–13:30");
    assert.equal(created.breakMinutes, 30);
    // Closing a shift in the next month belongs to the previous month.
    const nightShift = library.find(
      (s) => s.segments.length === 1 && s.startTime === "19:00" &&
        s.endTime === "02:30" && s.breakMinutes === 30,
    );
    assert.ok(nightShift, "La biblioteca compartida conserva el horario nocturno 19:00–02:30.");
    assert.equal(nightShift.workMinutes, 420);
    await pool.execute(
      "INSERT INTO employee_shift_calendar(employee_id,work_date,shift_id) VALUES(?,'2026-10-31',?)",
      [employeeId, nightShift.id],
    );
    await pool.execute(
      "INSERT INTO employee_shift_calendar(employee_id,work_date,day_type) VALUES(?,'2026-11-01','rest')",
      [employeeId],
    );
    for (const [type, time] of [
      ["entrada", "2026-10-31 19:00:00"],
      ["salida", "2026-11-01 02:30:00"],
    ])
      await pool.execute(
        "INSERT INTO attendance_records(employee_id,record_type,registered_at) VALUES(?,?,?)",
        [employeeId, type, time],
      );
    const october = await request(
      `/attendance/expected-report?month=2026-10&employeeId=${employeeId}`,
    );
    assert.equal(
      october.items.find((row) => row.workDate === "2026-10-31").actualMinutes,
      420,
    );
    assert.equal(
      october.items.find((row) => row.workDate === "2026-10-31").status,
      "complete",
    );
    const november = await request(
      `/attendance/expected-report?month=2026-11&employeeId=${employeeId}`,
    );
    assert.equal(
      november.items.find((row) => row.workDate === "2026-11-01").totalRecords,
      0,
    );
    assert.equal(
      november.items.find((row) => row.workDate === "2026-11-01").status,
      "rest",
    );
    await request(
      "/planner/library",
      "POST",
      {
        areaId,
        segments: [
          { startTime: "12:00", endTime: "15:00" },
          { startTime: "14:00", endTime: "18:00" },
        ],
      },
      400,
    );
    assert.deepEqual((await pool.execute("PRAGMA foreign_key_check"))[0], []);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
