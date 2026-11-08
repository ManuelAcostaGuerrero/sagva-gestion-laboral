import {checkRut} from './rut.js';
import {territoryPathValid} from '../../shared/chileTerritory.js';
import {normalizeLabel} from './workerFileStandards.js';

export const COMPANY_MIGRATION='20261011_015_company_profiles';
export async function migrateCompanyProfiles(db){
  if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[COMPANY_MIGRATION]))[0].length)return;
  await db.execScript(`
    CREATE TABLE company_profiles(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      legal_name TEXT NOT NULL, tax_id TEXT,
      trade_name TEXT, address TEXT, commune TEXT, email TEXT, phone TEXT,
      representative_name TEXT, representative_rut TEXT,
      default_branch TEXT, default_area_id INTEGER, default_position_name TEXT,
      default_schedule TEXT,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN(0,1)),
      revision INTEGER NOT NULL DEFAULT 1,
      updated_by INTEGER REFERENCES admins(id),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE UNIQUE INDEX company_profiles_rut ON company_profiles(upper(replace(replace(tax_id,'.',''),'-',''))) WHERE tax_id IS NOT NULL;
    ALTER TABLE employee_files ADD COLUMN company_id INTEGER REFERENCES company_profiles(id) ON DELETE RESTRICT;
    CREATE INDEX employee_files_company_id ON employee_files(company_id);
  `);
  await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[COMPANY_MIGRATION]);
}
export const COMPANY_TERRITORY_MIGRATION='20261108_016_company_territory';
export async function migrateCompanyTerritory(db){
  if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[COMPANY_TERRITORY_MIGRATION]))[0].length)return;
  await db.execScript(`
    ALTER TABLE company_profiles ADD COLUMN region TEXT;
    ALTER TABLE company_profiles ADD COLUMN province TEXT;
    ALTER TABLE company_profiles ADD COLUMN city TEXT;
  `);
  await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[COMPANY_TERRITORY_MIGRATION]);
}
export function companyPayload(data){
  const legalName=normalizeLabel(data.legalName);
  const rut=String(data.taxId||'').trim().toUpperCase();
  const representativeRut=String(data.representativeRut||'').trim().toUpperCase();
  const problem=message=>{throw Object.assign(new Error(message),{status:400});};
  if(!legalName)problem('Indica la razón social.');
  if(rut&&!checkRut(rut).valid)problem('El RUT de la empresa no es válido.');
  if(representativeRut&&!checkRut(representativeRut).valid)problem('El RUT del representante no es válido.');
  const region=normalizeLabel(data.region)||null, province=normalizeLabel(data.province)||null, commune=normalizeLabel(data.commune)||null;
  if(!territoryPathValid({region,province,commune}))problem('Revisa la relación Región, Provincia y Comuna.');
  return {
    legalName,taxId:rut||null,tradeName:normalizeLabel(data.tradeName)||null,
    address:normalizeLabel(data.address)||null,region,province,commune,
    city:normalizeLabel(data.city)||null,
    email:String(data.email||'').trim().toLowerCase()||null,
    phone:String(data.phone||'').trim()||null,
    representativeName:normalizeLabel(data.representativeName)||null,
    representativeRut:representativeRut||null,
    defaultBranch:normalizeLabel(data.defaultBranch)||null,
    defaultAreaId:data.defaultAreaId?Number(data.defaultAreaId):null,
    defaultPositionName:normalizeLabel(data.defaultPositionName)||null,
    defaultSchedule:String(data.defaultSchedule||'').trim().toUpperCase()||null
  };
}
