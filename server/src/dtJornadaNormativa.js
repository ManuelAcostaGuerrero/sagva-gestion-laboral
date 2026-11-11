// Parámetros normativos versionados, no liquidación automática ni autorización DT.
// Fuente general: Código del Trabajo art. 22 + Ley 21.561 (transitorios).
// Aplicación a jornadas especiales/exentas requiere evaluación individual documentada.
export const DT_JORNADA_MIGRATION='20261111_033_dt_jornada_normative_versions';
export const DT_JORNADA_SOURCE='https://www.dt.gob.cl/portal/1628/w3-article-125909.html';

export async function migrateDtJornadaNormative(db) {
  if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[DT_JORNADA_MIGRATION]))[0].length)return;
  await db.execScript(`
    CREATE TABLE dt_jornada_normative_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      regime_code TEXT NOT NULL CHECK(regime_code IN ('GENERAL')),
      metric_code TEXT NOT NULL CHECK(metric_code IN ('MAX_WEEKLY_ORDINARY_HOURS')),
      effective_from TEXT NOT NULL,
      value_hours INTEGER NOT NULL CHECK(value_hours BETWEEN 1 AND 45),
      source_url TEXT NOT NULL,
      source_reference TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(regime_code,metric_code,effective_from),
      CHECK(length(effective_from)=10 AND substr(effective_from,5,1)='-' AND substr(effective_from,8,1)='-')
    );
    CREATE INDEX dt_jornada_asof ON dt_jornada_normative_versions(regime_code,metric_code,effective_from);
    CREATE TRIGGER dt_jornada_no_update BEFORE UPDATE ON dt_jornada_normative_versions
    BEGIN SELECT RAISE(ABORT,'No reescribir valores normativos historicos'); END;
    CREATE TRIGGER dt_jornada_no_delete BEFORE DELETE ON dt_jornada_normative_versions
    BEGIN SELECT RAISE(ABORT,'No borrar parametros normativos historicos'); END;
  `);
  const rules=[
    ['2005-01-01',45,'Límite general anterior a Ley 21.561'],
    ['2024-04-26',44,'Ley 21.561, primer tramo'],
    ['2026-04-26',42,'Ley 21.561, tercer año'],
    ['2028-04-26',40,'Ley 21.561, quinto año']
  ];
  for(const [on,hours,reference] of rules){
    await db.execute(`INSERT INTO dt_jornada_normative_versions
      (regime_code,metric_code,effective_from,value_hours,source_url,source_reference)
      VALUES('GENERAL','MAX_WEEKLY_ORDINARY_HOURS',?,?,?,?)`,
      [on,hours,DT_JORNADA_SOURCE,reference]);
  }
  await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[DT_JORNADA_MIGRATION]);
}

export function validatedWorkDate(value){
  const on=String(value||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(on))throw Object.assign(new Error('Fecha inválida, usa AAAA-MM-DD.'),{status:400});
  const date=new Date(on+'T12:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==on)
    throw Object.assign(new Error('Fecha imposible del calendario.'),{status:400});
  return on;
}

export async function assessWeeklyOrdinaryHours(db,{on,weeklyHours,regime='GENERAL'}){
  const validOn=validatedWorkDate(on);
  if(!Number.isFinite(weeklyHours)||weeklyHours<0||weeklyHours>168)
    throw Object.assign(new Error('Horas semanales inválidas.'),{status:400});
  // La ausencia de catálogo por régimen especial NO implica autorización ni rechazo.
  if(regime!=='GENERAL')return {
    on:validOn,regime,verified:false,requiresIndividualLegalReview:true,
    status:'REGIME_NOT_EVALUATED',warning:'Régimen especial o exceptuado: requiere norma y documento autorizante particular.'
  };
  const [rows]=await db.execute(`SELECT value_hours AS maxWeeklyHours,effective_from AS effectiveFrom,
      source_url AS sourceUrl,source_reference AS sourceReference
    FROM dt_jornada_normative_versions
    WHERE regime_code='GENERAL' AND metric_code='MAX_WEEKLY_ORDINARY_HOURS'
      AND effective_from<=? ORDER BY effective_from DESC LIMIT 1`,[validOn]);
  if(!rows.length)return {
    on:validOn,regime,verified:false,requiresIndividualLegalReview:true,
    status:'NO_GENERAL_RULE_FOR_DATE',
    warning:'No existe referencia legal verificada para este período.'
  };
  const rule=rows[0];
  const exceeds=weeklyHours>rule.maxWeeklyHours;
  return {
    on:validOn,regime,verified:true,requiresIndividualLegalReview:false,
    status:exceeds?'EXCEEDS_GENERAL_LIMIT':'WITHIN_GENERAL_LIMIT',
    weeklyHours,maxWeeklyHours:rule.maxWeeklyHours,ruleEffectiveFrom:rule.effectiveFrom,
    sourceUrl:rule.sourceUrl,sourceReference:rule.sourceReference,
    // Res. 38, art. 45.2: emitir advertencia, NO impedir la carga.
    warning:exceeds?'La jornada ingresada supera el máximo ordinario general a esta fecha. Revisar contrato y régimen aplicable.':null
  };
}
