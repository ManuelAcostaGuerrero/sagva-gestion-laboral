import {Router} from 'express';
import {z} from 'zod';
import {requireRoles} from '../auth.js';
import {runMigrations} from '../migrations.js';
import {pool} from '../db.js';
import {asyncHandler} from '../asyncHandler.js';
import {recordAudit} from '../auditLog.js';
import {blankContractTerms} from '../contractTerms.js';
import {validContractDate} from '../employeeContracts.js';

export const contractTermsRouter=Router();
contractTermsRouter.use(requireRoles('admin','supervisor'));
contractTermsRouter.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
contractTermsRouter.use(asyncHandler(async(_req,_res,next)=>{await runMigrations();next();}));
const textField=(limit)=>z.string().trim().max(limit);
const bonus=z.object({
 uid:z.string().uuid(),typeId:z.number().int().positive(),
 amountClp:z.number().int().positive().max(100000000000),
 periodicity:z.enum(['MENSUAL','UNICO']),
 hasClauses:z.boolean(),active:z.boolean(),
 validFrom:z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/),z.literal('')])
}).strict();

const schema=z.object({
 revision:z.number().int().nonnegative(),
 monthlyBaseSalary:z.union([z.number().int().nonnegative(),z.literal('')]),
 gratification:z.enum(['','ART_50','ART_47','OTHER']),
 weeklyHours:z.union([z.number().min(0).max(45),z.literal('')]),
 shiftDistribution:textField(2000),breakMinutes:z.union([z.number().int().min(0).max(240),z.literal('')]),
 workplace:textField(500),paymentMethod:z.enum(['','TRANSFERENCIA','EFECTIVO','CHEQUE','OTRO']),
 jobDuties:textField(5000),additionalTerms:textField(2000),
 bonuses:z.array(bonus).max(20).optional()
}).strict();
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const idOf=x=>Number.isSafeInteger(Number(x))&&Number(x)>0?Number(x):null;
contractTermsRouter.get('/workers/:employeeId',asyncHandler(async(req,res)=>{
 const id=idOf(req.params.employeeId);if(!id)throw fail('Trabajador inválido.');
 if(!(await pool.execute('SELECT id FROM employees WHERE id=?',[id]))[0].length)throw fail('Trabajador no encontrado.',404);
 const [rows]=await pool.execute('SELECT terms_json AS data,revision,updated_at AS updatedAt FROM employee_contract_terms WHERE employee_id=?',[id]);
 res.json({terms:rows.length?{...blankContractTerms(),...JSON.parse(rows[0].data),revision:rows[0].revision}:blankContractTerms(),updatedAt:rows[0]?.updatedAt||null});
}));
contractTermsRouter.put('/workers/:employeeId',asyncHandler(async(req,res)=>{
 const id=idOf(req.params.employeeId),parsed=schema.safeParse(req.body);
 if(!id||!parsed.success)throw fail('Revisa sueldo, horas, jornada y condiciones del contrato.');
 const data={...parsed.data};const previousRevision=data.revision;delete data.revision;
 const db=await pool.getConnection();
 try{
  await db.beginTransaction();
  if(!(await db.execute('SELECT id FROM employees WHERE id=?',[id]))[0].length)throw fail('Trabajador no encontrado.',404);
  const [rows]=await db.execute('SELECT revision,terms_json AS termsJson FROM employee_contract_terms WHERE employee_id=?',[id]);
  const current=rows.length?Number(rows[0].revision):0;
  const oldBonuses=rows.length?(JSON.parse(rows[0].termsJson).bonuses||[]):[];
  // Clientes anteriores no incluyen el campo: conservar asignaciones guardadas.
  if(data.bonuses===undefined)data.bonuses=oldBonuses;
  const bonusIds=data.bonuses.map(x=>x.uid);
  if(new Set(bonusIds).size!==bonusIds.length)throw fail('Identificadores de bonos duplicados.');
  if(oldBonuses.some(x=>!bonusIds.includes(x.uid)))throw fail('No borres bonos históricos; desactívalos.');
  const [types]=await db.execute('SELECT id,active FROM labor_bonus_types');
  const allowedTypes=new Map(types.map(x=>[Number(x.id),!!x.active]));
  for(const item of data.bonuses){
   if(!allowedTypes.has(item.typeId))throw fail('Tipo de bono no registrado.');
   if(!allowedTypes.get(item.typeId)&&!oldBonuses.some(x=>x.uid===item.uid&&x.typeId===item.typeId))
    throw fail('El tipo de bono está inactivo.');
   if(item.validFrom&&!validContractDate(item.validFrom))throw fail('Fecha de vigencia del bono inválida.');
  }
  if(previousRevision!==current)throw fail('Las condiciones contractuales cambiaron en otra sesión. Actualiza.',409);
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
