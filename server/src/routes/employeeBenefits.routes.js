
import { Router, raw } from 'express';
import {createHash} from 'node:crypto';
import { z } from 'zod';
import { pool } from '../db.js';
import { runMigrations } from '../migrations.js';
import { requireRoles,requireAdmin } from '../auth.js';
import { recordAudit } from '../auditLog.js';
import { asyncHandler } from '../asyncHandler.js';
import {mayReadBank,mayEditBank,bankReady,encryptBank,decryptBank,restricted} from '../benefitSecurity.js';
import {normalizeRut} from '../rut.js';

export const employeeBenefitsRouter=Router();
employeeBenefitsRouter.use(requireAdmin);
employeeBenefitsRouter.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
employeeBenefitsRouter.use(asyncHandler(async(_req,_res,next)=>{await runMigrations();next();}));
const fail=(msg,status=400)=>Object.assign(new Error(msg),{status});
const idOf=x=>Number.isSafeInteger(Number(x))&&Number(x)>0?Number(x):null;
const date=z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/),z.literal(''),z.null()]).optional();
const entry=z.object({
  id:z.number().int().positive().optional(),fullName:z.string().trim().min(2).max(160),
  relationship:z.enum(['HIJO','HIJA','CONYUGE','CONVIVIENTE','ASCENDIENTE','OTRO']),
  recognitionStatus:z.enum(['PENDING','RECOGNIZED','ENDED']),
  institution:z.string().trim().max(140).nullable().optional(),
  recognitionDate:date,validFrom:date,validUntil:date,
  referenceCode:z.string().trim().max(120).nullable().optional()
}).strict();
const familySchema=z.object({revision:z.number().int().nonnegative(),status:z.enum(['NONE','PENDING','RECOGNIZED']),dependents:z.array(entry).max(30),averageIncomeClp:z.number().int().nonnegative().nullable().optional(),incomePeriod:z.string().trim().max(120).optional(),incomeVerified:z.boolean().optional()}).strict();
const bankSchema=z.object({revision:z.number().int().nonnegative(),bankId:z.number().int().positive(),accountType:z.enum(['CORRIENTE','VISTA','CUENTARUT','AHORRO','OTRA']),accountNumber:z.string().trim().min(3).max(55).regex(/^[0-9A-Za-z.-]+$/),holderName:z.string().trim().min(2).max(160),holderRut:z.string().trim().min(7).max(15),requestedOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),authorizationRef:z.string().trim().max(160).default('')}).strict();
async function employee(db,id){
 const [rows]=await db.execute('SELECT id,document_id AS documentId FROM employees WHERE id=?',[id]);
 if(!rows.length)throw fail('Trabajador no encontrado.',404);
 return rows[0];
}
employeeBenefitsRouter.get('/bank-capability',asyncHandler(async(req,res)=>{
 const canRead=mayReadBank(req.admin),canWrite=mayEditBank(req.admin),ready=bankReady();
 res.json({canAccess:canRead&&ready,canWrite:canWrite&&ready,reason:!canRead?'NOT_AUTHORIZED':!ready?'KEY_NOT_CONFIGURED':null});
}));
employeeBenefitsRouter.get('/:id/family',requireRoles('admin','supervisor'),asyncHandler(async(req,res)=>{
 const id=idOf(req.params.id);if(!id)throw fail('Trabajador inválido.');
 await employee(pool,id);
 const [status]=await pool.execute('SELECT status,revision FROM employee_family_state WHERE employee_id=?',[id]);
 const [rows]=await pool.execute('SELECT id,full_name AS fullName,relationship,recognition_status AS recognitionStatus,institution,recognition_date AS recognitionDate,valid_from AS validFrom,valid_until AS validUntil,reference_code AS referenceCode FROM employee_family_dependents WHERE employee_id=? ORDER BY id',[id]);
 const [income]=await pool.execute('SELECT average_income_clp AS averageIncomeClp,income_period AS incomePeriod,verified AS incomeVerified FROM employee_family_income_reference WHERE employee_id=?',[id]);
 res.json({status:status[0]?.status||'NONE',revision:status[0]?.revision||0,dependents:rows,
  averageIncomeClp:income[0]?.averageIncomeClp??null,incomePeriod:income[0]?.incomePeriod||'',incomeVerified:!!income[0]?.incomeVerified});
}));
employeeBenefitsRouter.put('/:id/family',requireRoles('admin'),asyncHandler(async(req,res)=>{
 const id=idOf(req.params.id),parsed=familySchema.safeParse(req.body);
 if(!id||!parsed.success)throw fail('Datos de cargas familiares inválidos.');
 const d=parsed.data;
 if(d.incomeVerified && (!(d.averageIncomeClp>=0)||!d.incomePeriod?.trim()))
  throw fail('La renta acreditada requiere monto e identificación del semestre de referencia.');
 if(d.status==='RECOGNIZED'&&!d.dependents.some(x=>x.recognitionStatus==='RECOGNIZED'))
   throw fail('Debe existir al menos una carga reconocida.');
 if(d.status==='PENDING'&&!d.dependents.some(x=>x.recognitionStatus==='PENDING'))
   throw fail('Debe existir al menos una carga pendiente.');
 if(d.status==='NONE'&&d.dependents.some(x=>x.recognitionStatus!=='ENDED'))
   throw fail('No se pueden ocultar cargas vigentes sin cerrar su estado.');
 for(const x of d.dependents){
   if(x.recognitionStatus==='RECOGNIZED' && (!x.institution||!x.recognitionDate))
     throw fail('Una carga reconocida requiere institución y fecha de reconocimiento.');
   if(x.validFrom&&x.validUntil&&x.validUntil<x.validFrom)throw fail('Fechas de vigencia contradictorias.');
 }
 const ids=d.dependents.filter(x=>x.id).map(x=>x.id);
 if(new Set(ids).size!==ids.length)throw fail('Hay cargas duplicadas en la solicitud.');
 const db=await pool.getConnection();
 try{
  await db.beginTransaction();
  await employee(db,id);
  const [s]=await db.execute('SELECT status,revision FROM employee_family_state WHERE employee_id=?',[id]);
  const current=s[0]?.revision||0;
  if(current!==d.revision)throw fail('Las cargas cambiaron en otra sesión.',409);
  const [previousSnapshot]=await db.execute('SELECT id,full_name AS fullName,relationship,recognition_status AS recognitionStatus,institution,recognition_date AS recognitionDate,valid_from AS validFrom,valid_until AS validUntil,reference_code AS referenceCode FROM employee_family_dependents WHERE employee_id=? ORDER BY id',[id]);
  const existing=previousSnapshot;
  if(existing.some(x=>!ids.includes(x.id)))throw fail('No se permite eliminar cargas históricas: marca estado finalizado.',400);
  const changes=[];
  for(const x of d.dependents){
   const params=[x.fullName,x.relationship,x.recognitionStatus,x.institution||null,x.recognitionDate||null,x.validFrom||null,x.validUntil||null,x.referenceCode||null,req.admin.id];
   if(x.id){
    const [result]=await db.execute('UPDATE employee_family_dependents SET full_name=?,relationship=?,recognition_status=?,institution=?,recognition_date=?,valid_from=?,valid_until=?,reference_code=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND employee_id=?',[...params,x.id,id]);
    if(!result.affectedRows)throw fail('Carga no pertenece al trabajador.',400);
    changes.push(x.id);
   } else {
    const [result]=await db.execute('INSERT INTO employee_family_dependents(full_name,relationship,recognition_status,institution,recognition_date,valid_from,valid_until,reference_code,updated_by,employee_id) VALUES(?,?,?,?,?,?,?,?,?,?)',[...params,id]);
    changes.push(result.insertId);
   }
  }
  await db.execute('INSERT INTO employee_family_state(employee_id,status,revision,updated_by) VALUES(?,?,?,?) ON CONFLICT(employee_id) DO UPDATE SET status=excluded.status,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP',[id,d.status,current+1,req.admin.id]);
  if(Object.prototype.hasOwnProperty.call(d,'averageIncomeClp')){
   const income=[d.averageIncomeClp??null,d.incomePeriod||'',d.incomeVerified?1:0];
   await db.execute('INSERT INTO employee_family_income_reference(employee_id,average_income_clp,income_period,verified,updated_by) VALUES(?,?,?,?,?) ON CONFLICT(employee_id) DO UPDATE SET average_income_clp=excluded.average_income_clp,income_period=excluded.income_period,verified=excluded.verified,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP',[id,...income,req.admin.id]);
   await db.execute('INSERT INTO employee_family_income_history(employee_id,average_income_clp,income_period,verified,changed_by) VALUES(?,?,?,?,?)',[id,...income,req.admin.id]);
  }
  const [nextSnapshot]=await db.execute('SELECT id,full_name AS fullName,relationship,recognition_status AS recognitionStatus,institution,recognition_date AS recognitionDate,valid_from AS validFrom,valid_until AS validUntil,reference_code AS referenceCode FROM employee_family_dependents WHERE employee_id=? ORDER BY id',[id]);
  await db.execute('INSERT INTO employee_family_history(employee_id,revision,before_status,after_status,changed_ids_json,snapshot_before_json,snapshot_after_json,changed_by) VALUES(?,?,?,?,?,?,?,?)',[id,current+1,s[0]?.status||null,d.status,JSON.stringify(changes),JSON.stringify(previousSnapshot),JSON.stringify(nextSnapshot),req.admin.id]);
  await recordAudit(req.admin,'update','employee_family',id,{statusBefore:s[0]?.status||'NONE',statusAfter:d.status,changedIds:changes,incomeReferenceUpdated:Object.prototype.hasOwnProperty.call(d,'averageIncomeClp'),revision:current+1},db);
  await db.commit();res.json({message:'Cargas familiares guardadas con historial.',revision:current+1});
 }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
employeeBenefitsRouter.get('/:id/bank',restricted(mayReadBank),asyncHandler(async(req,res)=>{
 const id=idOf(req.params.id);if(!id)throw fail('Trabajador inválido.');
 await employee(pool,id);
 // La clave es obligatoria incluso para lectura; sin ella no se expone registro.
 const [rows]=await pool.execute('SELECT payload_ciphertext AS payload,revision FROM employee_bank_accounts WHERE employee_id=?',[id]);
 // Validar disponibilidad de clave sin revelar configuración; una cuenta no existe aún.
 if(!bankReady())throw fail('Acceso bancario no configurado.',503);
 const account=rows[0]?decryptBank(rows[0].payload):null;
 // Lecturas de datos financieros personales son auditables, sin registrar su contenido.
 await recordAudit(req.admin,'read','employee_bank_account',id,{field:'bank_account'});
 res.json({account,revision:rows[0]?.revision||0});
}));
employeeBenefitsRouter.put('/:id/bank',restricted(mayEditBank),asyncHandler(async(req,res)=>{
 const id=idOf(req.params.id),parsed=bankSchema.safeParse(req.body);
 if(!id||!parsed.success)throw fail('Datos bancarios inválidos.');
 if(!bankReady())throw fail('Clave de cifrado no configurada.',503);
 const d=parsed.data;
 const db=await pool.getConnection();
 try{
  await db.beginTransaction();
  const worker=await employee(db,id);
  const thirdParty=!!worker.documentId&&normalizeRut(worker.documentId)!==normalizeRut(d.holderRut);
  if(thirdParty){
   const ref=/^BANCARIA-([1-9][0-9]*)$/.exec(d.authorizationRef);
   if(!ref)throw fail('Una cuenta de tercero requiere PDF de autorización.');
   const [documents]=await db.execute('SELECT id FROM employee_bank_authorizations WHERE id=? AND employee_id=?',[Number(ref[1]),id]);
   if(!documents.length)throw fail('La autorización bancaria no corresponde a este trabajador.');
  }
  const [banks]=await db.execute('SELECT id FROM labor_banks WHERE id=? AND active=1',[d.bankId]);
  if(!banks.length)throw fail('Banco no activo o no encontrado.');
  const [previous]=await db.execute('SELECT revision,payload_ciphertext AS payload FROM employee_bank_accounts WHERE employee_id=?',[id]);
  const revision=previous[0]?.revision||0;
  if(revision!==d.revision)throw fail('La cuenta se modificó en otra sesión.',409);
  const {revision:ignored,...payload}=d;
  const encrypted=encryptBank(payload);
  if(previous.length)await db.execute('INSERT INTO employee_bank_account_history(employee_id,revision,payload_ciphertext,superseded_by) VALUES(?,?,?,?)',
    [id,revision,previous[0].payload,req.admin.id]);
  await db.execute('INSERT INTO employee_bank_accounts(employee_id,payload_ciphertext,revision,updated_by) VALUES(?,?,?,?) ON CONFLICT(employee_id) DO UPDATE SET payload_ciphertext=excluded.payload_ciphertext,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP',[id,encrypted,revision+1,req.admin.id]);
  await recordAudit(req.admin,'update','employee_bank_account',id,{changedFields:Object.keys(payload),revision:revision+1,encrypted:true},db);
  await db.commit();res.json({message:'Cuenta registrada con cifrado y auditoría.',revision:revision+1});
 }catch(e){await db.rollback();throw e;}finally{db.release();}
}));

employeeBenefitsRouter.post('/:id/bank-authorization',restricted(mayEditBank),raw({type:'application/pdf',limit:'8mb'}),asyncHandler(async(req,res)=>{
 const id=idOf(req.params.id);if(!id)throw fail('Trabajador inválido.');
 if(!bankReady())throw fail('Cifrado bancario no configurado.',503);
 const pdf=req.body;
 if(!Buffer.isBuffer(pdf)||pdf.length===0||pdf.length>8*1024*1024||
  pdf.subarray(0,5).toString('latin1')!=='%PDF-'||
  !pdf.subarray(Math.max(0,pdf.length-2048)).includes(Buffer.from('%%EOF')))
  throw fail('Adjunta un PDF válido de hasta 8 MB.');
 const hash=createHash('sha256').update(pdf).digest('hex');
 const db=await pool.getConnection();
 try{
  await db.beginTransaction();await employee(db,id);
  const [exists]=await db.execute('SELECT id FROM employee_bank_authorizations WHERE employee_id=? AND sha256=?',[id,hash]);
  if(exists.length)throw fail('Este respaldo ya fue cargado.',409);
  const cipher=encryptBank({pdfBase64:pdf.toString('base64')});
  const [r]=await db.execute('INSERT INTO employee_bank_authorizations(employee_id,pdf_ciphertext,sha256,uploaded_by) VALUES(?,?,?,?)',[id,cipher,hash,req.admin.id]);
  await recordAudit(req.admin,'upload','employee_bank_authorization',r.insertId,{employeeId:id,sha256:hash,bytes:pdf.length},db);
  await db.commit();res.status(201).json({id:r.insertId,authorizationRef:'BANCARIA-'+r.insertId,message:'Autorización bancaria cifrada y vinculada al trabajador.'});
 }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
employeeBenefitsRouter.get('/:id/bank-authorizations',restricted(mayReadBank),asyncHandler(async(req,res)=>{
 const id=idOf(req.params.id);if(!id)throw fail('Trabajador inválido.');
 await employee(pool,id);
 const [rows]=await pool.execute('SELECT id,uploaded_at AS uploadedAt FROM employee_bank_authorizations WHERE employee_id=? ORDER BY id DESC',[id]);
 res.json({documents:rows});
}));
employeeBenefitsRouter.get('/:id/bank-authorizations/:authorizationId/pdf',restricted(mayReadBank),asyncHandler(async(req,res)=>{
 const id=idOf(req.params.id),aid=idOf(req.params.authorizationId);
 if(!id||!aid)throw fail('Identificador inválido.');
 if(!bankReady())throw fail('Cifrado bancario no configurado.',503);
 const [rows]=await pool.execute('SELECT pdf_ciphertext AS cipher FROM employee_bank_authorizations WHERE employee_id=? AND id=?',[id,aid]);
 if(!rows.length)throw fail('Respaldo no encontrado.',404);
 await recordAudit(req.admin,'read','employee_bank_authorization',aid,{employeeId:id});
 const pdf=Buffer.from(decryptBank(rows[0].cipher).pdfBase64,'base64');
 res.set('Cache-Control','private, no-store');res.set('X-Content-Type-Options','nosniff');
 res.set('Content-Disposition','attachment; filename="autorizacion-bancaria-'+aid+'.pdf"');
 res.type('application/pdf').send(pdf);
}));
