import {Router} from 'express';
import {z} from 'zod';
import {requireAdmin} from '../../auth.js';
import {runMigrations} from '../../migrations.js';
import {pool} from '../../db.js';
import {asyncHandler} from '../../asyncHandler.js';
import {employmentContextAsOf} from '../../employmentHistory.js';
import {previsionAsOf} from '../../normalizationExpand.js';
import {validContractDate} from '../../employeeContracts.js';
import {laborCatalog,laborWorker} from './laborStructure.repository.js';
import {laborTransaction,createBranch,updateBranch,hire,finish,assign,setConditions,setShift,setPrevision,linkDocument} from './laborStructure.service.js';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const id=z.number().int().positive();
const nullableId=id.nullable();
const label=z.string().trim().min(2).max(150);
const evidence=z.string().trim().min(8).max(500);
const isoDate=z.string().refine(validContractDate,'La fecha debe existir en el calendario.');
const branchNew=z.object({companyId:id,code:z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/),
  name:label,address:z.string().trim().max(300).default('')}).strict();
const branchChange=z.object({name:label,address:z.string().trim().max(300).default(''),
  active:z.boolean(),revision:id}).strict();
const employmentNew=z.object({employeeId:id,companyId:id,startedOn:isoDate,evidenceRef:evidence}).strict();
const employmentEnd=z.object({endedOn:isoDate,evidenceRef:evidence,
  reason:z.string().trim().min(8).max(500)}).strict();
const assignment=z.object({validFrom:isoDate,branchId:nullableId,areaId:nullableId,positionId:nullableId,
  evidenceRef:evidence}).strict();
const conditions=z.object({effectiveFrom:isoDate,monthlyBaseSalaryClp:z.number().int().nonnegative(),
 weeklyHours:z.number().min(0).max(48),breakMinutes:z.number().int().min(0).max(240),
 contractType:z.enum(['INDEFINIDO','PLAZO_FIJO','OTRO']),regime:z.enum(['GENERAL','SPECIAL','EXEMPT']),
 description:z.string().trim().max(500).default(''),
 evidenceRef:evidence}).strict();
const shift=z.object({validFrom:isoDate,shiftId:id,evidenceRef:evidence}).strict();
const prevision=z.object({validFrom:isoDate,afpEntityId:nullableId,healthEntityId:nullableId,
  planAmountHundredths:z.number().int().nonnegative().nullable(),planUnit:z.enum(['CLP','UF']).nullable(),
  evidenceRef:evidence}).strict().refine(x=>(x.planAmountHundredths===null)===(x.planUnit===null),
  'El valor del plan y su unidad deben estar ambos presentes o ausentes.');
const document=z.object({fileId:id,kind:z.enum(['CONTRACT','ANNEX','OTHER']),evidenceRef:evidence}).strict();

export const laborStructureRouter=Router();
laborStructureRouter.use(requireAdmin);
laborStructureRouter.use((req,res,next)=>{
 res.set('Cache-Control','private, no-store');
 // Por diseño, las APIs nuevas quedan restringidas a Root hasta implementar
 // y probar permisos granulares por empresa/local. Rol SQL 'admin' no basta.
 if(req.admin.profile!=='root')return res.status(403).json({message:'Esta gestión laboral requiere perfil Root.'});
 next();
});
laborStructureRouter.use(asyncHandler(async(_req,_res,next)=>{await runMigrations();next();}));
function numberParam(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<1)throw fail('Identificador inválido.');return n;}
function payload(schema,body){const result=schema.safeParse(body);if(!result.success)throw fail('Datos laborales incompletos o inválidos: '+result.error.issues.map(x=>x.path.join('.')).join(', '));return result.data;}
function mutate(action,schema){
 return asyncHandler(async(req,res)=>{
  const data=payload(schema,req.body);
  const result=await laborTransaction(req.admin,(db,admin)=>action(db,admin,data,req));
  res.status(201).json({result});
 });
}
laborStructureRouter.get('/catalog',asyncHandler(async(_req,res)=>res.json(await laborCatalog(pool))));
laborStructureRouter.get('/workers/:workerId',asyncHandler(async(req,res)=>{
 const result=await laborWorker(pool,numberParam(req.params.workerId));
 if(!result)throw fail('Trabajador no encontrado.',404);
 res.json(result);
}));
laborStructureRouter.get('/workers/:workerId/as-of',asyncHandler(async(req,res)=>{
 const workerId=numberParam(req.params.workerId);
 if(!validContractDate(req.query.on))throw fail('Fecha de consulta inválida.');
 const worker=await laborWorker(pool,workerId);
 if(!worker)throw fail('Trabajador no encontrado.',404);
 const [relationships,prevision,shifts]=await Promise.all([
  employmentContextAsOf(pool,workerId,req.query.on),
  previsionAsOf(pool,workerId,req.query.on),
  pool.execute(`SELECT v.employment_id AS employmentId,v.shift_id AS shiftId,
      s.name AS shiftName,v.valid_from AS validFrom
    FROM employment_shift_versions v JOIN employment_relationships r ON r.id=v.employment_id
    JOIN work_shifts s ON s.id=v.shift_id
    WHERE r.employee_id=? AND r.review_status='CONFIRMED'
      AND r.started_on<=? AND (r.ended_on IS NULL OR r.ended_on>=?)
      AND v.valid_from<=? AND (v.valid_until IS NULL OR v.valid_until>?)
    ORDER BY v.employment_id`,[workerId,req.query.on,req.query.on,req.query.on,req.query.on]).then(result=>result[0])
 ]);
 res.json({worker:worker.worker,asOf:req.query.on,relationships,prevision,shifts});
}));
laborStructureRouter.post('/branches',mutate(createBranch,branchNew));
laborStructureRouter.put('/branches/:id',asyncHandler(async(req,res)=>{
 const data=payload(branchChange,req.body),id=numberParam(req.params.id);
 const result=await laborTransaction(req.admin,(db,admin)=>updateBranch(db,admin,id,data));
 res.json({result});
}));
laborStructureRouter.post('/employments',mutate(hire,employmentNew));
laborStructureRouter.post('/employments/:id/finish',asyncHandler(async(req,res)=>{
 const data=payload(employmentEnd,req.body),id=numberParam(req.params.id);
 const result=await laborTransaction(req.admin,(db,admin)=>finish(db,admin,id,data));
 res.json({result});
}));
laborStructureRouter.post('/employments/:id/assignments',asyncHandler(async(req,res)=>{
 const data=payload(assignment,req.body),id=numberParam(req.params.id);
 const result=await laborTransaction(req.admin,(db,admin)=>assign(db,admin,id,data));
 res.status(201).json({result});
}));
laborStructureRouter.post('/employments/:id/conditions',asyncHandler(async(req,res)=>{
 const data=payload(conditions,req.body),id=numberParam(req.params.id);
 const result=await laborTransaction(req.admin,(db,admin)=>setConditions(db,admin,id,data));
 res.status(201).json({result});
}));
laborStructureRouter.post('/employments/:id/shifts',asyncHandler(async(req,res)=>{
 const data=payload(shift,req.body),id=numberParam(req.params.id);
 const result=await laborTransaction(req.admin,(db,admin)=>setShift(db,admin,id,data));
 res.status(201).json({result});
}));
laborStructureRouter.post('/workers/:workerId/prevision',asyncHandler(async(req,res)=>{
 const data=payload(prevision,req.body),id=numberParam(req.params.workerId);
 const result=await laborTransaction(req.admin,(db,admin)=>setPrevision(db,admin,id,data));
 res.status(201).json({result});
}));
laborStructureRouter.post('/employments/:id/documents',asyncHandler(async(req,res)=>{
 const data=payload(document,req.body),id=numberParam(req.params.id);
 const result=await laborTransaction(req.admin,(db,admin)=>linkDocument(db,admin,id,data));
 res.status(201).json({result});
}));
// No devolver SQL interno a la UI. Los conflictos son del usuario, no fallos fatales.
laborStructureRouter.use((err,_req,res,next)=>{
 if([19,1555,1811,2067,787,275].includes(Number(err?.errcode))||String(err?.code||'').startsWith('SQLITE_CONSTRAINT'))
  return res.status(409).json({message:'Conflicto de datos o vigencias. Revisa el historial y vuelve a intentarlo.'});
 next(err);
});
