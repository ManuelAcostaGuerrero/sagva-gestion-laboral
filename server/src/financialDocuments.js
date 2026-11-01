export function financialDocumentKind(name) {
  const normalized=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  if(!normalized.includes('ANEXO'))return null;
  if(normalized.includes('AUMENTO') && normalized.includes('SUELDO'))return 'SALARY_INCREASE';
  if(normalized.includes('BONO'))return 'BONUS';
  return null;
}
export async function migrateFinancialDocuments(db) {
  const id='20261011_018_financial_documents';
  if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[id]))[0].length)return;
  await db.execScript(`ALTER TABLE employee_document_entries ADD COLUMN financial_kind TEXT CHECK(financial_kind IS NULL OR financial_kind IN ('SALARY_INCREASE','BONUS'));
    ALTER TABLE employee_document_entries ADD COLUMN agreed_amount INTEGER CHECK(agreed_amount IS NULL OR agreed_amount BETWEEN 1 AND 1000000000000);
    ALTER TABLE employee_document_entries ADD COLUMN amount_meaning TEXT CHECK(amount_meaning IS NULL OR amount_meaning IN ('NEW_BASE','INCREASE','BONUS'));`);
  const [types]=await db.execute('SELECT name FROM employee_document_types');
  for(const [kind,name] of [['SALARY_INCREASE','ANEXO AL CONTRATO AUMENTO SUELDO'],['BONUS','ANEXO CONTRATO BONO']]) {
    if(types.some(type=>financialDocumentKind(type.name)===kind))continue;
    await db.execute("INSERT INTO employee_document_types(name,expiry_mode,applicability) VALUES(?,'NONE','ALL')",[name]);
  }
  await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[id]);
}

export async function migrateSalaryRetroactive(db) {
  const id='20261011_019_salary_retroactive';
  if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[id]))[0].length)return;
  await db.execScript(`ALTER TABLE employee_document_entries ADD COLUMN is_retroactive INTEGER CHECK(is_retroactive IS NULL OR is_retroactive IN (0,1));
    ALTER TABLE employee_document_entries ADD COLUMN retroactive_amount INTEGER CHECK(retroactive_amount IS NULL OR retroactive_amount BETWEEN 1 AND 1000000000000);
    ALTER TABLE employee_document_entries ADD COLUMN retroactive_months_json TEXT CHECK(retroactive_months_json IS NULL OR json_valid(retroactive_months_json));`);
  await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[id]);
}
