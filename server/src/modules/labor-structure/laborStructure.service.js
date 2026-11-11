// Servicios transaccionales: las rutas no escriben SQL ni inventan historia laboral.
import {pool} from '../../db.js';
import {recordAudit} from '../../auditLog.js';
import {validContractDate} from '../../employeeContracts.js';
import {assessWeeklyOrdinaryHours} from '../../dtJornadaNormativa.js';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const date=value=>{
 if(!validContractDate(value))throw fail('Fecha laboral inválida; usa AAAA-MM-DD del calendario.');
 return value;
};
export async function laborTransaction(admin,operation){
 const db=await pool.getConnection();
 try{
  await db.beginTransaction();
  const result=await operation(db,admin);
  await db.commit();
  return result;
 }catch(e){await db.rollback();throw e;}finally{db.release();}
}
async function getOne(db,sql,params,message){
 const [rows]=await db.execute(sql,params);
 if(!rows.length)throw fail(message,404);
 return rows[0];
}
async function log(db,admin,action,entityType,entityId,details){
 await recordAudit(admin,action,entityType,entityId,details,db);
}
async function event(db,admin,employmentId,kind,effectiveOn,evidenceRef,details={}){
 await db.execute(`INSERT INTO labor_lifecycle_events
  (employment_id,kind,effective_on,evidence_ref,details_json,created_by)
  VALUES(?,?,?,?,?,?)`,[employmentId,kind,date(effectiveOn),evidenceRef,JSON.stringify(details),admin.id]);
}
async function employment(db,id){
 return getOne(db,`SELECT id,employee_id AS employeeId,company_id AS companyId,
  started_on AS startedOn,ended_on AS endedOn,status,review_status AS reviewStatus
  FROM employment_relationships WHERE id=?`,[id],'Relación laboral no encontrada.');
}
function inEmploymentPeriod(relation,on){
 date(on);
 if(on<relation.startedOn || relation.endedOn && on>relation.endedOn)
  throw fail('La fecha queda fuera de la relación laboral.',409);
}
async function requireCatalog(db,table,id,label){
 if(id===null||id===undefined)return;
 const [rows]=await db.execute(`SELECT id FROM ${table} WHERE id=? AND is_active=1`,[id]);
 if(!rows.length)throw fail(label+' no existe o está inactivo.',409);
}

export async function createBranch(db,admin,data){
 await getOne(db,'SELECT id FROM company_profiles WHERE id=? AND is_active=1',[data.companyId],'Empresa no disponible.');
 const [created]=await db.execute(`INSERT INTO company_branches
  (company_id,code,name,address,created_by) VALUES(?,?,?,?,?)`,
  [data.companyId,data.code,data.name,data.address||null,admin.id]);
 await log(db,admin,'create','company_branch',created.insertId,
   {companyId:data.companyId,code:data.code,name:data.name});
 return {id:created.insertId};
}
export async function updateBranch(db,admin,id,data){
 const prev=await getOne(db,'SELECT id,company_id AS companyId,code,name,address,active,revision FROM company_branches WHERE id=?',[id],'Local no encontrado.');
 if(prev.revision!==data.revision)throw fail('El local cambió en otra sesión. Recarga antes de guardar.',409);
 if(!data.active){
  const [future]=await db.execute(`SELECT 1 FROM employment_assignments a JOIN employment_relationships e ON e.id=a.employment_id
  WHERE a.branch_id=? AND (a.valid_until IS NULL OR a.valid_until>date('now')) AND e.status='ACTIVE' LIMIT 1`,[id]);
  if(future.length)throw fail('No desactivar un local con asignaciones laborales vigentes.',409);
 }
 const [updated]=await db.execute(`UPDATE company_branches SET name=?,address=?,active=?,revision=revision+1
  WHERE id=? AND revision=?`,[data.name,data.address||null,data.active?1:0,id,data.revision]);
 if(!updated.affectedRows)throw fail('Conflicto de versión del local.',409);
 await log(db,admin,'update','company_branch',id,{before:prev,after:{...data,companyId:prev.companyId}});
 return {id,revision:data.revision+1};
}

export async function hire(db,admin,data){
 await getOne(db,'SELECT id FROM employees WHERE id=?',[data.employeeId],'Trabajador no encontrado.');
 await getOne(db,'SELECT id FROM company_profiles WHERE id=? AND is_active=1',[data.companyId],'Empresa no disponible.');
 date(data.startedOn);
 const [created]=await db.execute(`INSERT INTO employment_relationships
  (employee_id,company_id,started_on,status,review_status,review_reason,reviewed_by,reviewed_at)
  VALUES(?,?,?,'ACTIVE','CONFIRMED',?,?,CURRENT_TIMESTAMP)`,
  [data.employeeId,data.companyId,data.startedOn,data.evidenceRef,admin.id]);
 await event(db,admin,created.insertId,'HIRE',data.startedOn,data.evidenceRef,
   {employeeId:data.employeeId,companyId:data.companyId});
 await log(db,admin,'hire','employment_relationship',created.insertId,
   {employeeId:data.employeeId,companyId:data.companyId,startedOn:data.startedOn,evidenceRef:data.evidenceRef});
 return {id:created.insertId};
}
export async function finish(db,admin,id,data){
 const relation=await employment(db,id);
 if(relation.status!=='ACTIVE'||relation.endedOn)throw fail('La relación ya terminó o no está activa.',409);
 inEmploymentPeriod(relation,data.endedOn);
 const [future]=await db.execute(`SELECT 1 FROM employment_assignments
  WHERE employment_id=? AND valid_from>? UNION ALL
  SELECT 1 FROM employment_terms_versions WHERE employment_id=? AND effective_from>? UNION ALL
  SELECT 1 FROM employment_shift_versions WHERE employment_id=? AND valid_from>? LIMIT 1`,
  [id,data.endedOn,id,data.endedOn,id,data.endedOn]);
 if(future.length)throw fail('Existen cambios futuros posteriores al término. Revisar antes de finalizar.',409);
 const [marks]=await db.execute(`SELECT 1 FROM attendance_employment_links l
 JOIN attendance_records a ON a.id=l.record_id WHERE l.employment_id=? AND substr(a.registered_at,1,10)>? LIMIT 1`,[id,data.endedOn]);
 if(marks.length)throw fail('Existen marcaciones vinculadas posteriores al término.',409);
 const [updated]=await db.execute(`UPDATE employment_relationships
  SET status='ENDED',ended_on=? WHERE id=? AND status='ACTIVE' AND ended_on IS NULL`,[data.endedOn,id]);
 if(!updated.affectedRows)throw fail('La relación cambió en otra sesión.',409);
 await event(db,admin,id,'END',data.endedOn,data.evidenceRef,{terminationReason:data.reason});
 await log(db,admin,'end','employment_relationship',id,
   {endedOn:data.endedOn,evidenceRef:data.evidenceRef,reason:data.reason});
 return {id,status:'ENDED',endedOn:data.endedOn};
}
export async function assign(db,admin,id,data){
 const relation=await employment(db,id);
 if(relation.reviewStatus!=='CONFIRMED'||relation.status!=='ACTIVE')
  throw fail('La asignación requiere una relación confirmada y activa.',409);
 inEmploymentPeriod(relation,data.validFrom);
 if(data.branchId!==null){
  const branch=await getOne(db,`SELECT id,company_id AS companyId,active
   FROM company_branches WHERE id=?`,[data.branchId],'Local no encontrado.');
  if(branch.companyId!==relation.companyId||!branch.active)throw fail('Local ajeno a la empresa o desactivado.',403);
 }
 await requireCatalog(db,'work_areas',data.areaId,'Área');
 await requireCatalog(db,'work_positions',data.positionId,'Cargo');
 const [current]=await db.execute(`SELECT id,valid_from AS validFrom FROM employment_assignments
  WHERE employment_id=? AND valid_until IS NULL ORDER BY valid_from DESC,id DESC LIMIT 1`,[id]);
 if(current.length){
  if(data.validFrom<=current[0].validFrom)throw fail('La nueva fecha debe ser posterior a la asignación anterior.',409);
  await db.execute('UPDATE employment_assignments SET valid_until=? WHERE id=?',
   [data.validFrom,current[0].id]);
 }
 const [created]=await db.execute(`INSERT INTO employment_assignments
  (employment_id,branch_id,work_area_id,position_id,valid_from,evidence_ref,confirmed_by)
  VALUES(?,?,?,?,?,?,?)`,[id,data.branchId,data.areaId,data.positionId,
   data.validFrom,data.evidenceRef,admin.id]);
 await event(db,admin,id,'ASSIGNMENT',data.validFrom,data.evidenceRef,
  {assignmentId:created.insertId,branchId:data.branchId,areaId:data.areaId,positionId:data.positionId});
 await log(db,admin,'assign','employment_assignment',created.insertId,
  {employmentId:id,validFrom:data.validFrom,branchId:data.branchId,areaId:data.areaId,positionId:data.positionId});
 return {id:created.insertId};
}
export async function setConditions(db,admin,id,data){
 const relation=await employment(db,id);
 if(relation.reviewStatus!=='CONFIRMED'||relation.status!=='ACTIVE')
  throw fail('Las condiciones requieren una relación confirmada y activa.',409);
 inEmploymentPeriod(relation,data.effectiveFrom);
 const normativeAssessment=await assessWeeklyOrdinaryHours(db,{on:data.effectiveFrom,weeklyHours:data.weeklyHours,regime:data.regime});
 const [current]=await db.execute(`SELECT id,effective_from AS effectiveFrom
  FROM employment_terms_versions WHERE employment_id=? AND effective_until IS NULL
  ORDER BY effective_from DESC,id DESC LIMIT 1`,[id]);
 if(current.length){
  if(data.effectiveFrom<=current[0].effectiveFrom)throw fail('La nueva vigencia debe ser posterior a la anterior.',409);
  await db.execute('UPDATE employment_terms_versions SET effective_until=? WHERE id=?',
    [data.effectiveFrom,current[0].id]);
 }
 const [created]=await db.execute(`INSERT INTO employment_terms_versions
  (employment_id,effective_from,monthly_base_salary_clp,weekly_hours,break_minutes,
   terms_snapshot_json,source_document_ref,confirmed_by)
  VALUES(?,?,?,?,?,?,?,?)`,[
  id,data.effectiveFrom,data.monthlyBaseSalaryClp,data.weeklyHours,data.breakMinutes,
  JSON.stringify({contractType:data.contractType||null,regime:data.regime,description:data.description||null}),
  data.evidenceRef,admin.id]);
 await event(db,admin,id,'CONDITIONS',data.effectiveFrom,data.evidenceRef,{termsId:created.insertId});
 await log(db,admin,'conditions','employment_terms',created.insertId,
  {employmentId:id,effectiveFrom:data.effectiveFrom,source:data.evidenceRef,legalStatus:normativeAssessment.status});
 return {id:created.insertId,normativeAssessment};
}
export async function setShift(db,admin,id,data){
 const relation=await employment(db,id);
 if(relation.reviewStatus!=='CONFIRMED'||relation.status!=='ACTIVE')
  throw fail('Turno requiere una relación laboral confirmada y activa.',409);
 inEmploymentPeriod(relation,data.validFrom);
 await getOne(db,'SELECT id FROM work_shifts WHERE id=? AND is_active=1',[data.shiftId],'Horario no disponible.');
 const [current]=await db.execute(`SELECT id,valid_from AS validFrom FROM employment_shift_versions
   WHERE employment_id=? AND valid_until IS NULL ORDER BY valid_from DESC,id DESC LIMIT 1`,[id]);
 if(current.length){
  if(data.validFrom<=current[0].validFrom)throw fail('La nueva vigencia debe comenzar después de la anterior.',409);
  await db.execute('UPDATE employment_shift_versions SET valid_until=? WHERE id=?',[data.validFrom,current[0].id]);
 }
 const [created]=await db.execute(`INSERT INTO employment_shift_versions
  (employment_id,shift_id,valid_from,evidence_ref,confirmed_by) VALUES(?,?,?,?,?)`,
  [id,data.shiftId,data.validFrom,data.evidenceRef,admin.id]);
 await event(db,admin,id,'SHIFT',data.validFrom,data.evidenceRef,{shiftId:data.shiftId,versionId:created.insertId});
 await log(db,admin,'shift','employment_shift_version',created.insertId,
  {employmentId:id,shiftId:data.shiftId,validFrom:data.validFrom});
 return {id:created.insertId};
}
export async function setPrevision(db,admin,employeeId,data){
 await getOne(db,'SELECT id FROM employees WHERE id=?',[employeeId],'Trabajador no encontrado.');
 date(data.validFrom);
 // El historial previsional es de la PERSONA, no se infiere por empresa.
 if(data.afpEntityId!==null){
  const afp=await getOne(db,'SELECT kind FROM labor_entities WHERE id=? AND active=1',
   [data.afpEntityId],'AFP no encontrada.');
  if(afp.kind!=='AFP')throw fail('La institución seleccionada no es AFP.');
 }
 if(data.healthEntityId!==null){
  const health=await getOne(db,'SELECT kind FROM labor_entities WHERE id=? AND active=1',
   [data.healthEntityId],'Salud no encontrada.');
  if(!['FONASA','ISAPRE'].includes(health.kind))throw fail('Institución de salud inválida.');
 }
 const [current]=await db.execute(`SELECT id,valid_from AS validFrom FROM employee_prevision_versions
 WHERE employee_id=? AND valid_until IS NULL ORDER BY valid_from DESC,id DESC LIMIT 1`,[employeeId]);
 if(current.length){
  if(data.validFrom<=current[0].validFrom)throw fail('La nueva previsión debe ser posterior a la anterior.',409);
  await db.execute('UPDATE employee_prevision_versions SET valid_until=? WHERE id=?',[data.validFrom,current[0].id]);
 }
 const [created]=await db.execute(`INSERT INTO employee_prevision_versions
 (employee_id,valid_from,afp_entity_id,health_entity_id,plan_amount_hundredths,plan_unit,source_ref,confirmed_by)
 VALUES(?,?,?,?,?,?,?,?)`,[employeeId,data.validFrom,data.afpEntityId,
 data.healthEntityId,data.planAmountHundredths,data.planUnit,data.evidenceRef,admin.id]);
 await log(db,admin,'prevision','employee_prevision_version',created.insertId,
   {employeeId,validFrom:data.validFrom,source:data.evidenceRef});
 return {id:created.insertId};
}
export async function linkDocument(db,admin,id,data){
 const relation=await employment(db,id);
 const pdf=await getOne(db,`SELECT id,employee_id AS employeeId,sha256
  FROM employee_contract_files WHERE id=?`,[data.fileId],'PDF contractual no encontrado.');
 if(pdf.employeeId!==relation.employeeId)throw fail('El documento es de otra persona.',403);
 date(data.documentDate);
 const [created]=await db.execute(`INSERT INTO employment_documents
 (employment_id,contract_file_id,document_kind,document_date,evidence_ref,linked_by) VALUES(?,?,?,?,?,?)`,
 [id,data.fileId,data.kind,data.documentDate,data.evidenceRef,admin.id]);
 await event(db,admin,id,'DOCUMENT',data.documentDate,data.evidenceRef,
  {fileId:data.fileId,sha256:pdf.sha256,kind:data.kind,documentDate:data.documentDate});
 await log(db,admin,'link','employment_document',created.insertId,
  {employmentId:id,fileId:data.fileId,kind:data.kind,documentDate:data.documentDate,sha256:pdf.sha256});
 return {id:created.insertId};
}
