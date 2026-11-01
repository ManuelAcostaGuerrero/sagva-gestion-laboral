import {Router} from 'express';
import {z} from 'zod';
import {pool} from '../db.js';
import {requireAdmin} from '../auth.js';
import {asyncHandler} from '../asyncHandler.js';
import {recordAudit} from '../auditLog.js';
import {normalizeWorkLabel} from '../workPositions.js';
export const positionsRouter=Router();
positionsRouter.use(requireAdmin);
const schema=z.object({name:z.string().trim().min(2).max(100),description:z.string().trim().max(255).optional().or(z.literal(''))});
const deactivation=z.object({reason:z.string().trim().min(5).max(255)});
const idOf=x=>Number.isSafeInteger(Number(x))&&Number(x)>0?Number(x):null;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
positionsRouter.get('/',asyncHandler(async(req,res)=>{
 const includeInactive=['1','true'].includes(req.query.includeInactive);
 const [rows]=await pool.execute(`SELECT p.id,p.name,p.description,p.is_active AS isActive,p.deactivation_reason AS deactivationReason,
 COUNT(e.id) AS employeeCount FROM work_positions p LEFT JOIN employees e ON e.position_name=p.name AND e.is_active=1
 WHERE (?=1 OR p.is_active=1) GROUP BY p.id ORDER BY p.is_active DESC,p.name`,[includeInactive?1:0]);
 res.json({positions:rows.map(p=>({...p,isActive:!!p.isActive,employeeCount:Number(p.employeeCount||0)}))});
}));
positionsRouter.post('/',asyncHandler(async(req,res)=>{
 const data=schema.safeParse(req.body);
 if(!data.success)throw fail('Nombre de cargo inválido.');
 const name=normalizeWorkLabel(data.data.name);
 if((await pool.execute('SELECT id FROM work_positions WHERE name=?',[name]))[0].length)throw fail('El cargo ya existe.',409);
 const [r]=await pool.execute('INSERT INTO work_positions(name,description,created_by) VALUES(?,?,?)',[name,data.data.description||null,req.admin.id]);
 await recordAudit(req.admin,'create','work_position',r.insertId,{name});
 res.status(201).json({id:r.insertId,name});
}));
positionsRouter.put('/:id',asyncHandler(async(req,res)=>{
 const id=idOf(req.params.id),data=schema.safeParse(req.body);
 if(!id||!data.success)throw fail('Cargo inválido.');
 const name=normalizeWorkLabel(data.data.name),db=await pool.getConnection();
 try {
  await db.beginTransaction();
  const [before]=await db.execute('SELECT id,name,description FROM work_positions WHERE id=?',[id]);
  if(!before.length)throw fail('Cargo no encontrado.',404);
  if((await db.execute('SELECT id FROM work_positions WHERE name=? AND id<>?',[name,id]))[0].length)throw fail('El cargo ya existe.',409);
  const [count]=await db.execute('SELECT COUNT(*) AS n FROM employees WHERE position_name=?',[before[0].name]);
  await db.execute('UPDATE work_positions SET name=?,description=? WHERE id=?',[name,data.data.description||null,id]);
  if(name!==before[0].name)await db.execute('UPDATE employees SET position_name=? WHERE position_name=?',[name,before[0].name]);
  await recordAudit(req.admin,'update','work_position',id,{before:before[0],name,affectedEmployees:name===before[0].name?0:count[0].n},db);
  await db.commit();
 } catch(e){await db.rollback();throw e}finally{db.release()}
 res.json({message:'Cargo actualizado'});
}));

positionsRouter.delete('/:id/permanent',asyncHandler(async(req,res)=>{
 const id=idOf(req.params.id);
 if(!id) return res.status(400).json({message:'Cargo inválido.'});
 const db=await pool.getConnection();
 try {
  await db.beginTransaction();
  const [found]=await db.execute('SELECT id,name,description,is_active AS isActive FROM work_positions WHERE id=?',[id]);
  if(!found.length) return res.status(404).json({message:'Cargo no encontrado.'});
  const [assignedEmployees]=await db.execute(
    'SELECT id,full_name AS fullName,document_id AS documentId,is_active AS isActive FROM employees WHERE position_name=? ORDER BY is_active DESC,full_name',
    [found[0].name]
  );
  if(assignedEmployees.length)
    return res.status(409).json({
      message:`No se puede eliminar el cargo ${found[0].name}: tiene ${assignedEmployees.length} trabajador(es) asignado(s). Retira el cargo en sus fichas.`,
      assignedEmployees:assignedEmployees.map(employee=>({...employee,isActive:!!employee.isActive}))
    });
  await db.execute('DELETE FROM work_positions WHERE id=?',[id]);
  await recordAudit(req.admin,'delete','work_position',id,{position:found[0]},db);
  await db.commit();
  return res.json({message:'Cargo eliminado definitivamente.'});
 } catch(error) {throw error} finally {db.release();}
}));

positionsRouter.delete('/:id',asyncHandler(async(req,res)=>{
 const id=idOf(req.params.id),data=deactivation.safeParse(req.body||{});
 if(!id||!data.success)throw fail('Indica un motivo de desactivación de al menos 5 caracteres.');
 const [r]=await pool.execute(`UPDATE work_positions SET is_active=0,deactivated_at=datetime('now','localtime'),deactivated_by=?,deactivation_reason=?
 WHERE id=? AND is_active=1`,[req.admin.id,data.data.reason,id]);
 if(!r.affectedRows)throw fail('Cargo no encontrado o ya desactivado.',404);
 await recordAudit(req.admin,'deactivate','work_position',id,{reason:data.data.reason});
 res.json({message:'Cargo desactivado sin perder las asignaciones'});
}));
positionsRouter.post('/:id/reactivate',asyncHandler(async(req,res)=>{
 const id=idOf(req.params.id);if(!id)throw fail('Cargo inválido.');
 const [r]=await pool.execute('UPDATE work_positions SET is_active=1,deactivated_at=NULL,deactivated_by=NULL,deactivation_reason=NULL WHERE id=? AND is_active=0',[id]);
 if(!r.affectedRows)throw fail('Cargo no encontrado o ya activo.',404);
 await recordAudit(req.admin,'reactivate','work_position',id);
 res.json({message:'Cargo reactivado'});
}));