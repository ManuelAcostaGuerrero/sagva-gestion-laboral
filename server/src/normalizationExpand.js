// P3 expand: nada se copia ni borra automáticamente desde extra_json.
export const NORMALIZATION_EXPAND_MIGRATION='20261111_032_normalization_expand';

export async function migrateNormalizationExpand(db) {
  const [applied]=await db.execute('SELECT id FROM schema_migrations WHERE id=?',[NORMALIZATION_EXPAND_MIGRATION]);
  if(applied.length)return;
  await db.execScript(`
    -- Proyección de solo lectura. El valor relacional gana ante texto duplicado;
    -- el texto legado se conserva para conciliación y auditoría.
    CREATE VIEW employee_authority_v1 AS
      SELECT e.id AS employee_id,
        e.document_id AS document_id,
        coalesce(nullif(trim(e.legal_full_name),''),e.full_name) AS legal_name,
        e.full_name AS legacy_full_name,
        e.first_name AS first_name, e.second_name AS second_name,
        e.other_names AS other_names,e.first_last_name AS first_last_name,
        e.second_last_name AS second_last_name,
        e.email AS email,
        e.is_active AS is_active,
        f.employment_status AS employment_status,
        CASE WHEN (e.is_active=1 AND f.employment_status IN ('INACTIVO','FINIQUITADO'))
          OR (e.is_active=0 AND f.employment_status='ACTIVO') THEN 1 ELSE 0 END AS status_conflict,
        f.company_id AS company_id,
        CASE WHEN f.company_id IS NOT NULL THEN c.legal_name ELSE f.company END AS company_display,
        f.company AS legacy_company_name,
        f.work_schedule AS work_schedule,
        e.work_area_id AS work_area_id,
        e.position_name AS legacy_position_name
      FROM employees e
      LEFT JOIN employee_files f ON f.employee_id=e.id
      LEFT JOIN company_profiles c ON c.id=f.company_id;

    -- Información previsional estructurada con fecha y fuente verificadas.
    -- Tabla inicialmente VACÍA: no transformar AFP/Isapre/plan de extra_json sin revisión.
    CREATE TABLE employee_prevision_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
      valid_from TEXT NOT NULL,
      valid_until TEXT,
      afp_entity_id INTEGER REFERENCES labor_entities(id) ON DELETE RESTRICT,
      health_entity_id INTEGER REFERENCES labor_entities(id) ON DELETE RESTRICT,
      plan_amount_hundredths INTEGER CHECK(plan_amount_hundredths IS NULL OR plan_amount_hundredths>=0),
      plan_unit TEXT CHECK(plan_unit IS NULL OR plan_unit IN ('UF','CLP')),
      source_ref TEXT NOT NULL CHECK(trim(source_ref)<>''),
      confirmed_by INTEGER NOT NULL REFERENCES admins(id) ON DELETE RESTRICT,
      confirmed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK(valid_until IS NULL OR valid_until>valid_from),
      CHECK(length(valid_from)=10 AND substr(valid_from,5,1)='-' AND substr(valid_from,8,1)='-'),
      CHECK(valid_until IS NULL OR (length(valid_until)=10 AND substr(valid_until,5,1)='-' AND substr(valid_until,8,1)='-')),
      CHECK((plan_amount_hundredths IS NULL AND plan_unit IS NULL) OR
            (plan_amount_hundredths IS NOT NULL AND plan_unit IS NOT NULL))
    );
    CREATE INDEX employee_prevision_period ON employee_prevision_versions(employee_id,valid_from,valid_until);
    CREATE TRIGGER employee_prevision_validate BEFORE INSERT ON employee_prevision_versions
    BEGIN
      SELECT RAISE(ABORT,'Institucion AFP no es del tipo AFP')
      WHERE NEW.afp_entity_id IS NOT NULL
        AND NOT EXISTS(SELECT 1 FROM labor_entities WHERE id=NEW.afp_entity_id AND kind='AFP');
      SELECT RAISE(ABORT,'Institucion salud no corresponde a FONASA o ISAPRE')
      WHERE NEW.health_entity_id IS NOT NULL
        AND NOT EXISTS(SELECT 1 FROM labor_entities WHERE id=NEW.health_entity_id AND kind IN ('FONASA','ISAPRE'));
      SELECT RAISE(ABORT,'Tramos de previsión superpuestos')
      WHERE EXISTS(
        SELECT 1 FROM employee_prevision_versions old
        WHERE old.employee_id=NEW.employee_id
          AND NEW.valid_from<coalesce(old.valid_until,'9999-12-31')
          AND old.valid_from<coalesce(NEW.valid_until,'9999-12-31')
      );
    END;
    CREATE TRIGGER employee_prevision_no_update BEFORE UPDATE ON employee_prevision_versions
    BEGIN SELECT RAISE(ABORT,'No reemplazar previsión histórica: registrar otra vigencia'); END;
    CREATE TRIGGER employee_prevision_no_delete BEFORE DELETE ON employee_prevision_versions
    BEGIN SELECT RAISE(ABORT,'No eliminar previsión histórica sin rectificación formal'); END;
  `);
  await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[NORMALIZATION_EXPAND_MIGRATION]);
}

// Consultas internas versionadas: no filtran ni revelan información personal por HTTP.
export async function previsionAsOf(db,employeeId,on){
  if(!Number.isSafeInteger(employeeId)||employeeId<1||!/^\d{4}-\d{2}-\d{2}$/.test(on))
    throw new Error('ID trabajador o fecha inválida');
  const [rows]=await db.execute(`
    SELECT v.id AS versionId,v.employee_id AS employeeId,v.valid_from AS validFrom,
           v.valid_until AS validUntil,v.afp_entity_id AS afpEntityId,
           v.health_entity_id AS healthEntityId,v.plan_amount_hundredths AS planAmountHundredths,
           v.plan_unit AS planUnit
    FROM employee_prevision_versions v WHERE v.employee_id=?
      AND v.valid_from<=? AND (v.valid_until IS NULL OR v.valid_until>?)`,[employeeId,on,on]);
  return rows[0]||null;
}
