import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireRoles } from '../auth.js';
import { asyncHandler } from '../asyncHandler.js';
import { runMigrations } from '../migrations.js';
import { recordAudit } from '../auditLog.js';
import { normalizeDocumentName } from '../employeeDocuments.js';

export const documentCatalogRouter = Router();
documentCatalogRouter.use(requireRoles('admin'));

const fail = (message, status=400) => Object.assign(new Error(message), {status});
const idOf = value => Number.isSafeInteger(Number(value)) && Number(value)>0 ? Number(value) : null;
const schema = z.object({
  name:z.string().trim().min(2).max(120),
  expiryMode:z.enum(['NONE','PERIOD','MANUAL','EVENT']),
  periodValue:z.coerce.number().int().min(1).max(1200).nullable().optional(),
  periodUnit:z.enum(['DAYS','WEEKS','MONTHS','YEARS']).nullable().optional(),
  applicability:z.enum(['ALL','SELECTED']).default('ALL'),
  employeeIds:z.array(z.number().int().positive()).max(3000).default([])
});
function normalize(data) {
  if(data.expiryMode==='PERIOD' && (!data.periodValue||!data.periodUnit))
    throw fail('Completa el plazo y la unidad de vencimiento.');
  return {
    name:normalizeDocumentName(data.name),expiryMode:data.expiryMode,
    periodValue:data.expiryMode==='PERIOD'?data.periodValue:null,
    periodUnit:data.expiryMode==='PERIOD'?data.periodUnit:null,
    applicability:data.applicability,
    employeeIds:data.applicability==='SELECTED'?[...new Set(data.employeeIds)]:[]
  };
}
async function setAssignments(db,id,employeeIds,userId) {
  if(employeeIds.length) {
    const [rows]=await db.execute('SELECT id FROM employees WHERE id IN ('+employeeIds.map(()=>'?').join(',')+')',employeeIds);
    if(rows.length!==employeeIds.length)throw fail('La selección incluye trabajadores inexistentes.');
  }
  await db.execute('DELETE FROM employee_document_applicability WHERE type_id=?',[id]);
  for(const employeeId of employeeIds)
    await db.execute('INSERT INTO employee_document_applicability(type_id,employee_id,assigned_by) VALUES(?,?,?)',
      [id,employeeId,userId]);
}
const listSql = 'SELECT t.id,t.name,t.expiry_mode AS expiryMode,t.period_value AS periodValue,t.period_unit AS periodUnit,'+
  't.is_active AS isActive,t.applicability,t.deactivation_reason AS deactivationReason,'+
  '(SELECT COUNT(*) FROM employee_document_entries h WHERE h.document_type_id=t.id) AS historyCount,'+
  '(SELECT COUNT(*) FROM employee_document_applicability a WHERE a.type_id=t.id) AS selectedCount '+
  'FROM employee_document_types t ORDER BY t.is_active DESC,t.name';

documentCatalogRouter.get('/',asyncHandler(async(_req,res)=>{
  await runMigrations();
  const [rows]=await pool.execute(listSql);
  const [assignments]=await pool.execute('SELECT type_id AS typeId,employee_id AS employeeId FROM employee_document_applicability');
  res.json({types:rows.map(t=>({...t,isActive:!!t.isActive,historyCount:Number(t.historyCount),
    selectedCount:Number(t.selectedCount),employeeIds:assignments.filter(a=>a.typeId===t.id).map(a=>a.employeeId)}))});
}));

documentCatalogRouter.post('/',asyncHandler(async(req,res)=>{
  await runMigrations();
  const parsed=schema.safeParse(req.body);
  if(!parsed.success)throw fail('Revisa el nombre y condiciones del documento.');
  const data=normalize(parsed.data);
  const db=await pool.getConnection();
  try{
    await db.beginTransaction();
    if((await db.execute('SELECT id FROM employee_document_types WHERE name=?',[data.name]))[0].length)
      throw fail('Ya existe un documento con ese nombre.',409);
    const [result]=await db.execute('INSERT INTO employee_document_types(name,expiry_mode,period_value,period_unit,applicability,created_by) VALUES(?,?,?,?,?,?)',
      [data.name,data.expiryMode,data.periodValue,data.periodUnit,data.applicability,req.admin.id]);
    await setAssignments(db,result.insertId,data.employeeIds,req.admin.id);
    await recordAudit(req.admin,'create','employee_document_type',result.insertId,{after:data},db);
    await db.commit();
    res.status(201).json({id:result.insertId,message:'Documento creado. Ya aparece en las fichas aplicables.'});
  }catch(e){await db.rollback();throw e;}finally{db.release();}
}));

documentCatalogRouter.put('/:id',asyncHandler(async(req,res)=>{
  await runMigrations();
  const id=idOf(req.params.id),parsed=schema.safeParse(req.body);
  if(!id||!parsed.success)throw fail('Revisa el nombre y condiciones del documento.');
  const data=normalize(parsed.data),db=await pool.getConnection();
  try {
    await db.beginTransaction();
    const [found]=await db.execute('SELECT * FROM employee_document_types WHERE id=?',[id]);
    if(!found.length)throw fail('Documento no encontrado.',404);
    if((await db.execute('SELECT id FROM employee_document_types WHERE name=? AND id<>?',[data.name,id]))[0].length)
      throw fail('Ya existe otro documento con ese nombre.',409);
    await db.execute('UPDATE employee_document_types SET name=?,expiry_mode=?,period_value=?,period_unit=?,applicability=?,updated_by=?,updated_at=datetime(\'now\',\'localtime\') WHERE id=?',
      [data.name,data.expiryMode,data.periodValue,data.periodUnit,data.applicability,req.admin.id,id]);
    await setAssignments(db,id,data.employeeIds,req.admin.id);
    await recordAudit(req.admin,'update','employee_document_type',id,{before:found[0],after:data,historicalRecordsPreserved:true},db);
    await db.commit();
    res.json({message:'Documento actualizado. Las fechas y archivos históricos se conservaron.'});
  }catch(e){await db.rollback();throw e;}finally{db.release();}
}));

documentCatalogRouter.post('/:id/deactivate',asyncHandler(async(req,res)=>{
  await runMigrations();
  const id=idOf(req.params.id),reason=z.string().trim().min(5).max(255).safeParse(req.body?.reason);
  if(!id||!reason.success)throw fail('Indica un motivo de desactivación de al menos cinco caracteres.');
  const db=await pool.getConnection();
  try{
    await db.beginTransaction();
    const [updated]=await db.execute('UPDATE employee_document_types SET is_active=0,deactivation_reason=?,updated_at=datetime(\'now\',\'localtime\'),updated_by=? WHERE id=? AND is_active=1',
      [reason.data,req.admin.id,id]);
    if(!updated.affectedRows)throw fail('Documento no encontrado o ya desactivado.',404);
    await recordAudit(req.admin,'deactivate','employee_document_type',id,{reason:reason.data},db);
    await db.commit();res.json({message:'Documento desactivado sin perder historial.'});
  }catch(e){await db.rollback();throw e;}finally{db.release();}
}));

documentCatalogRouter.post('/:id/reactivate',asyncHandler(async(req,res)=>{
  await runMigrations();
  const id=idOf(req.params.id);if(!id)throw fail('Documento inválido.');
  const db=await pool.getConnection();
  try{
    await db.beginTransaction();
    const [updated]=await db.execute('UPDATE employee_document_types SET is_active=1,deactivation_reason=NULL,updated_at=datetime(\'now\',\'localtime\'),updated_by=? WHERE id=? AND is_active=0',
      [req.admin.id,id]);
    if(!updated.affectedRows)throw fail('Documento no encontrado o ya activo.',404);
    await recordAudit(req.admin,'reactivate','employee_document_type',id,{},db);
    await db.commit();res.json({message:'Documento reactivado.'});
  }catch(e){await db.rollback();throw e;}finally{db.release();}
}));

const affectedSql='SELECT e.id,e.full_name AS fullName,e.document_id AS documentId,e.is_active AS isActive,'+
  '(SELECT COUNT(*) FROM employee_document_entries h WHERE h.employee_id=e.id AND h.document_type_id=?) AS historyCount,'+
  'EXISTS(SELECT 1 FROM employee_document_applicability a WHERE a.employee_id=e.id AND a.type_id=?) AS selected '+
  'FROM employees e WHERE EXISTS(SELECT 1 FROM employee_document_entries h WHERE h.employee_id=e.id AND h.document_type_id=?) '+
  'OR EXISTS(SELECT 1 FROM employee_document_applicability a WHERE a.employee_id=e.id AND a.type_id=?) '+
  'ORDER BY e.is_active DESC,e.full_name';

documentCatalogRouter.get('/:id/workers',asyncHandler(async(req,res)=>{
  await runMigrations();
  const id=idOf(req.params.id);if(!id)throw fail('Documento inválido.');
  const [workers]=await pool.execute(affectedSql,[id,id,id,id]);
  res.json({workers:workers.map(w=>({...w,isActive:!!w.isActive,selected:!!w.selected,historyCount:Number(w.historyCount)}))});
}));

documentCatalogRouter.delete('/:id/permanent',asyncHandler(async(req,res)=>{
  await runMigrations();
  const id=idOf(req.params.id);if(!id)throw fail('Documento inválido.');
  const db=await pool.getConnection();
  try{
    await db.beginTransaction();
    const [found]=await db.execute('SELECT * FROM employee_document_types WHERE id=?',[id]);
    if(!found.length)throw fail('Documento no encontrado.',404);
    const [workers]=await db.execute(affectedSql,[id,id,id,id]);
    if(workers.length) {
      await db.rollback();
      return res.status(409).json({
        message:'No se puede eliminar: está asignado a trabajadores o tiene entregas históricas. Desactívalo o quita asignaciones sin historial.',
        assignedEmployees:workers.map(w=>({id:w.id,fullName:w.fullName,documentId:w.documentId,isActive:!!w.isActive,
          selected:!!w.selected,historyCount:Number(w.historyCount)})),
        historyCount:workers.reduce((n,w)=>n+Number(w.historyCount),0)
      });
    }
    await db.execute('DELETE FROM employee_document_types WHERE id=?',[id]);
    await recordAudit(req.admin,'delete','employee_document_type',id,{before:found[0]},db);
    await db.commit();res.json({message:'Documento sin uso eliminado permanentemente.'});
  }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
