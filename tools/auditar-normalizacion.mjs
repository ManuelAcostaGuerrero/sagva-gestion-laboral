// P3: diagnostico agregado y de solo lectura para planificar conciliacion humana.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import dotenv from 'dotenv';
import {projectRoot,resolveDatabasePath} from '../server/src/databasePath.js';

// Dato -> autoridad actual -> legado a comparar -> destino previsto.
export const FIELD_AUTHORITY_V1=Object.freeze([
  {field:'identidad_legal',authority:'employees.legal_full_name',legacy:'employees.full_name; employee_files.extra_json.firstName/paternalLastName'},
  {field:'identidad_partes',authority:'employees.first_name/first_last_name/second_last_name',legacy:'employee_files.extra_json.firstName/paternalLastName/maternalLastName'},
  {field:'empresa',authority:'employee_files.company_id -> company_profiles.id',legacy:'employee_files.company'},
  {field:'cargo',authority:'work_positions (catalogo)',legacy:'employees.position_name',target:'employment_assignments.position_id'},
  {field:'area',authority:'employees.work_area_id',target:'employment_assignments.work_area_id'},
  {field:'sucursal',authority:'pendiente_confirmacion',legacy:'employee_files.extra_json.branch',target:'company_branches/employment_assignments'},
  {field:'estado_laboral',authority:'employees.is_active y employee_files.employment_status (conciliar)',target:'employment_relationships'},
  {field:'jornada',authority:'employee_contract_terms.terms_json (pactada)',legacy:'employee_files.work_schedule; planificador (distintos significados)',target:'employment_terms_versions'},
  {field:'sueldo',authority:'employee_contract_terms + anexos firmados',target:'employment_terms_versions.monthly_base_salary_clp'},
  {field:'afp_salud',authority:'employee_files.extra_json hasta revision',target:'employee_prevision_versions'},
  {field:'campos_configurables',authority:'labor_config_fields / employee_config_field_values',action:'conservar tipado flexible y permisos; no eliminar JSON'},
  {field:'marcaciones',authority:'attendance_records (original)',target:'attendance_employment_links (solo vinculos revisados)'}
]);

export function auditNormalization(db){
  const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name));
  if(!tables.has('employees'))throw new Error('No existe employees. No se aplican migraciones.');
  const present=(...names)=>names.every(name=>tables.has(name));
  const count=sql=>Number(db.prepare(sql).get().n);
  const safeText=key=>`CASE WHEN json_valid(f.extra_json) THEN coalesce(json_extract(f.extra_json,'$.${key}'),'') ELSE '' END`;
  const counts={
    employeeRecords:count('SELECT COUNT(*) n FROM employees'),
    profiles:present('employee_files')?count('SELECT COUNT(*) n FROM employee_files'):null,
    recordsWithLegacyExtras:null,
    invalidExtrasJson:null,
    legacyPaternalSurnameConflicts:null,
    legacyMaternalSurnameConflicts:null,
    linkedCompanyNameDifferences:null,
    legacyCompanyTextWithoutId:null,
    branchTextWithoutCompanyId:null,
    recordedAfpInJson:null,
    recordedHealthInJson:null,
    unrecognizedAfpLabel:null,
    unrecognizedIsapreLabel:null,
    invalidContractTermsJson:null,
    confirmedPrevisionVersions:present('employee_prevision_versions')?count('SELECT COUNT(*) n FROM employee_prevision_versions'):null,
    confirmedEmploymentRelationships:present('employment_relationships')?count("SELECT COUNT(*) n FROM employment_relationships WHERE review_status='CONFIRMED'"):null
  };
  if(present('employee_files')){
    counts.invalidExtrasJson=count('SELECT COUNT(*) n FROM employee_files WHERE NOT json_valid(extra_json)');
    counts.recordsWithLegacyExtras=count("SELECT COUNT(*) n FROM employee_files WHERE json_valid(extra_json) AND extra_json<>'{}'");
    counts.legacyPaternalSurnameConflicts=count(`SELECT COUNT(*) n FROM employees e JOIN employee_files f ON f.employee_id=e.id
      WHERE trim(coalesce(e.first_last_name,''))<>'' AND trim(${safeText('paternalLastName')})<>''
      AND upper(trim(e.first_last_name))<>upper(trim(${safeText('paternalLastName')}))`);
    counts.legacyMaternalSurnameConflicts=count(`SELECT COUNT(*) n FROM employees e JOIN employee_files f ON f.employee_id=e.id
      WHERE trim(coalesce(e.second_last_name,''))<>'' AND trim(${safeText('maternalLastName')})<>''
      AND upper(trim(e.second_last_name))<>upper(trim(${safeText('maternalLastName')}))`);
    counts.legacyCompanyTextWithoutId=count("SELECT COUNT(*) n FROM employee_files WHERE company_id IS NULL AND trim(coalesce(company,''))<>''");
    counts.branchTextWithoutCompanyId=count(`SELECT COUNT(*) n FROM employee_files f
      WHERE company_id IS NULL AND trim(${safeText('branch')})<>''`);
    counts.recordedAfpInJson=count(`SELECT COUNT(*) n FROM employee_files f WHERE trim(${safeText('afp')})<>''`);
    counts.recordedHealthInJson=count(`SELECT COUNT(*) n FROM employee_files f
      WHERE trim(${safeText('healthSystem')})<>'' OR trim(${safeText('isapreName')})<>''`);
    if(present('company_profiles'))counts.linkedCompanyNameDifferences=count(`SELECT COUNT(*) n
      FROM employee_files f JOIN company_profiles c ON c.id=f.company_id
      WHERE trim(coalesce(f.company,''))<>'' AND upper(trim(f.company))<>upper(trim(c.legal_name))`);
    if(present('labor_entities')){
      counts.unrecognizedAfpLabel=count(`SELECT COUNT(*) n FROM employee_files f WHERE trim(${safeText('afp')})<>''
        AND NOT EXISTS (SELECT 1 FROM labor_entities l WHERE l.kind='AFP' AND
         (upper(trim(l.code))=upper(trim(${safeText('afp')})) OR upper(trim(l.name))=upper(trim(${safeText('afp')}))))`);
      counts.unrecognizedIsapreLabel=count(`SELECT COUNT(*) n FROM employee_files f WHERE trim(${safeText('isapreName')})<>''
        AND NOT EXISTS (SELECT 1 FROM labor_entities l WHERE l.kind='ISAPRE' AND
         (upper(trim(l.code))=upper(trim(${safeText('isapreName')})) OR upper(trim(l.name))=upper(trim(${safeText('isapreName')}))))`);
    }
  }
  if(present('employee_contract_terms'))counts.invalidContractTermsJson=count(
    'SELECT COUNT(*) n FROM employee_contract_terms WHERE NOT json_valid(terms_json)');
  return {
    stage:'P3_COMPARE_ONLY',writeOperations:0,
    integrity:db.prepare('PRAGMA integrity_check').get().integrity_check,
    foreignKeyViolations:db.prepare('PRAGMA foreign_key_check').all().length,
    counts,
    advice:'Los indicadores son candidatos a conciliacion privada, NO autorizan correccion ni backfill automatico. Los textos legados pueden ser historicos.'
  };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const env=path.join(projectRoot,'server','.env');
  if(!fs.existsSync(env))throw new Error('Falta server/.env; no se realizaron cambios.');
  const config=dotenv.parse(fs.readFileSync(env));
  const file=resolveDatabasePath(config);
  if(file===':memory:'||!fs.existsSync(file))throw new Error('No existe la base local; no se creó una nueva.');
  const db=new DatabaseSync(file,{readOnly:true,timeout:5000});
  try{
    db.exec('PRAGMA query_only=ON');
    console.log(JSON.stringify(auditNormalization(db),null,2));
  }finally{db.close();}
}
