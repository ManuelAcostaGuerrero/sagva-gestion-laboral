import {Router} from 'express';
import {z} from 'zod';
import {requireAdmin,permitted} from '../auth.js';
import {runMigrations} from '../migrations.js';
import {pool} from '../db.js';
import {asyncHandler} from '../asyncHandler.js';
import {recordAudit} from '../auditLog.js';
import {blankContractTerms} from '../contractTerms.js';
import {assessWeeklyOrdinaryHours} from '../dtJornadaNormativa.js';

export const contractTermsRouter=Router();
contractTermsRouter.use(requireAdmin);
contractTermsRouter.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
contractTermsRouter.use(asyncHandler(async(_req,_res,next)=>{await runMigrations();next();}));
const textField=(limit)=>z.string().trim().max(limit);
const schema=z.object({
 revision:z.number().int().nonnegative(),
 monthlyBaseSalary:z.union([z.number().int().nonnegative(),z.literal('')]),
 gratification:z.enum(['','ART_50','ART_47','OTHER']),
 weeklyHours:z.union([z.number().min(0).max(45),z.literal('')]),
 shiftDistribution:textField(2000),
 shiftPlan:z.array(z.object({day:z.enum(['LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO','DOMINGO']),enabled:z.boolean(),
  shifts:z.array(z.object({id:z.number().int().positive(),name:z.string().max(150),startTime:z.string().max(8),endTime:z.string().max(8)}).strict()).max(100)}).strict()).max(7).refine(rows=>new Set(rows.map(r=>r.day)).size===rows.length).default([]),
 breakMinutes:z.union([z.number().int().min(0).max(240),z.literal('')]),
 workplace:textField(500),paymentMethod:z.enum(['','TRANSFERENCIA','EFECTIVO','MIXTO','CHEQUE','OTRO']),paymentDetails:textField(1000).default(''),
 jobDuties:textField(5000),additionalTerms:textField(2000)
}).strict();
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const idOf=x=>Number.isSafeInteger(Number(x))&&Number(x)>0?Number(x):null;
async function hasContractAccess(req,id,write=false){
 const [files]=await pool.execute("SELECT f.company_id AS companyId,json_extract(f.extra_json,'$.branch') AS branch FROM employees e LEFT JOIN employee_files f ON f.employee_id=e.id WHERE e.id=?",[id]);
 if(!files.length)throw fail('Trabajador no encontrado.',404);
 return permitted(req.admin,write?'personal.contract.write':'personal.contract.read',files[0]);
}
// Consulta informativa, sin guardar ni impedir marcaciones o contratos.
// No da autorización a una jornada especial: exige revisión normativa individual.
contractTermsRouter.get('/jornada/assessment',asyncHandler(async(req,res)=>{
 const on=String(req.query.on||'');
 const regime=String(req.query.regime||'GENERAL');
 const weeklyHours=Number(req.query.weeklyHours);
 if(!['GENERAL','SPECIAL','EXEMPT'].includes(regime)||
    !('weeklyHours' in req.query)||!('on' in req.query))
  throw fail('Indica fecha, jornada semanal y régimen explícito.');
 const assessment=await assessWeeklyOrdinaryHours(pool,{on,weeklyHours,regime});
 res.set('Cache-Control','private, no-store').json(assessment);
}));
contractTermsRouter.get('/workers/:employeeId',asyncHandler(async(req,res)=>{
 const id=idOf(req.params.employeeId);if(!id)throw fail('Trabajador inválido.');
 if(!(await hasContractAccess(req,id)))throw fail('No puedes consultar las condiciones contractuales.',403);
 const [rows]=await pool.execute('SELECT terms_json AS data,revision,updated_at AS updatedAt FROM employee_contract_terms WHERE employee_id=?',[id]);
 res.json({terms:rows.length?{...JSON.parse(rows[0].data),revision:rows[0].revision}:blankContractTerms(),updatedAt:rows[0]?.updatedAt||null});
}));
contractTermsRouter.put('/workers/:employeeId',asyncHandler(async(req,res)=>{
 const id=idOf(req.params.employeeId),parsed=schema.safeParse(req.body);
 if(!id||!parsed.success)throw fail('Revisa sueldo, horas, jornada y condiciones del contrato.');
 if(!(await hasContractAccess(req,id,true)))throw fail('Sin autorización para modificar el contrato.',403);
 const data={...parsed.data};const previousRevision=data.revision;delete data.revision;
 const db=await pool.getConnection();
 try{
  await db.beginTransaction();
  if(!(await db.execute('SELECT id FROM employees WHERE id=?',[id]))[0].length)throw fail('Trabajador no encontrado.',404);
  const [rows]=await db.execute('SELECT revision,terms_json AS termsJson FROM employee_contract_terms WHERE employee_id=?',[id]);
  const current=rows.length?Number(rows[0].revision):0;
  if(previousRevision!==current)throw fail('Las condiciones contractuales cambiaron en otra sesión. Actualiza.',409);
  // Un aumento aplicado desde un anexo firmado no se revierte editando la ficha.
  // Sí se permite actualizar otros campos contractuales conservando exactamente el sueldo.
  const [salaryApprovals]=await db.execute(
   'SELECT entry_id FROM employee_salary_annex_approvals WHERE employee_id=? LIMIT 1',[id]);
  if(salaryApprovals.length){
   const savedSalary=rows.length?JSON.parse(rows[0].termsJson).monthlyBaseSalary:'';
   if(data.monthlyBaseSalary!==savedSalary)
    throw fail('Existe un anexo de sueldo aprobado. Modifica el sueldo mediante un nuevo anexo firmado y aprobado.',409);
  }
  const revision=current+1;
  if(current){
   await db.execute("UPDATE employee_contract_terms SET terms_json=?,revision=?,updated_by=?,updated_at=datetime('now','localtime') WHERE employee_id=?",
    [JSON.stringify(data),revision,req.admin.id,id]);
  }else{
   await db.execute('INSERT INTO employee_contract_terms(employee_id,terms_json,revision,created_by,updated_by) VALUES(?,?,?,?,?)',
    [id,JSON.stringify(data),revision,req.admin.id,req.admin.id]);
  }
  await db.execute('INSERT INTO employee_contract_terms_history(employee_id,revision,snapshot_json,changed_by) VALUES(?,?,?,?)',
    [id,revision,JSON.stringify(data),req.admin.id]);
  await recordAudit(req.admin,current?'update':'create','employee_contract_terms',id,{revision},db);
  await db.commit();res.json({terms:{...data,revision},message:'Condiciones contractuales guardadas con historial.'});
 }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
