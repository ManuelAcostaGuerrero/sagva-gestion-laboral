import {Router} from 'express';
import {z} from 'zod';
import {pool} from '../db.js';
import {runMigrations} from '../migrations.js';
import {requireAdmin} from '../auth.js';
import {permitted} from '../securityPermissions.js';
import {recordAudit} from '../auditLog.js';
import {asyncHandler} from '../asyncHandler.js';
import {normalizeWorkLabel} from '../workPositions.js';

export const jobDutiesRouter=Router();
jobDutiesRouter.use(requireAdmin);
jobDutiesRouter.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
jobDutiesRouter.use(asyncHandler(async(_req,_res,next)=>{await runMigrations();next();}));
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const schema=z.object({
 areaId:z.number().int().positive(),positionName:z.string().trim().min(2).max(100),
 duties:z.string().trim().max(5000),revision:z.number().int().nonnegative(),
 reason:z.string().trim().min(10).max(500)
}).strict();
jobDutiesRouter.get('/',asyncHandler(async(req,res)=>{
 if(!permitted(req.admin,'labor.catalog.read')&&!permitted(req.admin,'personal.contract.read'))throw fail('Sin acceso a funciones de cargo.',403);
 const [rows]=await pool.execute('SELECT t.id,t.area_id AS areaId,a.name AS areaName,t.position_name AS positionName,t.duties,t.revision,t.updated_at AS updatedAt FROM labor_job_duty_templates t JOIN work_areas a ON a.id=t.area_id ORDER BY a.name,t.position_name');
 res.json({templates:rows,canManage:permitted(req.admin,'labor.fields.manage')});
}));
jobDutiesRouter.put('/',asyncHandler(async(req,res)=>{
 if(!permitted(req.admin,'labor.fields.manage'))throw fail('Configurar funciones de cargo requiere permiso Root o específico.',403);
 const p=schema.safeParse(req.body);if(!p.success)throw fail('Verifica área, cargo, funciones, versión y motivo.');
 const d=p.data,name=normalizeWorkLabel(d.positionName),db=await pool.getConnection();
 try{
  await db.beginTransaction();
  if(!(await db.execute('SELECT id FROM work_areas WHERE id=?',[d.areaId]))[0].length)throw fail('Área inexistente.',404);
  if(!(await db.execute('SELECT id FROM work_positions WHERE name=?',[name]))[0].length)throw fail('Cargo inexistente.',404);
  const [old]=await db.execute('SELECT id,revision FROM labor_job_duty_templates WHERE area_id=? AND position_name=?',[d.areaId,name]);
  const revision=old[0]?.revision||0;
  if(revision!==d.revision)throw fail('Las funciones cambiaron en otra sesión.',409);
  let id=old[0]?.id;
  if(old.length)await db.execute('UPDATE labor_job_duty_templates SET duties=?,revision=revision+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[d.duties,req.admin.id,id]);
  else{
   const [r]=await db.execute('INSERT INTO labor_job_duty_templates(area_id,position_name,duties,updated_by) VALUES(?,?,?,?)',[d.areaId,name,d.duties,req.admin.id]);id=r.insertId;
  }
  await db.execute('INSERT INTO labor_job_duty_history(template_id,revision,duties,reason,changed_by) VALUES(?,?,?,?,?)',[id,revision+1,d.duties,d.reason,req.admin.id]);
  await recordAudit(req.admin,old.length?'update':'create','labor_job_duty_template',id,{areaId:d.areaId,positionName:name,revision:revision+1,reason:d.reason},db);
  await db.commit();res.json({id,revision:revision+1,message:'Funciones guardadas. Los contratos históricos no se modifican.'});
 }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
