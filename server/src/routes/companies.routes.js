import {Router} from 'express';
import {z} from 'zod';
import {requireRoles} from '../auth.js';
import {asyncHandler} from '../asyncHandler.js';
import {runMigrations} from '../migrations.js';
import {pool} from '../db.js';
import {recordAudit} from '../auditLog.js';
import {companyPayload} from '../companyProfiles.js';

export const companiesRouter=Router();
companiesRouter.use(requireRoles('admin','supervisor','operator'));
companiesRouter.use(asyncHandler(async(_req,_res,next)=>{await runMigrations();next();}));
const maybe=z.string().trim().max(250).nullish();
const schema=z.object({
  legalName:z.string().trim().min(1).max(250),taxId:maybe,tradeName:maybe,
  address:maybe,commune:maybe,email:maybe,phone:maybe,
  representativeName:maybe,representativeRut:maybe,defaultBranch:maybe,
  defaultAreaId:z.union([z.number().int().positive(),z.literal(''),z.null()]).optional(),
  defaultPositionName:maybe,
  defaultSchedule:z.enum(['','FULL_TIME','PART_TIME','PEAK_TIME']).nullish(),
  revision:z.number().int().nonnegative().optional()
});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const viewSql=`SELECT id, legal_name AS legalName,tax_id AS taxId,trade_name AS tradeName,
 address,commune,email,phone,representative_name AS representativeName,
 representative_rut AS representativeRut,default_branch AS defaultBranch,
 default_area_id AS defaultAreaId,default_position_name AS defaultPositionName,
 default_schedule AS defaultSchedule,is_active AS isActive,revision,
 updated_at AS updatedAt FROM company_profiles`;
companiesRouter.get('/',asyncHandler(async(req,res)=>{
 const [rows]=await pool.execute(viewSql+' ORDER BY is_active DESC,legal_name');
 const list=rows.filter(row=>row.isActive||req.admin.role==='admin');
 const companies=req.admin.role==='admin'?list:list.map(({id,legalName,tradeName,defaultBranch,defaultAreaId,defaultPositionName,defaultSchedule,isActive})=>
   ({id,legalName,tradeName,defaultBranch,defaultAreaId,defaultPositionName,defaultSchedule,isActive}));
 res.json({companies});
}));
companiesRouter.post('/',requireRoles('admin'),asyncHandler(async(req,res)=>{
 const parsed=schema.safeParse(req.body);
 if(!parsed.success)throw fail('Revisa los datos y el formato de la empresa.');
 const data=companyPayload(parsed.data);
 const db=await pool.getConnection();
 try {
  await db.beginTransaction();
  if(data.defaultAreaId){
   const [a]=await db.execute('SELECT id FROM work_areas WHERE id=? AND is_active=1',[data.defaultAreaId]);
   if(!a.length)throw fail('El área predeterminada no está activa.');
  }
  const [found]=await db.execute('SELECT id FROM company_profiles WHERE legal_name=?',[data.legalName]);
  if(found.length)throw fail('La empresa ya está registrada.',409);
  if(data.taxId && (await db.execute("SELECT id FROM company_profiles WHERE upper(replace(replace(tax_id,'.',''),'-',''))=upper(replace(replace(?,'.',''),'-',''))",[data.taxId]))[0].length)
   throw fail('Este RUT ya pertenece a una empresa.',409);
  const fields=['legalName','taxId','tradeName','address','commune','email','phone','representativeName','representativeRut','defaultBranch','defaultAreaId','defaultPositionName','defaultSchedule'];
  const cols=['legal_name','tax_id','trade_name','address','commune','email','phone','representative_name','representative_rut','default_branch','default_area_id','default_position_name','default_schedule'];
  const [r]=await db.execute('INSERT INTO company_profiles('+cols.join(',')+',updated_by) VALUES('+fields.map(()=>'?').join(',')+',?)',
    [...fields.map(f=>data[f]),req.admin.id]);
  await recordAudit(req.admin,'create','company_profile',r.insertId,{fields:fields.filter(f=>data[f]!=null)},db);
  await db.commit();
  res.status(201).json({id:r.insertId,message:'Empresa creada.'});
 }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
companiesRouter.put('/:id',requireRoles('admin'),asyncHandler(async(req,res)=>{
 const id=Number(req.params.id),parsed=schema.safeParse(req.body);
 if(!Number.isSafeInteger(id)||id<1||!parsed.success)throw fail('Revisa los datos de la empresa.');
 const data=companyPayload(parsed.data);
 const db=await pool.getConnection();
 try {
  await db.beginTransaction();
  const [existing]=await db.execute('SELECT revision FROM company_profiles WHERE id=?',[id]);
  if(!existing.length)throw fail('Empresa no encontrada.',404);
  if(parsed.data.revision!==Number(existing[0].revision))throw fail('Esta empresa fue modificada en otra sesión. Actualiza antes de guardar.',409);
  if((await db.execute('SELECT id FROM company_profiles WHERE legal_name=? AND id<>?',[data.legalName,id]))[0].length)throw fail('Ya existe una empresa con esa razón social.',409);
  if(data.taxId && (await db.execute("SELECT id FROM company_profiles WHERE upper(replace(replace(tax_id,'.',''),'-',''))=upper(replace(replace(?,'.',''),'-','')) AND id<>?",[data.taxId,id]))[0].length)
   throw fail('Este RUT ya pertenece a otra empresa.',409);
  const pairs=[['legal_name','legalName'],['tax_id','taxId'],['trade_name','tradeName'],['address','address'],['commune','commune'],['email','email'],['phone','phone'],['representative_name','representativeName'],['representative_rut','representativeRut'],['default_branch','defaultBranch'],['default_area_id','defaultAreaId'],['default_position_name','defaultPositionName'],['default_schedule','defaultSchedule']];
  if(data.defaultAreaId && !(await db.execute('SELECT id FROM work_areas WHERE id=? AND is_active=1',[data.defaultAreaId]))[0].length)
   throw fail('El área predeterminada no está activa.');
  const [result]=await db.execute('UPDATE company_profiles SET '+pairs.map(([db])=>db+'=?').join(',')+",revision=revision+1,updated_by=?,updated_at=datetime('now','localtime') WHERE id=? AND revision=?",
  [...pairs.map(([,key])=>data[key]),req.admin.id,id,parsed.data.revision]);
  if(!result.affectedRows)throw fail('La empresa fue modificada por otro usuario.',409);
  await recordAudit(req.admin,'update','company_profile',id,{revision:parsed.data.revision+1},db);
  await db.commit();res.json({message:'Empresa actualizada sin modificar fichas históricas.'});
 }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
