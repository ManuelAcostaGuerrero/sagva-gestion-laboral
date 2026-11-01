import {validContractDate} from './employeeContracts.js';
import {checkRut} from './rut.js';

// Readiness covers information already supported by the employee file.
// A future approved template must define additional employer/pay/working-hour data.
export function contractPreparation(file) {
  const missing = [];
  for (const [key,label] of [['legalFullName','Nombre legal completo'],['address','Dirección'],['company','Empresa'],['positionName','Cargo'],['workAreaId','Área'],['workSchedule','Jornada'],['birthDate','Fecha de nacimiento']])
    if (!String(file[key] ?? '').trim()) missing.push(label);
  if (!checkRut(file.documentId).valid) missing.push('RUT válido');
  if (!validContractDate(file.hireDate)) missing.push('Fecha de inicio válida');
  if (file.birthDate && !validContractDate(file.birthDate)) missing.push('Fecha de nacimiento válida');
  if (!['INDEFINIDO','PLAZO_FIJO'].includes(file.contractType)) missing.push('Tipo de contrato');
  if (file.contractType === 'PLAZO_FIJO' && (!validContractDate(file.terminationDate) || file.terminationDate < file.hireDate)) missing.push('Fecha de término inicial válida');
  return {missing, fileReady:!missing.length, generationAvailable:false};
}
export async function migrateContractFiles(db) {
  const id = '20261010_013_contract_files';
  if ((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[id]))[0].length) return;
  await db.execScript(`CREATE TABLE employee_contract_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employee_files(employee_id) ON DELETE RESTRICT,
    annex_order INTEGER,
    filename TEXT NOT NULL, pdf BLOB NOT NULL, sha256 TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'UPLOAD' CHECK(source IN ('UPLOAD','GENERATED')),
    contract_snapshot_json TEXT NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    uploaded_by INTEGER NOT NULL REFERENCES admins(id),
    CHECK(annex_order IS NULL OR annex_order IN (1,2)),
    FOREIGN KEY(employee_id,annex_order) REFERENCES employee_contract_annexes(employee_id,annex_order) ON DELETE RESTRICT
  );
  CREATE INDEX contract_files_worker ON employee_contract_files(employee_id,annex_order);`);
  await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[id]);
}
