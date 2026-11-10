import {validContractDate} from './employeeContracts.js';
export const FIELDS_MIGRATION='20261110_026_labor_configured_fields';
export const fieldTargets=['FICHA','CONTRATO'];
export const fieldTypes=['TEXT','NUMBER','DATE','BOOLEAN','SELECT'];
export async function migrateLaborFields(db){
 if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[FIELDS_MIGRATION]))[0].length)return;
 await db.execScript([
  "CREATE TABLE labor_config_fields (id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT NOT NULL UNIQUE,label TEXT NOT NULL,target TEXT NOT NULL CHECK(target IN ('FICHA','CONTRATO')),field_type TEXT NOT NULL CHECK(field_type IN ('TEXT','NUMBER','DATE','BOOLEAN','SELECT')),required INTEGER NOT NULL DEFAULT 0,options_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(options_json)),active INTEGER NOT NULL DEFAULT 1,revision INTEGER NOT NULL DEFAULT 1,updated_by INTEGER REFERENCES admins(id),updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);",
  "CREATE TABLE labor_config_field_history (id INTEGER PRIMARY KEY AUTOINCREMENT,field_id INTEGER NOT NULL REFERENCES labor_config_fields(id) ON DELETE RESTRICT,revision INTEGER NOT NULL,snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),reason TEXT NOT NULL,changed_by INTEGER REFERENCES admins(id),changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);",
  "CREATE TABLE employee_config_field_values (employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,field_id INTEGER NOT NULL REFERENCES labor_config_fields(id) ON DELETE RESTRICT,value_json TEXT NOT NULL CHECK(json_valid(value_json)),revision INTEGER NOT NULL DEFAULT 1,updated_by INTEGER REFERENCES admins(id),updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(employee_id,field_id));",
  "CREATE TABLE employee_config_field_history (id INTEGER PRIMARY KEY AUTOINCREMENT,employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,field_id INTEGER NOT NULL REFERENCES labor_config_fields(id) ON DELETE RESTRICT,revision INTEGER NOT NULL,previous_json TEXT,current_json TEXT NOT NULL,changed_by INTEGER REFERENCES admins(id),changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);"
 ].join('\n'));
 await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[FIELDS_MIGRATION]);
}
export const parseOptions=(raw)=>{try{return JSON.parse(raw||'[]');}catch{return [];}};
export const fieldPublic=row=>({
 id:row.id,code:row.code,label:row.label,target:row.target,type:row.field_type,
 required:!!row.required,options:parseOptions(row.options_json),active:!!row.active,revision:row.revision
});
export function validFieldValue(field,value){
 if(value===null||value===''||value===undefined)return {ok:true,value:null};
 if(field.type==='TEXT')return {ok:typeof value==='string'&&value.length<=400,value};
 if(field.type==='NUMBER')return {ok:typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1000000000000,value};
 if(field.type==='DATE')return {ok:typeof value==='string'&&validContractDate(value),value};
 if(field.type==='BOOLEAN')return {ok:typeof value==='boolean',value};
 if(field.type==='SELECT')return {ok:typeof value==='string'&&field.options.includes(value),value};
 return {ok:false};
}
