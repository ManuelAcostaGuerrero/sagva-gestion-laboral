import {Router} from 'express';
import {z} from 'zod';
import {pool} from '../db.js';
import {requireAdmin,permitted,requirePermission} from '../auth.js';
import {runMigrations} from '../migrations.js';
import {asyncHandler} from '../asyncHandler.js';
import {recordAudit} from '../auditLog.js';
import {fieldPublic,validFieldValue} from '../laborFields.js';

export const laborFieldsRouter=Router();
laborFieldsRouter.use(requireAdmin);
laborFieldsRouter.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
laborFieldsRouter.use(asyncHandler(async(_req,_res,next)=>{await runMigrations();next();}));
const fail=(msg,status=400)=>Object.assign(new Error(msg),{status});
const idOf=v=>Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):null;
const options=z.array(z.string().trim().min(1).max(100)).max(30);
const create=z.object({
 code:z.string().regex(/^EXT_[A-Z0-9_]{2,36}$/),
 label:z.string().trim().min(2).max(120),
 target:z.enum(['FICHA','CONTRATO']),
 type:z.enum(['TEXT','NUMBER','DATE','BOOLEAN','SELECT']),
 required:z.boolean(),options,reason:z.string().trim().min(10).max(500)
}).strict();
const edit=z.object({
 label:z.string().trim().min(2).max(120),
 required:z.boolean(),active:z.boolean(),options,
 revision:z.number().int().positive(),reason:z.string().trim().min(10).max(500)
}).strict();
const targetSchema=z.enum(['FICHA','CONTRATO']);
const valueSchema=z.object({
 target:targetSchema,
 values:z.array(z.object({fieldId:z.number().int().positive(),value:z.union([
  z.string().max(400),z.number().finite(),z.boolean(),z.null()
 ]),revision:z.number().int().nonnegative()}).strict()).min(1).max(40)
}).strict();
const fromSql=rows=>rows.map(fieldPublic);
function checkOptions(type,opts){
 if(type==='SELECT'&&(opts.length<2||new Set(opts).size!==opts.length))throw fail('Las listas requieren dos o más opciones únicas.');
 if(type!=='SELECT'&&opts.length)throw fail('Las opciones solo corresponden a listas de selección.');
}
async function worker(db,id){
 const [rows]=await db.execute("SELECT e.id,f.company_id AS companyId,json_extract(f.extra_json,'$.branch') AS branch FROM employees e LEFT JOIN employee_files f ON f.employee_id=e.id WHERE e.id=?",[id]);
 if(!rows.length)throw fail('Trabajador no encontrado.',404);
 return rows[0];
}
function requiredPermission(target,write=false){return target==='CONTRATO'?'personal.contract.'+(write?'write':'read'):'personal.file.'+(write?'write':'read');}
function canField(admin,field,write,scope){
 return permitted(admin,'custom_field.'+field.code+'.'+(write?'write':'read'),scope)||
    (!write&&permitted(admin,'custom_field.'+field.code+'.write',scope));
}
laborFieldsRouter.get('/definitions',requirePermission('labor.catalog.read'),asyncHandler(async(req,res)=>{
 const target=targetSchema.safeParse(req.query.target);
 if(req.query.target!==undefined&&!target.success)throw fail('Destino inválido.');
 const [rows]=await pool.execute('SELECT * FROM labor_config_fields '+(target.success?'WHERE target=? ':'')+'ORDER BY target,label',target.success?[target.data]:[]);
 const canManage=permitted(req.admin,'labor.fields.manage');
 res.json({definitions:fromSql(rows).filter(f=>f.active||canManage),canManage});
}));
laborFieldsRouter.post('/definitions',requirePermission('labor.fields.manage'),asyncHandler(async(req,res)=>{
 const parsed=create.safeParse(req.body);
 if(!parsed.success)throw fail('Revisa código, etiqueta, destino, tipo y motivo.');
 const d=parsed.data;checkOptions(d.type,d.options);
 const db=await pool.getConnection();
 try{
  await db.beginTransaction();
  const [existing]=await db.execute('SELECT id FROM labor_config_fields WHERE code=?',[d.code]);
  if(existing.length)throw fail('Código técnico ya registrado.',409);
  const [created]=await db.execute('INSERT INTO labor_config_fields(code,label,target,field_type,required,options_json,updated_by) VALUES(?,?,?,?,?,?,?)',
   [d.code,d.label,d.target,d.type,d.required?1:0,JSON.stringify(d.options),req.admin.id]);
  const snapshot={id:created.insertId,code:d.code,label:d.label,target:d.target,type:d.type,required:d.required,options:d.options,active:true,revision:1};
  await db.execute('INSERT INTO labor_config_field_history(field_id,revision,snapshot_json,reason,changed_by) VALUES(?,?,?,?,?)',
   [created.insertId,1,JSON.stringify(snapshot),d.reason,req.admin.id]);
  await recordAudit(req.admin,'create','labor_config_field',created.insertId,{code:d.code,target:d.target,reason:d.reason},db);
  await db.commit();res.status(201).json({field:snapshot,message:'Campo registrado sin alterar la estructura existente.'});
 }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
laborFieldsRouter.put('/definitions/:id',requirePermission('labor.fields.manage'),asyncHandler(async(req,res)=>{
 const id=idOf(req.params.id),parsed=edit.safeParse(req.body);
 if(!id||!parsed.success)throw fail('Campo o revisión inválida.');
 const d=parsed.data,db=await pool.getConnection();
 try{
  await db.beginTransaction();
  const [rows]=await db.execute('SELECT * FROM labor_config_fields WHERE id=?',[id]);
  if(!rows.length)throw fail('Campo no encontrado.',404);
  const before=fieldPublic(rows[0]);
  if(before.revision!==d.revision)throw fail('Campo modificado en otra sesión.',409);
  checkOptions(before.type,d.options);
  if(before.type==='SELECT'){
   const [previous]=await db.execute('SELECT value_json FROM employee_config_field_values WHERE field_id=?',[id]);
   const values=new Set(previous.map(x=>JSON.parse(x.value_json)).filter(v=>v!==null));
   if([...values].some(v=>!d.options.includes(v)))throw fail('Las opciones históricas utilizadas deben conservarse.',409);
  }
  const next={...before,label:d.label,required:d.required,active:d.active,options:d.options,revision:d.revision+1};
  await db.execute('UPDATE labor_config_fields SET label=?,required=?,active=?,options_json=?,revision=revision+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=?',
   [d.label,d.required?1:0,d.active?1:0,JSON.stringify(d.options),req.admin.id,id,d.revision]);
  await db.execute('INSERT INTO labor_config_field_history(field_id,revision,snapshot_json,reason,changed_by) VALUES(?,?,?,?,?)',
   [id,next.revision,JSON.stringify(next),d.reason,req.admin.id]);
  await recordAudit(req.admin,'update','labor_config_field',id,{code:before.code,revision:next.revision,reason:d.reason},db);
  await db.commit();res.json({field:next,message:'Nueva definición guardada, con historial intacto.'});
 }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
laborFieldsRouter.get('/workers/:id',asyncHandler(async(req,res)=>{
 const id=idOf(req.params.id),target=targetSchema.safeParse(req.query.target);
 if(!id||!target.success)throw fail('Trabajador o destino inválido.');
 const w=await worker(pool,id),scope={companyId:w.companyId,branch:w.branch};
 if(!permitted(req.admin,requiredPermission(target.data),scope))throw fail('No puedes consultar los campos de este trabajador.',403);
 const [rows]=await pool.execute("SELECT d.*,v.value_json AS valueJson,v.revision AS valueRevision FROM labor_config_fields d LEFT JOIN employee_config_field_values v ON v.field_id=d.id AND v.employee_id=? WHERE d.target=? AND (d.active=1 OR v.field_id IS NOT NULL) ORDER BY d.label",[id,target.data]);
 const fields=rows.map(x=>({...fieldPublic(x),value:x.valueJson===null||x.valueJson===undefined?null:JSON.parse(x.valueJson),valueRevision:x.valueRevision||0,
  canWrite:!!x.active&&permitted(req.admin,requiredPermission(target.data,true),scope)&&canField(req.admin,x,false,scope)&&canField(req.admin,x,true,scope)}))
  .filter(x=>canField(req.admin,x,false,scope));
 res.json({fields});
}));
laborFieldsRouter.put('/workers/:id',asyncHandler(async(req,res)=>{
 const id=idOf(req.params.id),parsed=valueSchema.safeParse(req.body);
 if(!id||!parsed.success)throw fail('Datos de campos inválidos.');
 const data=parsed.data,db=await pool.getConnection();
 try{
  await db.beginTransaction();
  const w=await worker(db,id),scope={companyId:w.companyId,branch:w.branch};
  if(!permitted(req.admin,requiredPermission(data.target,true),scope))throw fail('Sin autorización para editar este trabajador.',403);
  const seen=new Set();
  for(const item of data.values){
   if(seen.has(item.fieldId))throw fail('Campo duplicado.');seen.add(item.fieldId);
   const [rows]=await db.execute('SELECT * FROM labor_config_fields WHERE id=?',[item.fieldId]);
   if(!rows.length)throw fail('Campo no encontrado.');
   const field=fieldPublic(rows[0]);
   if(!field.active||field.target!==data.target)throw fail('Campo inactivo o de otra sección.');
   if(!canField(req.admin,field,true,scope))throw fail('Sin permiso para editar '+field.label,403);
   const checked=validFieldValue(field,item.value);
   if(!checked.ok)throw fail('Valor inválido para '+field.label);
   const [old]=await db.execute('SELECT revision,value_json AS valueJson FROM employee_config_field_values WHERE employee_id=? AND field_id=?',[id,field.id]);
   const revision=old[0]?.revision||0;
   if(revision!==item.revision)throw fail('Campo modificado en otra sesión. Recarga antes de guardar.',409);
   const next=JSON.stringify(checked.value);
   if(old.length)await db.execute('UPDATE employee_config_field_values SET value_json=?,revision=revision+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE employee_id=? AND field_id=?',
     [next,req.admin.id,id,field.id]);
   else await db.execute('INSERT INTO employee_config_field_values(employee_id,field_id,value_json,updated_by) VALUES(?,?,?,?)',
     [id,field.id,next,req.admin.id]);
   await db.execute('INSERT INTO employee_config_field_history(employee_id,field_id,revision,previous_json,current_json,changed_by) VALUES(?,?,?,?,?,?)',
     [id,field.id,revision+1,old[0]?.valueJson??null,next,req.admin.id]);
   await recordAudit(req.admin,'update','employee_config_field',id,{fieldCode:field.code,revision:revision+1},db);
  }
  await db.commit();res.json({message:'Campos individuales registrados con historial.'});
 }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
