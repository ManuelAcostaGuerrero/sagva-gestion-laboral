// Auditoría P0: sólo lectura. No crea ni migra registros, no exporta PII ni secretos.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import dotenv from 'dotenv';
import {projectRoot,resolveDatabasePath} from '../server/src/databasePath.js';

export function auditDataModel(db) {
  const names=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
  if(!names.has('employees'))throw new Error('No se encontró la tabla employees. No se ejecutaron migraciones.');
  const present=name=>names.has(name);
  const count=name=>present(name)?Number(db.prepare('SELECT COUNT(*) AS n FROM "'+name+'"').get().n):null;
  const measure=sql=>Number(db.prepare(sql).get().n);
  const summary={
    audit:'P0_DATOS_SOLO_LECTURA',
    integrity:db.prepare('PRAGMA integrity_check').get().integrity_check,
    foreignKeyViolations:db.prepare('PRAGMA foreign_key_check').all().length,
    totals:{
      workers:count('employees'),
      activeWorkers:measure('SELECT COUNT(*) n FROM employees WHERE is_active=1'),
      inactiveWorkers:measure('SELECT COUNT(*) n FROM employees WHERE is_active=0'),
      workerFiles:count('employee_files'),
      companies:count('company_profiles'),
      positions:count('work_positions'),
      contractTerms:count('employee_contract_terms'),
      salaryAnnexApprovals:count('employee_salary_annex_approvals'),
      attendanceMarks:count('attendance_records'),
      contractPdfs:count('employee_contract_files'),
      auditEvents:count('audit_logs'),
      schemaMigrations:count('schema_migrations')
    },
    indicators:{
      workersWithoutFile:null,
      activeWithNonActiveStatus:null,
      inactiveWithActiveStatus:null,
      workersWithStatusMissing:null,
      linkedCompanyWithoutLabel:null,
      companyTextWithoutCompanyId:null,
      companyLabelDifferentFromCurrentCatalog:null,
      positionNotInCatalog:null,
      extraJsonInvalid:null,
      contractTermsJsonInvalid:null
    },
    notes:[
      'Los conteos no identifican personas ni prueban por sí solos un error.',
      'El texto histórico de empresa puede diferir legítimamente del nombre actual.',
      'No conciliar automáticamente RUT, nombres, cargos, sucursales o contratos.',
      'Revisar en entorno privado el origen de cada diferencia antes de corregir.'
    ]
  };
  const i=summary.indicators;
  if(present('employee_files')){
    i.workersWithoutFile=measure('SELECT COUNT(*) n FROM employees e LEFT JOIN employee_files f ON f.employee_id=e.id WHERE f.employee_id IS NULL');
    i.activeWithNonActiveStatus=measure("SELECT COUNT(*) n FROM employees e JOIN employee_files f ON f.employee_id=e.id WHERE e.is_active=1 AND f.employment_status IN ('INACTIVO','FINIQUITADO')");
    i.inactiveWithActiveStatus=measure("SELECT COUNT(*) n FROM employees e JOIN employee_files f ON f.employee_id=e.id WHERE e.is_active=0 AND f.employment_status='ACTIVO'");
    i.workersWithStatusMissing=measure("SELECT COUNT(*) n FROM employee_files WHERE employment_status IS NULL OR trim(employment_status)=''");
    i.companyTextWithoutCompanyId=measure("SELECT COUNT(*) n FROM employee_files WHERE company_id IS NULL AND trim(coalesce(company,''))<>''");
    i.linkedCompanyWithoutLabel=measure("SELECT COUNT(*) n FROM employee_files WHERE company_id IS NOT NULL AND trim(coalesce(company,''))=''");
    i.extraJsonInvalid=measure("SELECT COUNT(*) n FROM employee_files WHERE extra_json IS NULL OR json_valid(extra_json)=0");
    if(present('company_profiles'))i.companyLabelDifferentFromCurrentCatalog=measure("SELECT COUNT(*) n FROM employee_files f JOIN company_profiles c ON c.id=f.company_id WHERE upper(trim(coalesce(f.company,'')))<>upper(trim(c.legal_name))");
  }
  if(present('work_positions'))i.positionNotInCatalog=measure("SELECT COUNT(*) n FROM employees e WHERE trim(coalesce(e.position_name,''))<>'' AND NOT EXISTS (SELECT 1 FROM work_positions p WHERE upper(trim(p.name))=upper(trim(e.position_name)))");
  if(present('employee_contract_terms'))i.contractTermsJsonInvalid=measure("SELECT COUNT(*) n FROM employee_contract_terms WHERE terms_json IS NULL OR json_valid(terms_json)=0");
  return summary;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const envPath=path.join(projectRoot,'server','.env');
  if(!fs.existsSync(envPath))throw new Error('Falta server/.env: no se modificó configuración.');
  const config=dotenv.parse(fs.readFileSync(envPath));
  const location=resolveDatabasePath(config);
  if(location===':memory:'||!fs.existsSync(location))throw new Error('No hay base SQLite persistente. No se creó ninguna.');
  const db=new DatabaseSync(location,{readOnly:true,timeout:5000});
  try {
    db.exec('PRAGMA query_only=ON');
    console.log(JSON.stringify(auditDataModel(db),null,2));
  } finally {db.close();}
}
