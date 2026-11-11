// Etapa 1A-1E: sólo expand y condiciones de cierre temporal.
// Nunca importa datos antiguos ni infiere nuevas relaciones desde employee_files.
export const LABOR_STRUCTURE_MIGRATION='20261111_035_labor_structure_flows';

export async function migrateLaborStructure(db){
  if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[LABOR_STRUCTURE_MIGRATION]))[0].length)return;
  await db.execScript(`
    ALTER TABLE company_branches ADD COLUMN address TEXT;
    ALTER TABLE company_branches ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0);
    CREATE TRIGGER company_branch_identity_guard BEFORE UPDATE OF company_id,code ON company_branches
    BEGIN SELECT RAISE(ABORT,'Empresa y código de local son identificadores permanentes'); END;
    CREATE TRIGGER employment_relation_update_guard BEFORE UPDATE ON employment_relationships
    WHEN NOT(
      OLD.status='ACTIVE' AND NEW.status='ENDED'
      AND OLD.ended_on IS NULL AND NEW.ended_on IS NOT NULL
      AND NEW.ended_on>=OLD.started_on
      AND NEW.id IS OLD.id AND NEW.employee_id IS OLD.employee_id
      AND NEW.company_id IS OLD.company_id AND NEW.started_on IS OLD.started_on
      AND NEW.review_status IS OLD.review_status AND NEW.review_reason IS OLD.review_reason
      AND NEW.reviewed_by IS OLD.reviewed_by AND NEW.reviewed_at IS OLD.reviewed_at
      AND NEW.created_at IS OLD.created_at
    ) BEGIN SELECT RAISE(ABORT,'No reescribir identificación ni vigencias originales de la relación'); END;
    CREATE TRIGGER employment_relation_no_delete BEFORE DELETE ON employment_relationships
    BEGIN SELECT RAISE(ABORT,'No eliminar relaciones laborales históricas'); END;

    CREATE TABLE labor_lifecycle_events(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employment_id INTEGER NOT NULL REFERENCES employment_relationships(id) ON DELETE RESTRICT,
      kind TEXT NOT NULL CHECK(kind IN ('HIRE','END','ASSIGNMENT','CONDITIONS','SHIFT','DOCUMENT')),
      effective_on TEXT NOT NULL CHECK(length(effective_on)=10),
      evidence_ref TEXT NOT NULL CHECK(trim(evidence_ref)<>''),
      details_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(details_json)),
      created_by INTEGER NOT NULL REFERENCES admins(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX labor_events_employment ON labor_lifecycle_events(employment_id,effective_on,id);
    CREATE TRIGGER labor_events_no_update BEFORE UPDATE ON labor_lifecycle_events
    BEGIN SELECT RAISE(ABORT,'Historial laboral inmutable'); END;
    CREATE TRIGGER labor_events_no_delete BEFORE DELETE ON labor_lifecycle_events
    BEGIN SELECT RAISE(ABORT,'Historial laboral no se elimina'); END;

    CREATE TABLE employment_documents(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employment_id INTEGER NOT NULL REFERENCES employment_relationships(id) ON DELETE RESTRICT,
      contract_file_id INTEGER NOT NULL REFERENCES employee_contract_files(id) ON DELETE RESTRICT,
      document_kind TEXT NOT NULL CHECK(document_kind IN ('CONTRACT','ANNEX','OTHER')),
      evidence_ref TEXT NOT NULL CHECK(trim(evidence_ref)<>''),
      linked_by INTEGER NOT NULL REFERENCES admins(id) ON DELETE RESTRICT,
      linked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(employment_id,contract_file_id)
    );
    CREATE TRIGGER employment_documents_worker BEFORE INSERT ON employment_documents
    WHEN NOT EXISTS(
      SELECT 1 FROM employment_relationships r
      JOIN employee_contract_files f ON f.employee_id=r.employee_id
      WHERE r.id=NEW.employment_id AND f.id=NEW.contract_file_id
    ) BEGIN SELECT RAISE(ABORT,'PDF no corresponde al trabajador'); END;
    CREATE TRIGGER employment_documents_no_update BEFORE UPDATE ON employment_documents
    BEGIN SELECT RAISE(ABORT,'Vinculo documental inmutable'); END;
    CREATE TRIGGER employment_documents_no_delete BEFORE DELETE ON employment_documents
    BEGIN SELECT RAISE(ABORT,'Vinculo documental no se elimina'); END;

    CREATE TABLE employment_shift_versions(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employment_id INTEGER NOT NULL REFERENCES employment_relationships(id) ON DELETE RESTRICT,
      shift_id INTEGER NOT NULL REFERENCES work_shifts(id) ON DELETE RESTRICT,
      valid_from TEXT NOT NULL CHECK(length(valid_from)=10),
      valid_until TEXT CHECK(valid_until IS NULL OR valid_until>valid_from),
      evidence_ref TEXT NOT NULL CHECK(trim(evidence_ref)<>''),
      confirmed_by INTEGER NOT NULL REFERENCES admins(id) ON DELETE RESTRICT,
      confirmed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX employment_shift_period ON employment_shift_versions(employment_id,valid_from,valid_until);
    CREATE TRIGGER employment_shift_scope BEFORE INSERT ON employment_shift_versions
    BEGIN
      SELECT RAISE(ABORT,'Horario requiere empleo confirmado y fecha comprendida')
      WHERE NOT EXISTS(
        SELECT 1 FROM employment_relationships e JOIN work_shifts s ON s.id=NEW.shift_id
        WHERE e.id=NEW.employment_id AND e.review_status='CONFIRMED'
          AND NEW.valid_from>=e.started_on
          AND (e.ended_on IS NULL OR NEW.valid_from<=e.ended_on)
      );
      SELECT RAISE(ABORT,'Horarios de un empleo no pueden superponerse')
      WHERE EXISTS(
        SELECT 1 FROM employment_shift_versions x WHERE x.employment_id=NEW.employment_id
          AND NEW.valid_from<coalesce(x.valid_until,'9999-12-31')
          AND x.valid_from<coalesce(NEW.valid_until,'9999-12-31')
      );
    END;
    CREATE TRIGGER employment_shift_no_update BEFORE UPDATE ON employment_shift_versions
    WHEN NOT(
      OLD.valid_until IS NULL AND NEW.valid_until IS NOT NULL AND NEW.valid_until>OLD.valid_from
      AND NEW.id IS OLD.id AND NEW.employment_id IS OLD.employment_id
      AND NEW.shift_id IS OLD.shift_id AND NEW.valid_from IS OLD.valid_from
      AND NEW.evidence_ref IS OLD.evidence_ref AND NEW.confirmed_by IS OLD.confirmed_by
      AND NEW.confirmed_at IS OLD.confirmed_at
    ) BEGIN SELECT RAISE(ABORT,'Sólo se puede cerrar la vigencia de un turno'); END;
    CREATE TRIGGER employment_shift_no_delete BEFORE DELETE ON employment_shift_versions
    BEGIN SELECT RAISE(ABORT,'No eliminar horarios históricos'); END;

    -- Antes: prohibición total de UPDATE. Ahora sólo permite CERRAR la vigencia
    -- previa en una fecha posterior, sin tocar ningún otro campo o dato económico.
    DROP TRIGGER employment_assignments_no_update;
    CREATE TRIGGER employment_assignments_no_update BEFORE UPDATE ON employment_assignments
    WHEN NOT(
      OLD.valid_until IS NULL AND NEW.valid_until IS NOT NULL AND NEW.valid_until>OLD.valid_from
      AND NEW.id IS OLD.id AND NEW.employment_id IS OLD.employment_id
      AND NEW.branch_id IS OLD.branch_id AND NEW.work_area_id IS OLD.work_area_id
      AND NEW.position_id IS OLD.position_id AND NEW.valid_from IS OLD.valid_from
      AND NEW.evidence_ref IS OLD.evidence_ref AND NEW.confirmed_by IS OLD.confirmed_by
      AND NEW.confirmed_at IS OLD.confirmed_at
    ) BEGIN SELECT RAISE(ABORT,'Sólo se permite cerrar vigencia de asignación, sin cambiar su origen'); END;

    DROP TRIGGER employment_terms_no_update;
    CREATE TRIGGER employment_terms_no_update BEFORE UPDATE ON employment_terms_versions
    WHEN NOT(
      OLD.effective_until IS NULL AND NEW.effective_until IS NOT NULL AND NEW.effective_until>OLD.effective_from
      AND NEW.id IS OLD.id AND NEW.employment_id IS OLD.employment_id
      AND NEW.effective_from IS OLD.effective_from
      AND NEW.monthly_base_salary_clp IS OLD.monthly_base_salary_clp
      AND NEW.weekly_hours IS OLD.weekly_hours AND NEW.break_minutes IS OLD.break_minutes
      AND NEW.terms_snapshot_json IS OLD.terms_snapshot_json
      AND NEW.source_document_ref IS OLD.source_document_ref AND NEW.confirmed_by IS OLD.confirmed_by
      AND NEW.confirmed_at IS OLD.confirmed_at
    ) BEGIN SELECT RAISE(ABORT,'Sólo se permite cerrar vigencia contractual, sin cambiar sueldo ni origen'); END;

    DROP TRIGGER employee_prevision_no_update;
    CREATE TRIGGER employee_prevision_no_update BEFORE UPDATE ON employee_prevision_versions
    WHEN NOT(
      OLD.valid_until IS NULL AND NEW.valid_until IS NOT NULL AND NEW.valid_until>OLD.valid_from
      AND NEW.id IS OLD.id AND NEW.employee_id IS OLD.employee_id
      AND NEW.valid_from IS OLD.valid_from
      AND NEW.afp_entity_id IS OLD.afp_entity_id
      AND NEW.health_entity_id IS OLD.health_entity_id
      AND NEW.plan_amount_hundredths IS OLD.plan_amount_hundredths
      AND NEW.plan_unit IS OLD.plan_unit AND NEW.source_ref IS OLD.source_ref
      AND NEW.confirmed_by IS OLD.confirmed_by AND NEW.confirmed_at IS OLD.confirmed_at
    ) BEGIN SELECT RAISE(ABORT,'Sólo se permite cerrar vigencia previsional sin reescribir datos'); END;
  `);
  await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[LABOR_STRUCTURE_MIGRATION]);
}
