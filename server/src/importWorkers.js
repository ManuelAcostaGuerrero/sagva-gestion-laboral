import crypto from "node:crypto";
import { pool } from "./db.js";
import { runMigrations } from "./migrations.js";
import { recordAudit } from "./auditLog.js";
import {
  empty,
  normalizeDocument,
  normalizeSchedule,
  fileWarnings,
} from "./employeeFiles.js";

const keyText = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
export function workersFromRows(rows) {
  const workers = [];
  let company = null,
    lastSheet = null;
  for (const row of rows) {
    if (!Array.isArray(row.values) || row.values.length !== 6)
      throw new Error("La importación admite únicamente seis columnas (A–F).");
    if (row.sheet !== lastSheet) {
      company = null;
      lastSheet = row.sheet;
    }
    const [hire, end, schedule, other, name, rut] = row.values.map(empty);
    if (!name) continue;
    if (keyText(name) === "NOMBRE Y APELLIDO") continue;
    if (!hire && !end && !schedule && !other && !rut) {
      company = name;
      continue;
    }
    const terminationDate = /^\d{4}-\d{2}-\d{2}$/.test(end || "") ? end : null;
    const contractType = keyText(end) === "INDEFINIDO" ? "INDEFINIDO" : null;
    const isActive = keyText(end) !== "FINIQUITADO";
    const data = {
      fullName: name,
      documentId: rut,
      company,
      workSchedule: normalizeSchedule(schedule),
      hireDate: hire,
      terminationDate,
      contractType,
      isActive,
      employmentStatus: isActive ? null : "FINIQUITADO",
      sheet: row.sheet,
      row: row.row,
      values: row.values,
    };
    const notes = fileWarnings(data);
    if (
      end &&
      !terminationDate &&
      !["INDEFINIDO", "FINIQUITADO"].includes(keyText(end))
    )
      notes.push(
        `Término pendiente: el Excel contiene «${end}». Se conserva la fecha vacía.`,
      );
    if (other)
      notes.push(
        `Columna D sin encabezado: ${other}. Pendiente identificar su significado.`,
      );
    data.observations = notes.length ? notes.join("\n") : null;
    data.sourceKey = crypto
      .createHash("sha256")
      .update(`workers-af:${keyText(company)}:${keyText(name)}`)
      .digest("hex");
    workers.push(data);
  }
  return workers;
}
export async function importWorkers(rows, admin = null) {
  await runMigrations();
  const workers = workersFromRows(rows),
    result = {
      total: workers.length,
      created: 0,
      linked: 0,
      skipped: 0,
      changedSources: 0,
    };
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const worker of workers) {
      const raw = JSON.stringify(worker.values);
      const [sources] = await connection.execute(
        "SELECT employee_id,source_values_json FROM employee_import_sources WHERE source_key=?",
        [worker.sourceKey],
      );
      if (sources.length) {
        result.skipped++;
        if (sources[0].source_values_json !== raw) result.changedSources++;
        continue;
      }
      let existing = [];
      if (worker.documentId)
        [existing] = await connection.execute(
          "SELECT id,full_name,is_active FROM employees WHERE upper(replace(replace(replace(trim(document_id),'.',''),'-',''),' ',''))=?",
          [normalizeDocument(worker.documentId)],
        );
      // A provisional worker can already have been entered manually. Never guess
      // between several homonyms or silently create a second identity.
      if (!existing.length) {
        const [candidates] = await connection.execute(
          "SELECT e.id,e.full_name,e.is_active,e.document_id,f.company FROM employees e LEFT JOIN employee_files f ON f.employee_id=e.id",
        );
        existing = candidates.filter(
          (e) =>
            keyText(e.full_name) === keyText(worker.fullName) &&
            (!e.company || keyText(e.company) === keyText(worker.company)) &&
            (!worker.documentId || !e.document_id),
        );
        if (existing.length > 1)
          throw new Error(
            `Hay varias fichas con el mismo nombre en fila ${worker.row}. Revisa antes de importar.`,
          );
      }
      let id = existing[0]?.id;
      if (!id) {
        const [created] = await connection.execute(
          "INSERT INTO employees(full_name,document_id,is_active,deletion_reason) VALUES(?,?,?,?)",
          [
            worker.fullName,
            worker.documentId,
            worker.isActive,
            worker.isActive ? null : "FINIQUITADO según Excel A–F",
          ],
        );
        id = created.insertId;
        result.created++;
      } else {
        result.linked++;
        if (worker.documentId)
          await connection.execute(
            "UPDATE employees SET document_id=COALESCE(document_id,?) WHERE id=?",
            [worker.documentId, id],
          );
        // The explicit FINIQUITADO source cannot reactivate a historical worker.
        if (!worker.isActive)
          await connection.execute(
            "UPDATE employees SET is_active=0,deletion_reason=COALESCE(deletion_reason,'FINIQUITADO según Excel A–F') WHERE id=?",
            [id],
          );
      }
      let notes = worker.observations;
      if (
        existing[0] &&
        keyText(existing[0].full_name) !== keyText(worker.fullName)
      )
        notes = [
          notes,
          "Nombre del Excel distinto al nombre existente; se conserva la ficha actual.",
        ]
          .filter(Boolean)
          .join("\n");
      await connection.execute(
        `INSERT INTO employee_files(employee_id,validation_status,company,work_schedule,hire_date,termination_date,contract_type,employment_status,observations)
        VALUES(?,'NO_VALIDADO',?,?,?,?,?,?,?) ON CONFLICT(employee_id) DO UPDATE SET
        company=COALESCE(NULLIF(employee_files.company,''),excluded.company),
        work_schedule=COALESCE(NULLIF(employee_files.work_schedule,''),excluded.work_schedule),
        hire_date=COALESCE(NULLIF(employee_files.hire_date,''),excluded.hire_date),
        termination_date=COALESCE(NULLIF(employee_files.termination_date,''),excluded.termination_date),
        contract_type=COALESCE(NULLIF(employee_files.contract_type,''),excluded.contract_type),
        employment_status=CASE WHEN excluded.employment_status='FINIQUITADO' THEN 'FINIQUITADO' ELSE employee_files.employment_status END,
        observations=CASE WHEN excluded.observations IS NULL THEN employee_files.observations
          WHEN employee_files.observations IS NULL OR employee_files.observations='' THEN excluded.observations
          ELSE employee_files.observations || char(10) || excluded.observations END,
        revision=employee_files.revision+1,updated_at=datetime('now','localtime')`,
        [
          id,
          worker.company,
          worker.workSchedule,
          worker.hireDate,
          worker.terminationDate,
          worker.contractType,
          worker.employmentStatus,
          notes,
        ],
      );
      await connection.execute(
        "INSERT INTO employee_import_sources(source_key,employee_id,sheet,source_row,source_values_json) VALUES(?,?,?,?,?)",
        [worker.sourceKey, id, worker.sheet, worker.row, raw],
      );
      await recordAudit(
        admin,
        "import_worker",
        "employee",
        id,
        {
          source: "Excel A–F",
          sheet: worker.sheet,
          row: worker.row,
          created: !existing.length,
        },
        connection,
      );
    }
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
