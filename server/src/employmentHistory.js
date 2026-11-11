// P2: modelo aditivo y vacío para vínculos laborales revisados.
// No reconstruye empleos desde la ficha actual ni asigna marcas históricas por inferencia.
export const EMPLOYMENT_HISTORY_MIGRATION='20261111_031_employment_history';

export async function migrateEmploymentHistory(db) {
  const [applied]=await db.execute('SELECT id FROM schema_migrations WHERE id=?',[EMPLOYMENT_HISTORY_MIGRATION]);
  if(applied.length)return;
  await db.execScript(`
    CREATE TABLE company_branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES company_profiles(id) ON DELETE RESTRICT,
      code TEXT COLLATE NOCASE NOT NULL,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id,code),
      CHECK(trim(code)<>''),
      CHECK(trim(name)<>'')
    );
    CREATE INDEX branches_company ON company_branches(company_id,active);

    CREATE TABLE employment_relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
      company_id INTEGER NOT NULL REFERENCES company_profiles(id) ON DELETE RESTRICT,
      started_on TEXT NOT NULL,
      ended_on TEXT,
      status TEXT NOT NULL CHECK(status IN ('PLANNED','ACTIVE','ENDED')),
      review_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(review_status IN ('PENDING','CONFIRMED')),
      review_reason TEXT NOT NULL,
      reviewed_by INTEGER REFERENCES admins(id) ON DELETE RESTRICT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK(length(started_on)=10 AND substr(started_on,5,1)='-' AND substr(started_on,8,1)='-'),
      CHECK(ended_on IS NULL OR (length(ended_on)=10 AND substr(ended_on,5,1)='-' AND substr(ended_on,8,1)='-' AND ended_on>=started_on)),
      CHECK(review_status<>'CONFIRMED' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
      CHECK(status<>'ACTIVE' OR review_status='CONFIRMED'),
      UNIQUE(employee_id,company_id,started_on)
    );
    CREATE INDEX employment_worker_dates ON employment_relationships(employee_id,started_on,ended_on);
    CREATE INDEX employment_company_dates ON employment_relationships(company_id,started_on,ended_on);
    CREATE TRIGGER employment_no_confirmed_overlap_insert BEFORE INSERT ON employment_relationships
    WHEN NEW.review_status='CONFIRMED'
    BEGIN
      SELECT RAISE(ABORT,'Relaciones laborales confirmadas superpuestas para misma persona y empresa')
      WHERE EXISTS (
        SELECT 1 FROM employment_relationships old
        WHERE old.employee_id=NEW.employee_id AND old.company_id=NEW.company_id
          AND old.review_status='CONFIRMED'
          AND NEW.started_on<=coalesce(old.ended_on,'9999-12-31')
          AND old.started_on<=coalesce(NEW.ended_on,'9999-12-31')
      );
    END;
    CREATE TRIGGER employment_no_confirmed_overlap_update BEFORE UPDATE ON employment_relationships
    WHEN NEW.review_status='CONFIRMED'
    BEGIN
      SELECT RAISE(ABORT,'Relaciones laborales confirmadas superpuestas para misma persona y empresa')
      WHERE EXISTS (
        SELECT 1 FROM employment_relationships old
        WHERE old.id<>NEW.id AND old.employee_id=NEW.employee_id
          AND old.company_id=NEW.company_id AND old.review_status='CONFIRMED'
          AND NEW.started_on<=coalesce(old.ended_on,'9999-12-31')
          AND old.started_on<=coalesce(NEW.ended_on,'9999-12-31')
      );
    END;

    CREATE TABLE employment_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employment_id INTEGER NOT NULL REFERENCES employment_relationships(id) ON DELETE RESTRICT,
      branch_id INTEGER REFERENCES company_branches(id) ON DELETE RESTRICT,
      work_area_id INTEGER REFERENCES work_areas(id) ON DELETE RESTRICT,
      position_id INTEGER REFERENCES work_positions(id) ON DELETE RESTRICT,
      valid_from TEXT NOT NULL,
      valid_until TEXT,
      evidence_ref TEXT NOT NULL,
      confirmed_by INTEGER NOT NULL REFERENCES admins(id) ON DELETE RESTRICT,
      confirmed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK(valid_until IS NULL OR valid_until>valid_from),
      CHECK(length(valid_from)=10 AND substr(valid_from,5,1)='-' AND substr(valid_from,8,1)='-'),
      CHECK(valid_until IS NULL OR (length(valid_until)=10 AND substr(valid_until,5,1)='-' AND substr(valid_until,8,1)='-'))
    );
    CREATE INDEX employment_assignments_period ON employment_assignments(employment_id,valid_from,valid_until);
    CREATE TRIGGER employment_assignments_scope BEFORE INSERT ON employment_assignments
    BEGIN
      SELECT RAISE(ABORT,'Asignacion requiere relacion laboral confirmada y fecha valida')
      WHERE NOT EXISTS (
        SELECT 1 FROM employment_relationships e
        WHERE e.id=NEW.employment_id AND e.review_status='CONFIRMED'
          AND NEW.valid_from>=e.started_on
          AND (e.ended_on IS NULL OR NEW.valid_from<=e.ended_on)
          AND (NEW.valid_until IS NULL OR e.ended_on IS NULL OR NEW.valid_until<=date(e.ended_on,'+1 day'))
      );
      SELECT RAISE(ABORT,'Sucursal no pertenece a la empresa de la relacion')
      WHERE NEW.branch_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM company_branches b JOIN employment_relationships e ON e.company_id=b.company_id
        WHERE b.id=NEW.branch_id AND e.id=NEW.employment_id
      );
      SELECT RAISE(ABORT,'Asignacion de cargo/area/sucursal con vigencia superpuesta')
      WHERE EXISTS (
        SELECT 1 FROM employment_assignments old
        WHERE old.employment_id=NEW.employment_id AND
          NEW.valid_from<coalesce(old.valid_until,'9999-12-31') AND
          old.valid_from<coalesce(NEW.valid_until,'9999-12-31')
      );
    END;
    CREATE TRIGGER employment_assignments_no_update BEFORE UPDATE ON employment_assignments
    BEGIN SELECT RAISE(ABORT,'Las asignaciones confirmadas no se reescriben; crear una nueva vigencia revisada'); END;
    CREATE TRIGGER employment_assignments_no_delete BEFORE DELETE ON employment_assignments
    BEGIN SELECT RAISE(ABORT,'Las asignaciones historicas no se eliminan'); END;

    CREATE TABLE employment_terms_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employment_id INTEGER NOT NULL REFERENCES employment_relationships(id) ON DELETE RESTRICT,
      effective_from TEXT NOT NULL,
      effective_until TEXT,
      monthly_base_salary_clp INTEGER CHECK(monthly_base_salary_clp IS NULL OR monthly_base_salary_clp>=0),
      weekly_hours REAL CHECK(weekly_hours IS NULL OR weekly_hours BETWEEN 0 AND 48),
      break_minutes INTEGER CHECK(break_minutes IS NULL OR break_minutes BETWEEN 0 AND 240),
      terms_snapshot_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(terms_snapshot_json)),
      source_document_ref TEXT NOT NULL,
      confirmed_by INTEGER NOT NULL REFERENCES admins(id) ON DELETE RESTRICT,
      confirmed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK(length(effective_from)=10 AND substr(effective_from,5,1)='-' AND substr(effective_from,8,1)='-'),
      CHECK(effective_until IS NULL OR (length(effective_until)=10 AND substr(effective_until,5,1)='-' AND substr(effective_until,8,1)='-' AND effective_until>effective_from))
    );
    CREATE INDEX employment_terms_period ON employment_terms_versions(employment_id,effective_from,effective_until);
    CREATE TRIGGER employment_terms_scope BEFORE INSERT ON employment_terms_versions
    BEGIN
      SELECT RAISE(ABORT,'Condicion requiere relacion confirmada y periodo comprendido')
      WHERE NOT EXISTS (
        SELECT 1 FROM employment_relationships e
        WHERE e.id=NEW.employment_id AND e.review_status='CONFIRMED'
          AND NEW.effective_from>=e.started_on
          AND (e.ended_on IS NULL OR NEW.effective_from<=e.ended_on)
          AND (NEW.effective_until IS NULL OR e.ended_on IS NULL OR NEW.effective_until<=date(e.ended_on,'+1 day'))
      );
      SELECT RAISE(ABORT,'Condiciones contractuales historicas superpuestas')
      WHERE EXISTS (
        SELECT 1 FROM employment_terms_versions old
        WHERE old.employment_id=NEW.employment_id AND
          NEW.effective_from<coalesce(old.effective_until,'9999-12-31') AND
          old.effective_from<coalesce(NEW.effective_until,'9999-12-31')
      );
    END;
    CREATE TRIGGER employment_terms_no_update BEFORE UPDATE ON employment_terms_versions
    BEGIN SELECT RAISE(ABORT,'No reescribir condiciones contractuales historicas'); END;
    CREATE TRIGGER employment_terms_no_delete BEFORE DELETE ON employment_terms_versions
    BEGIN SELECT RAISE(ABORT,'No eliminar condiciones contractuales historicas'); END;

    CREATE TABLE attendance_employment_links (
      record_id INTEGER PRIMARY KEY REFERENCES attendance_records(id) ON DELETE RESTRICT,
      employment_id INTEGER NOT NULL REFERENCES employment_relationships(id) ON DELETE RESTRICT,
      evidence_ref TEXT NOT NULL,
      confirmed_by INTEGER NOT NULL REFERENCES admins(id) ON DELETE RESTRICT,
      confirmed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX attendance_employment_relationship ON attendance_employment_links(employment_id,record_id);
    CREATE TRIGGER attendance_employment_match BEFORE INSERT ON attendance_employment_links
    BEGIN
      SELECT RAISE(ABORT,'Marcacion y relacion laboral no coinciden en persona/fecha')
      WHERE NOT EXISTS (
        SELECT 1 FROM attendance_records a JOIN employment_relationships e
          ON a.employee_id=e.employee_id
        WHERE a.id=NEW.record_id AND e.id=NEW.employment_id
          AND e.review_status='CONFIRMED'
          AND substr(a.registered_at,1,10)>=e.started_on
          AND (e.ended_on IS NULL OR substr(a.registered_at,1,10)<=e.ended_on)
      );
    END;
    CREATE TRIGGER attendance_employment_no_update BEFORE UPDATE ON attendance_employment_links
    BEGIN SELECT RAISE(ABORT,'No reasignar marcaciones historicas sin proceso de rectificacion'); END;
    CREATE TRIGGER attendance_employment_no_delete BEFORE DELETE ON attendance_employment_links
    BEGIN SELECT RAISE(ABORT,'No eliminar vinculos de marcaciones sin proceso de rectificacion'); END;
  `);
  await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[EMPLOYMENT_HISTORY_MIGRATION]);
}

// Vista interna no expuesta por HTTP: consulta solamente relaciones confirmadas.
// Una persona puede tener múltiples vínculos con empresas diferentes en un mismo día.
export async function employmentContextAsOf(db,employeeId,on) {
  if(!Number.isSafeInteger(employeeId)||employeeId<1||!/^\d{4}-\d{2}-\d{2}$/.test(on))
    throw new Error('Trabajador o fecha de consulta inválida');
  const [rows]=await db.execute(`
    SELECT r.id AS employmentId,r.employee_id AS employeeId,r.company_id AS companyId,
           r.started_on AS startedOn,r.ended_on AS endedOn,r.status,
           a.branch_id AS branchId,a.work_area_id AS workAreaId,a.position_id AS positionId,
           t.monthly_base_salary_clp AS monthlyBaseSalaryClp,
           t.weekly_hours AS weeklyHours,t.break_minutes AS breakMinutes,
           t.source_document_ref AS salarySource
      FROM employment_relationships r
      LEFT JOIN employment_assignments a ON a.employment_id=r.id
          AND a.valid_from<=? AND (a.valid_until IS NULL OR a.valid_until>?)
      LEFT JOIN employment_terms_versions t ON t.employment_id=r.id
          AND t.effective_from<=? AND (t.effective_until IS NULL OR t.effective_until>?)
     WHERE r.employee_id=? AND r.review_status='CONFIRMED'
       AND r.started_on<=? AND (r.ended_on IS NULL OR r.ended_on>=?)
     ORDER BY r.company_id,r.id`,[on,on,on,on,employeeId,on,on]);
  return rows;
}
