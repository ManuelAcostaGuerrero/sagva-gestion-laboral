// ISO dates sort chronologically; reject impossible dates before comparing.
export function validContractDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function currentContractEnd(file) {
  if (file.contractType === 'INDEFINIDO') return file.employmentStatus === 'ACTIVO' ? null : file.terminationDate || null;
  return file.annexes?.at(-1)?.endDate || file.terminationDate || null;
}
export function validateContract(file) {
  const fail = message => { throw Object.assign(new Error(message), {status:400}); };
  const annexes = file.annexes || [];
  if (annexes.length > 2) fail('Se permiten como máximo dos anexos.');
  for (const [key,label] of [['hireDate','inicio'],['terminationDate','término inicial'],['birthDate','nacimiento']])
    if (file[key] && !validContractDate(file[key])) fail(`Revisa la fecha de ${label}. Usa una fecha válida del calendario.`);
  if (['PLAZO_FIJO','INDEFINIDO'].includes(file.contractType) && file.hireDate && file.terminationDate && file.terminationDate < file.hireDate)
    fail('La fecha de término inicial no puede ser anterior al inicio.');
  if (annexes.length && file.contractType !== 'PLAZO_FIJO') fail('Los anexos de prórroga requieren un contrato a plazo fijo.');
  let previous = file.terminationDate;
  let previousAnnexDate = file.hireDate;
  for (const annex of annexes) {
    if (!validContractDate(annex.annexDate) || !validContractDate(annex.endDate)) fail('Completa la fecha del anexo y su nueva fecha de término con fechas válidas.');
    if (!validContractDate(previous) || annex.endDate <= previous) fail('La nueva fecha de término debe ser posterior a la vigencia anterior.');
    if ((previousAnnexDate && annex.annexDate < previousAnnexDate) || annex.annexDate > annex.endDate)
      fail('La fecha del anexo debe respetar el orden contractual y no superar su nueva fecha de término.');
    previous = annex.endDate;
    previousAnnexDate = annex.annexDate;
  }
}
export async function migrateEmployeeContracts(connection) {
  const id = '20261008_008_employee_contract_annexes';
  const [applied] = await connection.execute('SELECT id FROM schema_migrations WHERE id=?',[id]);
  if (applied.length) return;
  await connection.execScript(`
    ALTER TABLE employee_files ADD COLUMN termination_reason TEXT;
    ALTER TABLE employee_files ADD COLUMN review_notes TEXT;
    CREATE TABLE employee_contract_annexes (
      employee_id INTEGER NOT NULL REFERENCES employee_files(employee_id) ON DELETE RESTRICT,
      annex_order INTEGER NOT NULL CHECK(annex_order IN (1,2)),
      annex_date TEXT NOT NULL, end_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      created_by INTEGER REFERENCES admins(id), updated_by INTEGER REFERENCES admins(id),
      PRIMARY KEY(employee_id,annex_order)
    );
    CREATE TRIGGER employee_annex_order BEFORE INSERT ON employee_contract_annexes
      WHEN NEW.annex_order=2 AND NOT EXISTS(SELECT 1 FROM employee_contract_annexes WHERE employee_id=NEW.employee_id AND annex_order=1)
      BEGIN SELECT RAISE(ABORT,'Anexo 1 requerido'); END;
  `);
  const [violations] = await connection.execute('PRAGMA foreign_key_check');
  if (violations.length) throw new Error('Referencias inválidas al migrar contratos.');
  await connection.execute('INSERT INTO schema_migrations(id) VALUES(?)',[id]);
}
