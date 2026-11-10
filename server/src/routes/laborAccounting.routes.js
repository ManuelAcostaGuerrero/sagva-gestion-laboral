import {Router} from 'express';
import {z} from 'zod';
import {pool} from '../db.js';
import {requireAdmin,requirePermission} from '../auth.js';
import {asyncHandler} from '../asyncHandler.js';
import {runMigrations} from '../migrations.js';
import {recordAudit} from '../auditLog.js';
import {validContractDate} from '../employeeContracts.js';
import {laborMetric,laborMetrics,laborScaled,laborValuesAt} from '../../../shared/laborAccounting.js';

export const laborAccountingRouter=Router();
laborAccountingRouter.use(requireAdmin);
laborAccountingRouter.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
laborAccountingRouter.use(asyncHandler(async (_req,_res,next)=>{await runMigrations();next();}));

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const label=z.string().trim().min(2).max(120);
const code=z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,40}$/);
const reason=z.string().trim().min(10).max(500);
const creation=z.object({
 kind:z.enum(['AFP','ISAPRE']),code,name:label,reason
}).strict();
const editing=z.object({
 name:label,active:z.boolean(),revision:z.number().int().positive(),reason
}).strict();
const parameter=z.object({
 metric:z.string(),entityId:z.number().int().positive().nullable().optional(),
 value:z.union([z.number(),z.string().trim().min(1)]),
 effectiveFrom:z.string(),reason,sourceUrl:z.union([z.string().url().max(500),z.literal('')]).optional()
}).strict();
const getEntities=async db=>{
 const [rows]=await db.execute(
  'SELECT id,kind,code,name,active,revision,created_at AS createdAt,updated_at AS updatedAt FROM labor_entities ORDER BY kind,name'
 );
 return rows.map(x=>({...x,active:Boolean(x.active)}));
};
const getVersions=async db=>{
 const [rows]=await db.execute(
  'SELECT v.id,v.metric,v.entity_id AS entityId,e.name AS entityName,'+
  'v.value_hundredths AS valueHundredths,v.unit,v.effective_from AS effectiveFrom,'+
  'v.reason,v.source_url AS sourceUrl,v.created_at AS createdAt,v.created_by AS createdBy '+
  'FROM labor_parameter_versions v LEFT JOIN labor_entities e ON e.id=v.entity_id '+
  'ORDER BY v.effective_from DESC,v.id DESC'
 );
 return rows;
};

laborAccountingRouter.get('/catalog',requirePermission('labor.catalog.read'),asyncHandler(async(_req,res)=>{
 const entities=await getEntities(pool);
 res.json({entities:entities.filter(x=>x.active).map(({id,kind,code,name})=>({id,kind,code,name}))});
}));
laborAccountingRouter.get('/',requirePermission('labor.parameters.read'),asyncHandler(async(req,res)=>{
 const on=String(req.query.on||new Date().toISOString().slice(0,10));
 if(!validContractDate(on))throw fail('Selecciona una fecha válida.');
 const [entities,versions,history]=await Promise.all([
   getEntities(pool),getVersions(pool),
   pool.execute('SELECT h.id,h.entity_id AS entityId,h.before_json AS beforeJson,'+
   'h.after_json AS afterJson,h.reason,h.changed_by AS changedBy,h.changed_at AS changedAt '+
   'FROM labor_entity_history h ORDER BY h.id DESC')
 ]);
 res.json({
   entities,versions,current:laborValuesAt(versions,on),
   entityHistory:history[0].map(x=>({...x,before:x.beforeJson?JSON.parse(x.beforeJson):null,
     after:JSON.parse(x.afterJson),beforeJson:undefined,afterJson:undefined})),
   metrics:laborMetrics,asOf:on
 });
}));

laborAccountingRouter.post('/entities',requirePermission('labor.parameters.manage'),asyncHandler(async(req,res)=>{
 const parsed=creation.safeParse(req.body);
 if(!parsed.success)throw fail('Completa tipo, código, nombre y motivo del catálogo.');
 const data=parsed.data,db=await pool.getConnection();
 try{
  await db.beginTransaction();
  if((await db.execute('SELECT id FROM labor_entities WHERE code=? OR (kind=? AND upper(name)=upper(?))',
    [data.code,data.kind,data.name]))[0].length)throw fail('Ya existe una entidad con ese nombre o código.',409);
  const [created]=await db.execute(
   'INSERT INTO labor_entities(kind,code,name) VALUES(?,?,?)',
   [data.kind,data.code,data.name.toLocaleUpperCase('es-CL')]
  );
  await db.execute('INSERT INTO labor_entity_history(entity_id,after_json,reason,changed_by) VALUES(?,?,?,?)',
   [created.insertId,JSON.stringify({kind:data.kind,code:data.code,name:data.name,active:true,revision:1}),data.reason,req.admin.id]);
  await recordAudit(req.admin,'create','labor_entity',created.insertId,{kind:data.kind,code:data.code,reason:data.reason},db);
  await db.commit();res.status(201).json({id:created.insertId,message:'Entidad creada sin alterar el catálogo histórico.'});
 }catch(error){await db.rollback();throw error;}finally{db.release();}
}));

laborAccountingRouter.put('/entities/:id',requirePermission('labor.parameters.manage'),asyncHandler(async(req,res)=>{
 const parsed=editing.safeParse(req.body);
 const id=Number(req.params.id);
 if(!parsed.success||!Number.isSafeInteger(id)||id<1)throw fail('Revisa la entidad y el motivo.');
 const data=parsed.data,db=await pool.getConnection();
 try{
  await db.beginTransaction();
  const [found]=await db.execute('SELECT id,kind,code,name,active,revision FROM labor_entities WHERE id=?',[id]);
  if(!found.length)throw fail('Entidad no encontrada.',404);
  const old=found[0];
  if(Number(old.revision)!==data.revision)throw fail('Este catálogo cambió en otra sesión. Recarga.',409);
  if(old.kind==='FONASA'&&!data.active)throw fail('No se puede desactivar FONASA, institución base de salud.',400);
  const name=data.name.toLocaleUpperCase('es-CL');
  if((await db.execute('SELECT id FROM labor_entities WHERE kind=? AND upper(name)=upper(?) AND id<>?',
    [old.kind,name,id]))[0].length)throw fail('Ya existe otra entidad con ese nombre.',409);
  const newValue={...old,name,active:data.active?1:0,revision:old.revision+1};
  const [updated]=await db.execute(
   "UPDATE labor_entities SET name=?,active=?,revision=revision+1,updated_at=datetime('now','localtime') WHERE id=? AND revision=?",
   [name,data.active?1:0,id,old.revision]
  );
  if(!updated.affectedRows)throw fail('Entidad modificada en otra sesión. Recarga.',409);
  await db.execute('INSERT INTO labor_entity_history(entity_id,before_json,after_json,reason,changed_by) VALUES(?,?,?,?,?)',
   [id,JSON.stringify(old),JSON.stringify(newValue),data.reason,req.admin.id]);
  await recordAudit(req.admin,'update','labor_entity',id,{reason:data.reason,before:old,after:newValue},db);
  await db.commit();res.json({message:'Entidad modificada con historial; las fichas existentes conservan sus datos.'});
 }catch(error){await db.rollback();throw error;}finally{db.release();}
}));

laborAccountingRouter.post('/parameters',requirePermission('labor.parameters.manage'),asyncHandler(async(req,res)=>{
 const parsed=parameter.safeParse(req.body);
 if(!parsed.success)throw fail('Revisa el parámetro, la fecha, el valor y el motivo.');
 const data=parsed.data;
 const spec=laborMetric(data.metric);
 if(!spec)throw fail('Parámetro desconocido.');
 if(!validContractDate(data.effectiveFrom))throw fail('La fecha de vigencia es inválida.');
 let scaled;
 try{scaled=laborScaled(data.value,spec.unit);}catch(error){throw fail(error.message);}
 const db=await pool.getConnection();
 try{
  await db.beginTransaction();
  const entityId=data.entityId??null;
  if(spec.entityKind){
   if(!entityId)throw fail('Selecciona la AFP para su comisión.');
   const [rows]=await db.execute('SELECT kind FROM labor_entities WHERE id=?',[entityId]);
   if(!rows.length||rows[0].kind!==spec.entityKind)throw fail('La comisión debe pertenecer a una AFP.',400);
  }else if(entityId){
   throw fail('Este parámetro es general y no pertenece a una institución.');
  }
  // No hay UPDATE ni DELETE: misma fecha permite registrar una corrección nueva.
  const [created]=await db.execute(
   'INSERT INTO labor_parameter_versions(metric,entity_id,value_hundredths,unit,effective_from,reason,source_url,created_by) VALUES(?,?,?,?,?,?,?,?)',
   [spec.code,entityId,scaled,spec.unit,data.effectiveFrom,data.reason,data.sourceUrl||null,req.admin.id]
  );
  await recordAudit(req.admin,'create','labor_parameter_version',created.insertId,
   {metric:spec.code,entityId,valueHundredths:scaled,effectiveFrom:data.effectiveFrom,reason:data.reason},db);
  await db.commit();
  res.status(201).json({id:created.insertId,message:'Nueva versión registrada. No se modificaron períodos históricos.'});
 }catch(error){await db.rollback();throw error;}finally{db.release();}
}));
