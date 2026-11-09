import {blankContractTerms} from './contractTerms.js';
import {recordAudit} from './auditLog.js';
import {validContractDate} from './employeeContracts.js';

export const SALARY_APPROVAL_MIGRATION='20261109_021_salary_annex_approval';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const salaryLimit=1000000000000;

export async function migrateSalaryAnnexApprovals(db){
  if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[SALARY_APPROVAL_MIGRATION]))[0].length)return;
  await db.execScript(`
    CREATE TABLE employee_salary_annex_approvals(
      entry_id INTEGER PRIMARY KEY REFERENCES employee_document_entries(id) ON DELETE RESTRICT,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
      effective_on TEXT NOT NULL,
      previous_salary INTEGER CHECK(previous_salary IS NULL OR previous_salary BETWEEN 0 AND 1000000000000),
      new_salary INTEGER NOT NULL CHECK(new_salary BETWEEN 1 AND 1000000000000),
      terms_revision INTEGER NOT NULL CHECK(terms_revision>0),
      approved_by INTEGER NOT NULL REFERENCES admins(id),
      approved_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX employee_salary_annex_approvals_worker ON employee_salary_annex_approvals(employee_id,effective_on,entry_id);
  `);
  await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[SALARY_APPROVAL_MIGRATION]);
}

// Independiente de React y de la base de datos, para compartir una sola regla.
export function calculateApprovedSalary({currentSalary,amountMeaning,agreedAmount}){
  if(!Number.isSafeInteger(agreedAmount)||agreedAmount<=0||agreedAmount>salaryLimit)
    throw fail('El monto del anexo debe ser un entero positivo en pesos.');
  if(amountMeaning==='NEW_BASE')return agreedAmount;
  if(amountMeaning!=='INCREASE')throw fail('Indica nuevo sueldo base o monto de aumento.');
  if(!Number.isSafeInteger(currentSalary)||currentSalary<=0)
    throw fail('Para sumar un aumento primero registra el sueldo base vigente.');
  const total=currentSalary+agreedAmount;
  if(!Number.isSafeInteger(total)||total>salaryLimit)
    throw fail('El nuevo sueldo supera el máximo permitido.');
  return total;
}

export async function approveSalaryAnnex(db,{entryId,admin}){
  const [entries]=await db.execute(`
    SELECT id,employee_id AS employeeId,financial_kind AS financialKind,
      agreed_amount AS agreedAmount,amount_meaning AS amountMeaning,start_on AS effectiveOn
    FROM employee_document_entries WHERE id=?`,[entryId]);
  const entry=entries[0];
  if(!entry)throw fail('Anexo no encontrado.',404);
  if(entry.financialKind!=='SALARY_INCREASE')
    throw fail('Solo se puede aprobar un anexo de aumento de sueldo.');
  if(!validContractDate(entry.effectiveOn))
    throw fail('El anexo necesita una fecha de inicio válida.');
  const [already]=await db.execute('SELECT entry_id FROM employee_salary_annex_approvals WHERE entry_id=?',[entryId]);
  if(already.length)throw fail('Este anexo ya fue aprobado y aplicado. No se puede sumar dos veces.',409);
  const [signed]=await db.execute('SELECT id FROM employee_document_attachments WHERE entry_id=? AND signed_physical=1 AND signed_on IS NOT NULL LIMIT 1',[entryId]);
  if(!signed.length)throw fail('Adjunta y confirma la firma del PDF antes de aprobar el anexo.',409);
  const [later]=await db.execute(`
    SELECT entry_id FROM employee_salary_annex_approvals WHERE employee_id=? AND
      (effective_on>? OR (effective_on=? AND entry_id>?)) LIMIT 1
  `,[entry.employeeId,entry.effectiveOn,entry.effectiveOn,entryId]);
  if(later.length)throw fail('Existe un aumento posterior ya aplicado; revisa el orden cronológico de estos anexos.',409);
  const [termsRows]=await db.execute('SELECT terms_json AS data,revision FROM employee_contract_terms WHERE employee_id=?',[entry.employeeId]);
  const revision=termsRows.length?Number(termsRows[0].revision):0;
  const current={...blankContractTerms(),...(termsRows.length?JSON.parse(termsRows[0].data):{})};
  const previousSalary=Number.isSafeInteger(current.monthlyBaseSalary)&&current.monthlyBaseSalary>0?current.monthlyBaseSalary:null;
  const newSalary=calculateApprovedSalary({currentSalary:previousSalary,amountMeaning:entry.amountMeaning,agreedAmount:Number(entry.agreedAmount)});
  const updated={...current,monthlyBaseSalary:newSalary};
  delete updated.revision;
  const nextRevision=revision+1;
  if(revision){
    await db.execute("UPDATE employee_contract_terms SET terms_json=?,revision=?,updated_by=?,updated_at=datetime('now','localtime') WHERE employee_id=? AND revision=?",
      [JSON.stringify(updated),nextRevision,admin.id,entry.employeeId,revision]);
  }else{
    await db.execute('INSERT INTO employee_contract_terms(employee_id,terms_json,revision,created_by,updated_by) VALUES(?,?,?,?,?)',
      [entry.employeeId,JSON.stringify(updated),nextRevision,admin.id,admin.id]);
  }
  await db.execute('INSERT INTO employee_contract_terms_history(employee_id,revision,snapshot_json,changed_by) VALUES(?,?,?,?)',
    [entry.employeeId,nextRevision,JSON.stringify(updated),admin.id]);
  await db.execute('INSERT INTO employee_salary_annex_approvals(entry_id,employee_id,effective_on,previous_salary,new_salary,terms_revision,approved_by) VALUES(?,?,?,?,?,?,?)',
    [entryId,entry.employeeId,entry.effectiveOn,previousSalary,newSalary,nextRevision,admin.id]);
  await recordAudit(admin,'approve','employee_salary_annex',entryId,
    {employeeId:entry.employeeId,effectiveOn:entry.effectiveOn,previousSalary,newSalary,termsRevision:nextRevision,amountMeaning:entry.amountMeaning},db);
  return {entryId,employeeId:entry.employeeId,effectiveOn:entry.effectiveOn,previousSalary,newSalary,termsRevision:nextRevision};
}
