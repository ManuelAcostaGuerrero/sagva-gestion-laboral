import {Router} from 'express';
import {z} from 'zod';
import {pool} from '../db.js';
import {runMigrations} from '../migrations.js';
import {requireAdmin} from '../auth.js';
import {permitted} from '../securityPermissions.js';
import {recordAudit} from '../auditLog.js';
import {asyncHandler} from '../asyncHandler.js';
import {calculateBonusPreview} from '../laborBonuses.js';

export const laborBonusesRouter=Router();
laborBonusesRouter.use(requireAdmin);
laborBonusesRouter.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
laborBonusesRouter.use(asyncHandler(async(_req,_res,next)=>{await runMigrations();next();}));
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const idOf=v=>Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):null;
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const definition=z.object({
 code:z.string().trim().regex(/^[A-Z0-9_]{2,40}$/),name:z.string().trim().min(2).max(120),
 kind:z.enum(['BONO','VIATICO','OTRO']),amountClp:z.number().int().min(0).max(100000000),
 taxable:z.boolean(),overtimeBase:z.boolean(),withClause:z.boolean(),
 clauseText:z.string().trim().max(5000),evaluationRules:z.string().trim().max(5000),
 legalReviewed:z.boolean(),active:z.boolean(),
 revision:z.number().int().nonnegative().optional(),
 reason:z.string().trim().min(10).max(500)
}).strict();
const assignmentCreate=z.object({bonusId:z.number().int().positive(),amountOverrideClp:z.number().int().min(0).max(100000000).nullable(),validFrom:date,notes:z.string().trim().max(1000).default('')}).strict();
const assignmentUpdate=z.object({revision:z.number().int().positive(),active:z.boolean(),amountOverrideClp:z.number().int().min(0).max(100000000).nullable(),validFrom:date,notes:z.string().trim().max(1000).optional()}).strict();
const evaluation=z.object({period:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),plannedUnits:z.number().int().min(1).max(366),correctUnits:z.number().int().nonnegative().max(366),evidence:z.string().trim().min(5).max(3000),revision:z.number().int().nonnegative()}).strict().refine(d=>d.correctUnits<=d.plannedUnits,{message:'Los cierres correctos no pueden exceder los previstos.'});
function mayManage(admin){return permitted(admin,'labor.benefits.manage');}
async function workerAccess(req,id,write=false){
 const [rows]=await pool.execute("SELECT f.company_id AS companyId,json_extract(f.extra_json,'$.branch') AS branch FROM employees e LEFT JOIN employee_files f ON f.employee_id=e.id WHERE e.id=?",[id]);
 if(!rows.length)throw fail('Trabajador no encontrado.',404);
 if(!permitted(req.admin,write?'personal.contract.write':'personal.contract.read',rows[0]))throw fail('Sin autorización contractual para este trabajador.',403);
}
const readFields='id,code,name,kind,amount_clp AS amountClp,taxable,overtime_base AS overtimeBase,with_clause AS withClause,clause_text AS clauseText,evaluation_rules AS evaluationRules,legal_reviewed AS legalReviewed,active,revision';
const asBool=row=>({...row,taxable:!!row.taxable,overtimeBase:!!row.overtimeBase,withClause:!!row.withClause,legalReviewed:!!row.legalReviewed,active:!!row.active});
laborBonusesRouter.get('/catalog',asyncHandler(async(req,res)=>{
 if(!permitted(req.admin,'labor.catalog.read'))throw fail('Sin acceso al catálogo.',403);
 const [rows]=await pool.execute('SELECT '+readFields+' FROM labor_bonus_definitions ORDER BY active DESC,kind,name');
 res.json({bonuses:rows.map(asBool),canManage:mayManage(req.admin)});
}));
laborBonusesRouter.post('/catalog',asyncHandler(async(req,res)=>{
 if(!mayManage(req.admin))throw fail('Solo un usuario autorizado configura bonos.',403);
 const p=definition.safeParse(req.body);if(!p.success)throw fail('Revisa el bono, monto, clasificación y motivo.');
 const d=p.data,db=await pool.getConnection();
 try {
  await db.beginTransaction();
  const [exists]=await db.execute('SELECT id FROM labor_bonus_definitions WHERE code=?',[d.code]);
  if(exists.length)throw fail('Código del bono ya registrado.',409);
  const [r]=await db.execute('INSERT INTO labor_bonus_definitions(code,name,kind,amount_clp,taxable,overtime_base,with_clause,clause_text,evaluation_rules,legal_reviewed,active,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
   [d.code,d.name,d.kind,d.amountClp,d.taxable?1:0,d.overtimeBase?1:0,d.withClause?1:0,d.clauseText,d.evaluationRules,d.legalReviewed?1:0,d.active?1:0,req.admin.id]);
  await db.execute('INSERT INTO labor_bonus_definition_history(bonus_id,revision,snapshot_json,changed_by) VALUES(?,?,?,?)',[r.insertId,1,JSON.stringify(d),req.admin.id]);
  await recordAudit(req.admin,'create','labor_bonus_definition',r.insertId,{code:d.code,revision:1,reason:d.reason},db);
  await db.commit();res.status(201).json({id:r.insertId,message:'Concepto de pago registrado con historial.'});
 }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
laborBonusesRouter.put('/catalog/:id',asyncHandler(async(req,res)=>{
 if(!mayManage(req.admin))throw fail('Sin autorización para configurar bonos.',403);
 const id=idOf(req.params.id),p=definition.safeParse(req.body);
 if(!id||!p.success||!p.data.revision)throw fail('Revisa versión, campos y motivo.');
 const d=p.data,db=await pool.getConnection();
 try{
  await db.beginTransaction();
  const [before]=await db.execute('SELECT id,revision FROM labor_bonus_definitions WHERE id=?',[id]);
  if(!before.length)throw fail('Bono no encontrado.',404);
  if(before[0].revision!==d.revision)throw fail('El bono cambió en otra sesión.',409);
  const [duplicate]=await db.execute('SELECT id FROM labor_bonus_definitions WHERE code=? AND id<>?',[d.code,id]);
  if(duplicate.length)throw fail('Código duplicado.',409);
  await db.execute('UPDATE labor_bonus_definitions SET code=?,name=?,kind=?,amount_clp=?,taxable=?,overtime_base=?,with_clause=?,clause_text=?,evaluation_rules=?,legal_reviewed=?,active=?,revision=revision+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',
   [d.code,d.name,d.kind,d.amountClp,d.taxable?1:0,d.overtimeBase?1:0,d.withClause?1:0,d.clauseText,d.evaluationRules,d.legalReviewed?1:0,d.active?1:0,req.admin.id,id]);
  await db.execute('INSERT INTO labor_bonus_definition_history(bonus_id,revision,snapshot_json,changed_by) VALUES(?,?,?,?)',[id,d.revision+1,JSON.stringify(d),req.admin.id]);
  await recordAudit(req.admin,'update','labor_bonus_definition',id,{revision:d.revision+1,reason:d.reason},db);
  await db.commit();res.json({message:'Bono actualizado. La versión histórica se conserva.'});
 }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
laborBonusesRouter.get('/workers/:id',asyncHandler(async(req,res)=>{
 const id=idOf(req.params.id);if(!id)throw fail('Trabajador inválido.');
 await workerAccess(req,id);
 const [rows]=await pool.execute('SELECT a.id,a.bonus_id AS bonusId,a.amount_override_clp AS amountOverrideClp,a.valid_from AS validFrom,a.notes AS notes,a.active,a.revision,b.code,b.name,b.kind,b.amount_clp AS amountClp,b.taxable,b.overtime_base AS overtimeBase,b.with_clause AS withClause,b.clause_text AS clauseText,b.evaluation_rules AS evaluationRules,b.legal_reviewed AS legalReviewed,b.active AS catalogActive FROM employee_bonus_assignments a JOIN labor_bonus_definitions b ON b.id=a.bonus_id WHERE a.employee_id=? ORDER BY a.active DESC,b.name',[id]);
 const [evals]=await pool.execute("SELECT e.id,e.assignment_id AS assignmentId,e.period,e.planned_units AS plannedUnits,e.correct_units AS correctUnits,e.suggested_clp AS suggestedClp,e.evidence,e.status,e.revision,e.evaluated_at AS evaluatedAt FROM employee_bonus_evaluations e JOIN employee_bonus_assignments a ON a.id=e.assignment_id WHERE a.employee_id=? ORDER BY e.period DESC,e.id DESC",[id]);
 res.json({assignments:rows.map(r=>({...asBool(r),catalogActive:!!r.catalogActive})),evaluations:evals});
}));
laborBonusesRouter.post('/workers/:id/assignments',asyncHandler(async(req,res)=>{
 const id=idOf(req.params.id),p=assignmentCreate.safeParse(req.body);
 if(!id||!p.success)throw fail('Asignación de bono inválida.');
 await workerAccess(req,id,true);
 const d=p.data,db=await pool.getConnection();
 try{
  await db.beginTransaction();
  const [b]=await db.execute('SELECT id,active FROM labor_bonus_definitions WHERE id=?',[d.bonusId]);
  if(!b[0]?.active)throw fail('El concepto no está activo.',409);
  if((await db.execute('SELECT id FROM employee_bonus_assignments WHERE employee_id=? AND bonus_id=?',[id,d.bonusId]))[0].length)throw fail('Bono ya asignado: edita su asignación.',409);
  const [r]=await db.execute('INSERT INTO employee_bonus_assignments(employee_id,bonus_id,amount_override_clp,valid_from,notes,updated_by) VALUES(?,?,?,?,?,?)',[id,d.bonusId,d.amountOverrideClp,d.validFrom,d.notes,req.admin.id]);
  await db.execute('INSERT INTO employee_bonus_assignment_history(assignment_id,revision,snapshot_json,changed_by) VALUES(?,?,?,?)',[r.insertId,1,JSON.stringify(d),req.admin.id]);
  await recordAudit(req.admin,'create','employee_bonus_assignment',r.insertId,{employeeId:id,bonusId:d.bonusId},db);
  await db.commit();res.status(201).json({id:r.insertId,message:'Bono vinculado al trabajador.'});
 }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
laborBonusesRouter.put('/workers/:id/assignments/:assignmentId',asyncHandler(async(req,res)=>{
 const id=idOf(req.params.id),aid=idOf(req.params.assignmentId),p=assignmentUpdate.safeParse(req.body);
 if(!id||!aid||!p.success)throw fail('Asignación inválida.');
 await workerAccess(req,id,true);const d=p.data,db=await pool.getConnection();
 try{
  await db.beginTransaction();
  const [rows]=await db.execute('SELECT revision,notes FROM employee_bonus_assignments WHERE id=? AND employee_id=?',[aid,id]);
  if(!rows.length)throw fail('Asignación no encontrada.',404);
  if(rows[0].revision!==d.revision)throw fail('Asignación modificada en otra sesión.',409);
  await db.execute('UPDATE employee_bonus_assignments SET amount_override_clp=?,valid_from=?,active=?,notes=?,revision=revision+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[d.amountOverrideClp,d.validFrom,d.active?1:0,d.notes??rows[0].notes,req.admin.id,aid]);
  await db.execute('INSERT INTO employee_bonus_assignment_history(assignment_id,revision,snapshot_json,changed_by) VALUES(?,?,?,?)',[aid,d.revision+1,JSON.stringify({...d,notes:d.notes??rows[0].notes}),req.admin.id]);
  await recordAudit(req.admin,'update','employee_bonus_assignment',aid,{employeeId:id,revision:d.revision+1},db);
  await db.commit();res.json({message:'Asignación actualizada con historial.'});
 }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
laborBonusesRouter.post('/workers/:id/assignments/:assignmentId/evaluations',asyncHandler(async(req,res)=>{
 const id=idOf(req.params.id),aid=idOf(req.params.assignmentId),p=evaluation.safeParse(req.body);
 if(!id||!aid||!p.success)throw fail('Revisa periodo, cierres correctos y evidencia.');
 await workerAccess(req,id,true);const d=p.data,db=await pool.getConnection();
 try{
  await db.beginTransaction();
  const [a]=await db.execute('SELECT a.*,b.name,b.code,b.amount_clp AS amountClp,b.clause_text AS clauseText,b.evaluation_rules AS evaluationRules,b.revision AS bonusRevision FROM employee_bonus_assignments a JOIN labor_bonus_definitions b ON b.id=a.bonus_id WHERE a.id=? AND a.employee_id=?',[aid,id]);
  if(!a.length||!a[0].active)throw fail('La asignación no está activa.',409);
  const base=a[0].amount_override_clp??a[0].amountClp;
  const suggested=calculateBonusPreview(base,d.plannedUnits,d.correctUnits);
  const snapshot=JSON.stringify({code:a[0].code,name:a[0].name,amountClp:base,bonusRevision:a[0].bonusRevision,clause:a[0].clauseText,rules:a[0].evaluationRules});
  const [old]=await db.execute('SELECT id,revision FROM employee_bonus_evaluations WHERE assignment_id=? AND period=?',[aid,d.period]);
  const prev=old[0]?.revision||0;
  if(prev!==d.revision)throw fail('La evaluación fue modificada en otra sesión.',409);
  let evalId;
  if(old.length){
   evalId=old[0].id;
   await db.execute('UPDATE employee_bonus_evaluations SET planned_units=?,correct_units=?,suggested_clp=?,evidence=?,bonus_snapshot_json=?,revision=revision+1,evaluated_by=?,evaluated_at=CURRENT_TIMESTAMP WHERE id=?',
    [d.plannedUnits,d.correctUnits,suggested,d.evidence,snapshot,req.admin.id,evalId]);
  }else{
   const [r]=await db.execute("INSERT INTO employee_bonus_evaluations(assignment_id,period,planned_units,correct_units,suggested_clp,evidence,bonus_snapshot_json,evaluated_by) VALUES(?,?,?,?,?,?,?,?)",[aid,d.period,d.plannedUnits,d.correctUnits,suggested,d.evidence,snapshot,req.admin.id]);evalId=r.insertId;
  }
  await db.execute('INSERT INTO employee_bonus_evaluation_history(evaluation_id,revision,snapshot_json,changed_by) VALUES(?,?,?,?)',[evalId,prev+1,JSON.stringify({...d,suggestedClp:suggested,bonusSnapshot:JSON.parse(snapshot)}),req.admin.id]);
  await recordAudit(req.admin,'evaluate','employee_bonus_evaluation',evalId,{employeeId:id,assignmentId:aid,period:d.period,revision:prev+1},db);
  await db.commit();res.json({id:evalId,suggestedClp:suggested,status:'PENDIENTE_REVISION',revision:prev+1,message:'Simulación de bono guardada. No modifica remuneraciones.'});
 }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
