import {pool} from './db.js';
import {runMigrations} from './migrations.js';
import {recordAudit} from './auditLog.js';
import {empty,normalizeDocument,fileWarnings} from './employeeFiles.js';
import {nameKey,resolveWorkerNames} from './workerNames.js';
import {normalizeWorkLabel} from './workPositions.js';

const useful=value=>['0','NO ESPECIFICADA','NO ESPECIFICADO'].includes(nameKey(value))?null:empty(value);
const date=value=>{const raw=empty(value);if(!raw)return null;const m=raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:raw;};
import {importDifference} from './importReview.js';
export {importDifference} from './importReview.js';
export function workerInfoRows(rows){
  const result=new Map();let header;
  for(const row of rows){
    if(row.values[0]==='CODIGO INTERNO'){header=row.values;continue;}
    if(!header)continue;
    const allowed=['CODIGO INTERNO','RUT COLABORADOR','DV RUT COLABORADOR','NOMBRE','APELLIDO PATERNO','APELLIDO MATERNO','FECHA NACIMIENTO','FECHA CONTRATO','FECHA FINIQUITO','SEXO','EMAIL','TIPO CONTRATO','CENTRO COSTO','RUT EMPRESA','DV RUT EMPRESA','AREA','CARGO','TELEFONO LABORAL','DIRECCION','TELEFONO CELULAR','TELEFONO PARTICULAR','CODIGO JERARQUIA','SUCURSAL'];
    const data=Object.fromEntries(header.map((key,i)=>[key,row.values[i]]).filter(([key])=>allowed.includes(key)));
    const first=empty(data.NOMBRE);if(!first)continue;
    // Accounts belonging to the old attendance application are not workers.
    if(nameKey([first,data['APELLIDO PATERNO'],data['APELLIDO MATERNO']].filter(Boolean).join(' ')).includes('ADMINISTRADOR'))continue;
    const body=empty(data['RUT COLABORADOR']), verifier=empty(data['DV RUT COLABORADOR']);
    if(!body || !verifier) throw new Error(`Falta RUT o dígito verificador en fila ${row.row}.`);
    const documentId=`${body}-${verifier.toUpperCase()}`;
    // Last exported row wins for a duplicated worker; no second identity.
    result.set(normalizeDocument(documentId),{data,documentId,row:row.row,sheet:row.sheet});
  }
  if(!header || !header.includes('APELLIDO PATERNO') || !header.includes('DV RUT COLABORADOR')) throw new Error('No corresponde al informe de trabajadores esperado.');
  return [...result.values()];
}
export async function importWorkerInfo(rows,{approvedLinks={},admin=null}={}){
  await runMigrations();const entries=workerInfoRows(rows),result={created:0,updated:0,skipped:0,preservedRut:0,fields:0};
  const connection=await pool.getConnection();
  try{await connection.beginTransaction();
    for(const entry of entries){
      const data=entry.data,sourceDoc=normalizeDocument(entry.documentId);
      const sourceKey='worker-info:'+sourceDoc;
      const [already]=await connection.execute('SELECT employee_id,source_values_json FROM employee_import_sources WHERE source_key=?',[sourceKey]);
      if(already.length){result.skipped++;continue;}
      const [people]=await connection.execute('SELECT e.*,f.* FROM employees e LEFT JOIN employee_files f ON f.employee_id=e.id');
      let person=people.find(p=>normalizeDocument(p.document_id)===sourceDoc);
      if(!person && approvedLinks[sourceDoc]){person=people.find(p=>p.id===Number(approvedLinks[sourceDoc]));if(!person)throw new Error('La vinculación revisada no existe.');result.preservedRut++;}
      const names=resolveWorkerNames(person?.full_name,{firstName:data.NOMBRE,paternalLastName:data['APELLIDO PATERNO'],maternalLastName:data['APELLIDO MATERNO']});
      if(!person){
        const homonyms=people.filter(p=>nameKey(p.full_name)===nameKey(names.fullName));
        if(homonyms.length)throw new Error(`Hay un nombre coincidente con otro RUT en fila ${entry.row}. Revisa la vinculación antes de importar.`);
        const [created]=await connection.execute('INSERT INTO employees(full_name,document_id) VALUES(?,?)',[names.fullName,entry.documentId]);
        person={id:created.insertId,full_name:names.fullName,document_id:entry.documentId,is_active:1};result.created++;
      }else result.updated++;
      const extra={...JSON.parse(person.extra_json||'{}')};
      for(const [key,value] of Object.entries({workerNumber:data['CODIGO INTERNO'],firstName:names.firstName,paternalLastName:names.paternalLastName,maternalLastName:names.maternalLastName,sex:data.SEXO,branch:data.SUCURSAL,costCenter:data['CENTRO COSTO'],hierarchyUnit:data['CODIGO JERARQUIA']}))if(!empty(extra[key])&&useful(value)){extra[key]=useful(value);result.fields++;}
      // Exported contract codes are not assumed to mean fixed-term/indefinite.
      if(!empty(extra.sourceContractCode)) extra.sourceContractCode=empty(data['TIPO CONTRATO']);
      if(!empty(extra.companyDocumentId)) extra.companyDocumentId=data['RUT EMPRESA']&&data['DV RUT EMPRESA']?`${data['RUT EMPRESA']}-${data['DV RUT EMPRESA']}`:null;
      const fields={email:useful(data.EMAIL),position_name:useful(data.CARGO) ? normalizeWorkLabel(data.CARGO) : null,birth_date:date(data['FECHA NACIMIENTO']),address:useful(data.DIRECCION),mobile:useful(data['TELEFONO CELULAR']),phone:useful(data['TELEFONO PARTICULAR'])||useful(data['TELEFONO LABORAL']),hire_date:date(data['FECHA CONTRATO']),termination_date:date(data['FECHA FINIQUITO'])};
      const notes=[];
      // Canonical parts introduced by the identity migration: fill only missing
      // values; imported proposals never reconstruct the existing legal name.
      const given=String(names.firstName || '').split(/\s+/).filter(Boolean);
      const parts={first_name:given[0] || null,second_name:given[1] || null,other_names:given.slice(2).join(' ') || null,
        first_last_name:names.paternalLastName || null,second_last_name:names.maternalLastName || null};
      for(const [key,value] of Object.entries(parts)) {
        if(!empty(person[key]) && value) {person[key]=value;result.fields++;}
        else if(value && nameKey(person[key])!==nameKey(value)) notes.push(importDifference(key,value,person[key]));
      }
      extra.firstName=[person.first_name,person.second_name,person.other_names].filter(Boolean).join(' ') || extra.firstName;
      extra.paternalLastName=person.first_last_name || extra.paternalLastName;
      extra.maternalLastName=person.second_last_name || extra.maternalLastName;
      const sourceName=[data.NOMBRE,data['APELLIDO PATERNO'],data['APELLIDO MATERNO']].filter(Boolean).join(' ');
      if(person.legal_full_name && nameKey(person.legal_full_name)!==nameKey(sourceName))
        notes.push(importDifference('legal_full_name',sourceName,person.legal_full_name));
      for(const [key,value] of Object.entries(fields)){
        if(!empty(person[key]) && value){person[key]=value;result.fields++;}
        else if(value && String(person[key]).trim()!==value) notes.push(importDifference(key,value,person[key]));
      }
      if(normalizeDocument(person.document_id)!==sourceDoc) notes.push(importDifference('document_id',entry.documentId,person.document_id));
      if(nameKey(person.full_name)!==nameKey(names.fullName))notes.push('Nombre completado con nombres y apellidos del informe.');
      let areaId=person.work_area_id;
      if(!areaId && useful(data.AREA)){
        const alias={GARZON:'GARZONES',COPERIA:'COPERIA'};const requested=alias[nameKey(data.AREA)]||nameKey(data.AREA);
        const [areas]=await connection.execute('SELECT id,name FROM work_areas WHERE is_active=1');
        areaId=areas.find(a=>nameKey(a.name)===requested)?.id||null;
        if(!areaId)notes.push(`Área del informe pendiente de asignación: ${data.AREA}.`);
      }
      const validation=fileWarnings({documentId:person.document_id,email:person.email,hireDate:person.hire_date,terminationDate:person.termination_date,birthDate:person.birth_date});
      notes.push(...validation);
      const reviewNotes=[person.review_notes,...notes].filter(Boolean).join('\n')||null;
      const normalizedCargo=person.position_name ? normalizeWorkLabel(person.position_name) : null;
      if(normalizedCargo) await connection.execute('INSERT INTO work_positions(name) VALUES(?) ON CONFLICT(name) DO NOTHING',[normalizedCargo]);
      await connection.execute('UPDATE employees SET full_name=?,email=?,position_name=?,work_area_id=? WHERE id=?',[names.fullName,person.email||null,normalizedCargo,areaId,person.id]);
      await connection.execute('UPDATE employees SET first_name=?,second_name=?,other_names=?,first_last_name=?,second_last_name=? WHERE id=?',
        [person.first_name || null,person.second_name || null,person.other_names || null,person.first_last_name || null,person.second_last_name || null,person.id]);
      await connection.execute(`INSERT INTO employee_files(employee_id,birth_date,address,phone,mobile,hire_date,termination_date,extra_json,review_notes)
        VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(employee_id) DO UPDATE SET birth_date=excluded.birth_date,address=excluded.address,phone=excluded.phone,mobile=excluded.mobile,hire_date=excluded.hire_date,termination_date=excluded.termination_date,extra_json=excluded.extra_json,review_notes=excluded.review_notes,revision=employee_files.revision+1,updated_at=datetime('now','localtime')`,
        [person.id,person.birth_date||null,person.address||null,person.phone||null,person.mobile||null,person.hire_date||null,person.termination_date||null,JSON.stringify(extra),reviewNotes]);
      await connection.execute('INSERT INTO employee_import_sources(source_key,employee_id,sheet,source_row,source_values_json) VALUES(?,?,?,?,?)',[sourceKey,person.id,entry.sheet,entry.row,JSON.stringify(data)]);
      await recordAudit(admin,'enrich_worker','employee',person.id,{source:'Informe de trabajadores',row:entry.row,retainedRut:normalizeDocument(person.document_id)!==sourceDoc},connection);
    }
    await connection.commit();return result;
  }catch(error){await connection.rollback();throw error;}finally{connection.release();}
}
