import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
process.env.SQLITE_PATH = ":memory:";
process.env.JWT_SECRET = "employee-file-isolated-tests";
const { app } = await import("../app.js");
const { pool, createSqlitePool } = await import("../db.js");
const { runMigrations } = await import("../migrations.js");
const { migrateEmployeeFiles } = await import("../employeeFilesMigration.js");
const { projectRoot } = await import("../databasePath.js");
const { signAdmin } = await import("../auth.js");
const { importWorkers, workersFromRows } = await import("../importWorkers.js");
const { normalizeSchedule } = await import("../employeeFiles.js");

test("Migración de fichas preserva IDs, marcas, huellas, historial y referencias; admite varios RUT vacíos", async () => {
  const database = createSqlitePool(":memory:");
  let connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execScript(
      fs.readFileSync(path.join(projectRoot, "database/schema.sql"), "utf8"),
    );
    await connection.execute(
      "INSERT INTO employees(id,document_id,full_name) VALUES(7,'12.345.678-5','Persona histórica')",
    );
    await connection.execute(
      "INSERT INTO employees(id,document_id,full_name) VALUES(100,'TEMP','Identidad previa eliminada')",
    );
    await connection.execute("DELETE FROM employees WHERE id=100");
    await connection.execute(
      "INSERT INTO fingerprints(employee_id,finger_label,template,template_hash) VALUES(7,'indice_derecho','synthetic','hash')",
    );
    await connection.execute(
      "INSERT INTO attendance_records(employee_id,record_type) VALUES(7,'entrada')",
    );
    await connection.execute(
      "INSERT INTO employee_document_history(employee_id,old_document_id,new_document_id,reason) VALUES(7,'viejo','12.345.678-5','histórico')",
    );
    await connection.execScript(
      "CREATE TABLE schema_migrations(id TEXT PRIMARY KEY)",
    );
    await connection.commit();
    connection.release();
    connection = await database.getConnection();
    await connection.beginTransaction({ foreignKeys: false });
    await migrateEmployeeFiles(connection);
    await migrateEmployeeFiles(connection);
    assert.deepEqual(
      (await connection.execute("PRAGMA foreign_key_check"))[0],
      [],
    );
    await connection.commit();
    connection.release();
    for (const table of [
      "employees",
      "fingerprints",
      "attendance_records",
      "employee_document_history",
    ])
      assert.equal(
        (await database.execute(`SELECT COUNT(*) AS n FROM ${table}`))[0][0].n,
        1,
      );
    assert.equal(
      (await database.execute("SELECT id FROM employees"))[0][0].id,
      7,
    );
    await database.execute(
      "INSERT INTO employees(full_name,document_id) VALUES('Provisional uno',NULL),('Provisional dos',NULL)",
    );
    assert.equal(
      (
        await database.execute(
          "SELECT id FROM employees WHERE full_name='Provisional uno'",
        )
      )[0][0].id,
      101,
    );
    await assert.rejects(
      database.execute(
        "INSERT INTO employees(full_name,document_id) VALUES('Duplicado','123456785')",
      ),
    );
    await assert.rejects(
      database.execute(
        "INSERT INTO attendance_records(employee_id,record_type) VALUES(999,'entrada')",
      ),
    );
  } finally {
    connection.release();
    await database.end();
  }
});
test("Migración rechaza duplicados de RUT normalizado y revierte sin borrar historial", async () => {
  const database = createSqlitePool(":memory:");
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execScript(
      fs.readFileSync(path.join(projectRoot, "database/schema.sql"), "utf8"),
    );
    await connection.execScript(
      "CREATE TABLE schema_migrations(id TEXT PRIMARY KEY);INSERT INTO employees(document_id,full_name) VALUES('12.345.678-5','Uno'),('123456785','Dos');INSERT INTO attendance_records(employee_id,record_type) VALUES(1,'entrada');",
    );
    await connection.commit();
    const migration = await database.getConnection();
    try {
      await migration.beginTransaction({ foreignKeys: false });
      await assert.rejects(migrateEmployeeFiles(migration));
      await migration.rollback();
    } finally {
      migration.release();
    }
    assert.equal(
      (await database.execute("SELECT COUNT(*) n FROM employees"))[0][0].n,
      2,
    );
    assert.equal(
      (
        await database.execute("SELECT COUNT(*) n FROM attendance_records")
      )[0][0].n,
      1,
    );
    assert.equal(
      (await database.execute("PRAGMA foreign_keys"))[0][0].foreign_keys,
      1,
    );
  } finally {
    connection.release();
    await database.end();
  }
});
test("Ficha API: persistencia, revisión suave, filtros, RUT único, concurrencia y auditoría atómica", async (t) => {
  await runMigrations();
  const [admin] = await pool.execute(
    "INSERT INTO admins(username,password_hash,full_name) VALUES('file-test','hash','Prueba')",
  );
  const token = signAdmin({
    id: admin.insertId,
    username: "file-test",
    role: "admin",
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  async function request(route, method = "GET", body) {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/employee-files${route}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    return { status: response.status, data: await response.json() };
  }
  try {
    const created = await request("", "POST", {
      fullName: "Provisional prueba",
      documentId: "",
      email: "",
      company: "Empresa",
      workSchedule: "PIC TIME",
      hireDate: "2026-11-17",
      terminationDate: "2026-10-17",
    });
    assert.equal(created.status, 201);
    let file = created.data.file;
    assert.equal(file.documentId, null);
    assert.equal(file.workSchedule, "PEAK_TIME");
    assert.equal(file.validationStatus, "NO_VALIDADO");
    assert.ok(file.warnings.some((w) => w.includes("inconsistentes")));
    let saved = await request(`/${file.id}`, "PUT", {
      ...file,
      email: "correo pendiente",
      address: "",
      phone: "",
      birthDate: "",
      validationStatus: "VALIDADO",
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.file.validationStatus, "NO_VALIDADO");
    assert.ok(saved.data.file.warnings.some((w) => w.includes("correo")));
    assert.equal((await request(`/${file.id}`, "PUT", file)).status, 409);
    file = saved.data.file;
    const filtered = await request("?validation=VALIDADO");
    assert.equal(filtered.data.files.length, 0);
    assert.equal(filtered.data.counts.pending, 1);
    saved = await request(`/${file.id}`, "PUT", {
      ...file,
      documentId: "12.345.678-5",
      documentChangeReason: "RUT informado",
    });
    assert.equal(saved.status, 200);
    file = saved.data.file;
    assert.equal(
      (
        await pool.execute(
          "SELECT COUNT(*) n FROM employee_document_history WHERE employee_id=?",
          [file.id],
        )
      )[0][0].n,
      1,
    );
    await pool.execute(
      "INSERT INTO attendance_records(employee_id,record_type) VALUES(?,'entrada')",
      [file.id],
    );
    assert.equal(
      (
        await request("", "POST", {
          fullName: "Duplicado",
          documentId: "123456785",
        })
      ).status,
      409,
    );
    await pool.execute("UPDATE employees SET is_active=0 WHERE id=?", [
      file.id,
    ]);
    saved = await request(`/${file.id}`, "PUT", {
      ...file,
      fullName: "Nombre corregido",
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.file.isActive, 0);
    file = saved.data.file;
    await pool.execute(
      "CREATE TRIGGER fail_file_audit BEFORE INSERT ON audit_logs WHEN NEW.action='update_file' BEGIN SELECT RAISE(ABORT,'fallo controlado'); END",
    );
    // This injected failure verifies rollback. Capture its expected log so an
    // otherwise successful update does not appear to contain a real server error.
    const expectedLog=t.mock.method(console,'error',()=>{});
    assert.equal(
      (
        await request(`/${file.id}`, "PUT", {
          ...file,
          fullName: "No debe guardarse",
        })
      ).status,
      500,
    );
    assert.equal(expectedLog.mock.callCount(),1);
    expectedLog.mock.restore();
    await pool.execute("DROP TRIGGER fail_file_audit");
    assert.equal(
      (
        await pool.execute("SELECT full_name FROM employees WHERE id=?", [
          file.id,
        ])
      )[0][0].full_name,
      "NOMBRE CORREGIDO",
    );
    assert.equal(
      (
        await pool.execute(
          "SELECT COUNT(*) n FROM attendance_records WHERE employee_id=?",
          [file.id],
        )
      )[0][0].n,
      1,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
const row = (number, values) => ({ sheet: "Personal", row: number, values });
test("Importación A–F: faltantes reales, fechas dudosas, finiquitado, jornadas y repetición sin sobrescribir correcciones", async () => {
  const rows = [
    row(2, [null, null, null, null, "Empresa de prueba", null]),
    row(3, [
      "CONTRATACION",
      "FINALIZACION",
      null,
      null,
      "NOMBRE Y APELLIDO",
      "RUT",
    ]),
    row(4, [null, null, "FULL-TIME", null, "Provisional importada", null]),
    row(5, [
      "2026-11-17",
      "2026-10-17",
      "PART TIME",
      null,
      "Fechas invertidas",
      "22.222.222-2",
    ]),
    row(6, [
      "2026-02-11",
      " ?",
      "PIC TIME",
      null,
      "Término incierto",
      "33.333.333-3",
    ]),
    row(7, [
      null,
      "FINIQUITADO",
      "PART TIME",
      null,
      "Finiquitado prueba",
      "44.444.444-4",
    ]),
  ];
  assert.equal(normalizeSchedule("FULL-TIME"), "FULL_TIME");
  assert.equal(normalizeSchedule("PART TIME"), "PART_TIME");
  const parsed = workersFromRows(rows);
  assert.equal(parsed.length, 4);
  assert.equal(parsed[0].documentId, null);
  const initial = await importWorkers(rows);
  assert.equal(initial.created, 4);
  const [files] = await pool.execute(
    "SELECT e.id,e.is_active,f.* FROM employees e JOIN employee_files f ON f.employee_id=e.id WHERE f.company=?",
    ["Empresa de prueba"],
  );
  assert.equal(
    files.filter((f) => f.validation_status === "NO_VALIDADO").length,
    4,
  );
  assert.equal(files[1].hire_date, "2026-11-17");
  assert.ok(files[1].observations.includes("inconsistentes"));
  assert.equal(files[2].termination_date, null);
  assert.ok(files[2].observations.includes("«?»"));
  assert.equal(files[3].is_active, 0);
  assert.equal(files[3].employment_status, "FINIQUITADO");
  await pool.execute(
    "UPDATE employees SET document_id='55.555.555-5' WHERE id=?",
    [files[0].id],
  );
  await pool.execute(
    "UPDATE employee_files SET validation_status='VALIDADO',phone='manual' WHERE employee_id=?",
    [files[0].id],
  );
  const repeat = await importWorkers([...rows].reverse().reverse());
  assert.equal(repeat.created, 0);
  assert.equal(repeat.skipped, 4);
  const [preserved] = await pool.execute(
    "SELECT e.document_id,f.validation_status,f.phone FROM employees e JOIN employee_files f ON f.employee_id=e.id WHERE e.id=?",
    [files[0].id],
  );
  assert.deepEqual(preserved[0], {
    document_id: "55.555.555-5",
    validation_status: "VALIDADO",
    phone: "manual",
  });
  assert.throws(
    () =>
      workersFromRows([
        row(1, [null, null, null, null, "No", null, "PROHIBIDO"]),
      ]),
    /seis columnas/,
  );
});
