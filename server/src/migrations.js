import fs from "node:fs";
import path from "node:path";
import { pool } from "./db.js";
import { projectRoot } from "./databasePath.js";
import { normalizeSegments } from "./shiftTime.js";
import { migrateEmployeeFiles } from './employeeFilesMigration.js';
import { migrateTokens } from './tokenMigration.js';
import { migrateWorkerIdentity } from './workerIdentityMigration.js';
import { migrateRotativoShiftLibrary } from './shiftNormalizationMigration.js';
import { migrateEmployeeContracts } from './employeeContracts.js';
import { migrateWorkPositions } from './workPositions.js';
import { migrateEmployeeDocuments, migrateDocumentCatalog } from './employeeDocuments.js';
import { migrateMedicalLeaves } from './medicalLeaves.js';
import { migrateMedicalProfiles } from './medicalProfiles.js';
import { migrateCompanyProfiles, migrateCompanyTerritory, migrateCompanyContactEmails } from './companyProfiles.js';
import { migrateContractTerms } from './contractTerms.js';

import { migrateContractFiles } from './contractFiles.js';

import {migrateWorkerUppercase} from './workerUppercaseMigration.js';

import {migrateFinancialDocuments,migrateSalaryRetroactive} from './financialDocuments.js';
import {migrateSalaryAnnexApprovals} from './employeeSalaryApprovals.js';
import {migrateLaborAccounting} from './laborAccounting.js';
import {migrateLaborBenefits} from './laborBenefits.js';
import {migrateAccessControl,bootstrapRoot} from './securityPermissions.js';
import {migrateLaborFields} from './laborFields.js';

import {migrateTerminalCompanies} from './terminalCompanies.js';

let pending;
export function runMigrations() {
  pending ??= migrate().catch((error) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
async function migrate() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction({ foreignKeys: false });
    await connection.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )`);
    const id = "20261002_001_sqlite_schema";
    const [applied] = await connection.execute(
      "SELECT id FROM schema_migrations WHERE id = :id",
      { id },
    );
    if (!applied.length) {
      await connection.execScript(
        fs.readFileSync(path.join(projectRoot, "database/schema.sql"), "utf8"),
      );
      await connection.execute(
        "INSERT INTO schema_migrations (id) VALUES (:id)",
        { id },
      );
    }
    const plannerId = "20261002_002_weekly_planner";
    const [plannerApplied] = await connection.execute(
      "SELECT id FROM schema_migrations WHERE id=:id",
      { id: plannerId },
    );
    if (!plannerApplied.length) {
      await connection.execScript(
        fs.readFileSync(
          path.join(projectRoot, `database/migrations/${plannerId}.sql`),
          "utf8",
        ),
      );
      const references = JSON.parse(
        fs.readFileSync(
          path.join(projectRoot, "server/src/shiftReference.json"),
          "utf8",
        ),
      );
      for (const reference of references) {
        const model = normalizeSegments(
          reference.segments,
          reference.breakMinutes,
        );
        const [areas] = await connection.execute(
          "SELECT id FROM work_areas WHERE name=:name",
          { name: reference.area },
        );
        const areaId = areas[0].id;
        const name = `${reference.area} ${reference.segments.map((s) => `${s.startTime}-${s.endTime}`).join(" / ")}`;
        await connection.execute(
          "INSERT INTO work_shifts(name,start_time,end_time,break_minutes) VALUES(:name,:start,:end,:meal) ON CONFLICT(name) DO NOTHING",
          {
            name,
            start: model.segments[0].startTime,
            end: model.segments.at(-1).endTime,
            meal: model.breakMinutes,
          },
        );
        const [shifts] = await connection.execute(
          "SELECT id FROM work_shifts WHERE name=:name",
          { name },
        );
        const shiftId = shifts[0].id;
        for (const [index, s] of model.segments.entries())
          await connection.execute(
            "INSERT INTO work_shift_segments(shift_id,segment_order,start_time,end_time,start_day_offset,end_day_offset) VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING",
            [
              shiftId,
              index,
              s.startTime,
              s.endTime,
              s.startDayOffset,
              s.endDayOffset,
            ],
          );
        await connection.execute(
          "INSERT INTO shift_area_references(area_id,shift_id,source,reference_frequency) VALUES(?,?,?,?) ON CONFLICT DO NOTHING",
          [areaId, shiftId, reference.source, reference.frequency],
        );
      }
      await connection.execute(
        "INSERT INTO schema_migrations(id) VALUES(:id)",
        { id: plannerId },
      );
    }
    const shiftGroupsId = "20261004_004_shift_groups";
    const [shiftGroupsApplied] = await connection.execute(
      "SELECT id FROM schema_migrations WHERE id=:id",
      { id: shiftGroupsId },
    );
    if (!shiftGroupsApplied.length) {
      await connection.execScript(
        fs.readFileSync(
          path.join(projectRoot, `database/migrations/${shiftGroupsId}.sql`),
          "utf8",
        ),
      );
      await connection.execute(
        "INSERT INTO schema_migrations(id) VALUES(:id)",
        { id: shiftGroupsId },
      );
    }
    await migrateEmployeeFiles(connection);
    await migrateTokens(connection);
    await migrateWorkerIdentity(connection);
    await migrateRotativoShiftLibrary(connection);
    await migrateEmployeeContracts(connection);
    await migrateWorkPositions(connection);
    await migrateEmployeeDocuments(connection);
    await migrateDocumentCatalog(connection);
    await migrateMedicalLeaves(connection);
    await migrateMedicalProfiles(connection);
    await migrateCompanyProfiles(connection);
    await migrateCompanyTerritory(connection);
    await migrateCompanyContactEmails(connection);
    await migrateContractTerms(connection);
    await migrateContractFiles(connection);
    await migrateWorkerUppercase(connection);
    await migrateFinancialDocuments(connection);
    await migrateSalaryRetroactive(connection);
    await migrateSalaryAnnexApprovals(connection);
    await migrateTerminalCompanies(connection);
    await migrateLaborAccounting(connection);
    await migrateLaborBenefits(connection);
    await migrateAccessControl(connection);
    await bootstrapRoot(connection);
    await migrateLaborFields(connection);
    const [violations] = await connection.execute("PRAGMA foreign_key_check");
    if (violations.length)
      throw new Error(
        "La base tiene referencias invalidas. No se aplicaran cambios.",
      );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
