import {Router,raw} from 'express';
import {z} from 'zod';
import {createHash} from 'node:crypto';
import {requireRoles} from '../auth.js';
import {pool} from '../db.js';
import {runMigrations} from '../migrations.js';
import {recordAudit} from '../auditLog.js';
import {asyncHandler} from '../asyncHandler.js';
import {validContractDate} from '../employeeContracts.js';
import {inclusiveDays} from '../medicalLeaves.js';

export const medicalLeavesRouter=Router();
// Documentos de salud: no disponibles para el rol operador.
medicalLeavesRouter.use(requireRoles('admin','supervisor'));
medicalLeavesRouter.use(asyncHandler(async(_req,_res,next)=>{await runMigrations();next();}));
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const idOf=value=>Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):null;
const schema=z.object({
  folio:z.string().trim().max(100).nullable().optional(),
  issuedOn:z.string().nullable().optional(),
  receivedOn:z.string().nullable().optional(),
  startOn:z.string(),endOn:z.string(),
  status:z.enum(['RECIBIDA','EN_TRAMITACION','APROBADA','RECHAZADA','ANULADA']).default('RECIBIDA'),
  notes:z.string().trim().max(1000).nullable().optional()
});
const viewSql="SELECT m.id,m.employee_id AS employeeId,m.folio,m.issued_on AS issuedOn,"+
  "m.received_on AS receivedOn,m.start_on AS startOn,m.end_on AS endOn,m.status,m.notes,"+
  "m.created_at AS createdAt,m.updated_at AS updatedAt,m.created_by AS createdBy,m.updated_by AS updatedBy,"+
  "(SELECT COUNT(*) FROM medical_leave_files f WHERE f.leave_id=m.id) AS pdfCount "+
  "FROM medical_leaves m";
const clean=value=>value?.trim()||null;
const checked=data=>{
  const n=inclusiveDays(data.startOn,data.endOn);
  if(n>1096)throw fail('El período indicado supera tres años. Revisa las fechas.');
  for(const field of ['issuedOn','receivedOn'])
    if(clean(data[field])&&!validContractDate(data[field]))throw fail('Revisa la fecha de emisión o recepción.');
  return {folio:clean(data.folio),issuedOn:clean(data.issuedOn),receivedOn:clean(data.receivedOn),
    startOn:data.startOn,endOn:data.endOn,status:data.status,notes:clean(data.notes)};
};
medicalLeavesRouter.get('/workers/:employeeId',asyncHandler(async(req,res)=>{
  const employeeId=idOf(req.params.employeeId);if(!employeeId)throw fail('Trabajador inválido.');
  const [person]=await pool.execute('SELECT id FROM employees WHERE id=?',[employeeId]);
  if(!person.length)throw fail('Trabajador no encontrado.',404);
  const [rows]=await pool.execute(viewSql+' WHERE m.employee_id=? ORDER BY m.start_on DESC,m.id DESC',[employeeId]);
  res.json({leaves:rows.map(r=>({...r,days:inclusiveDays(r.startOn,r.endOn),pdfCount:Number(r.pdfCount)}))});
}));
medicalLeavesRouter.post('/workers/:employeeId',asyncHandler(async(req,res)=>{
  const employeeId=idOf(req.params.employeeId),parsed=schema.safeParse(req.body);
  if(!employeeId||!parsed.success)throw fail('Datos de la licencia incompletos o inválidos.');
  const data=checked(parsed.data),db=await pool.getConnection();
  try{
    await db.beginTransaction();
    if(!(await db.execute('SELECT id FROM employees WHERE id=?',[employeeId]))[0].length)
      throw fail('Trabajador no encontrado.',404);
    if(data.folio&&(await db.execute('SELECT id FROM medical_leaves WHERE employee_id=? AND folio=?',[employeeId,data.folio]))[0].length)
      throw fail('Este folio ya está registrado para el trabajador.',409);
    const [r]=await db.execute('INSERT INTO medical_leaves(employee_id,folio,issued_on,received_on,start_on,end_on,status,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?)',
      [employeeId,data.folio,data.issuedOn,data.receivedOn,data.startOn,data.endOn,data.status,data.notes,req.admin.id]);
    await recordAudit(req.admin,'create','medical_leave',r.insertId,{employeeId,...data},db);
    await db.commit();res.status(201).json({id:r.insertId,message:'Licencia registrada. Los horarios existentes se conservaron.'});
  }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
medicalLeavesRouter.put('/:id',asyncHandler(async(req,res)=>{
  const id=idOf(req.params.id),parsed=schema.safeParse(req.body);
  if(!id||!parsed.success)throw fail('Datos de la licencia incompletos o inválidos.');
  const data=checked(parsed.data),db=await pool.getConnection();
  try{
    await db.beginTransaction();
    const [before]=await db.execute('SELECT * FROM medical_leaves WHERE id=?',[id]);
    if(!before.length)throw fail('Licencia no encontrada.',404);
    if(data.folio&&(await db.execute('SELECT id FROM medical_leaves WHERE employee_id=? AND folio=? AND id<>?',
      [before[0].employee_id,data.folio,id]))[0].length)throw fail('Folio repetido para este trabajador.',409);
    await db.execute("UPDATE medical_leaves SET folio=?,issued_on=?,received_on=?,start_on=?,end_on=?,status=?,notes=?,updated_by=?,updated_at=datetime('now','localtime') WHERE id=?",
      [data.folio,data.issuedOn,data.receivedOn,data.startOn,data.endOn,data.status,data.notes,req.admin.id,id]);
    await recordAudit(req.admin,'update','medical_leave',id,{before:before[0],after:data},db);
    await db.commit();res.json({message:'Licencia actualizada con auditoría, sin alterar horarios existentes.'});
  }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
medicalLeavesRouter.post('/:id/pdf',raw({type:'application/pdf',limit:'8mb'}),asyncHandler(async(req,res)=>{
  const id=idOf(req.params.id),pdf=req.body;
  if(!id||!Buffer.isBuffer(pdf)||!pdf.length||pdf.length>8*1024*1024||
    pdf.subarray(0,5).toString('latin1')!=='%PDF-'||
    !pdf.subarray(Math.max(0,pdf.length-2048)).includes(Buffer.from('%%EOF')))
    throw fail('Selecciona un PDF válido de hasta 8 MB.');
  const hash=createHash('sha256').update(pdf).digest('hex'),db=await pool.getConnection();
  try{
    await db.beginTransaction();
    if(!(await db.execute('SELECT id FROM medical_leaves WHERE id=?',[id]))[0].length)
      throw fail('Licencia no encontrada.',404);
    if((await db.execute('SELECT id FROM medical_leave_files WHERE leave_id=? AND sha256=?',[id,hash]))[0].length)
      throw fail('Este PDF ya está adjunto a la licencia.',409);
    const [r]=await db.execute('INSERT INTO medical_leave_files(leave_id,pdf,sha256,uploaded_by) VALUES(?,?,?,?)',
      [id,pdf,hash,req.admin.id]);
    await recordAudit(req.admin,'upload','medical_leave_file',r.insertId,{leaveId:id,sha256:hash},db);
    await db.commit();res.status(201).json({id:r.insertId,message:'PDF de licencia respaldado.'});
  }catch(e){await db.rollback();throw e;}finally{db.release();}
}));
medicalLeavesRouter.get('/:id/files',asyncHandler(async(req,res)=>{
  const id=idOf(req.params.id);if(!id)throw fail('Licencia inválida.');
  const [rows]=await pool.execute('SELECT id,uploaded_at AS uploadedAt,uploaded_by AS uploadedBy FROM medical_leave_files WHERE leave_id=? ORDER BY id DESC',[id]);
  res.json({files:rows});
}));
medicalLeavesRouter.get('/files/:id/pdf',asyncHandler(async(req,res)=>{
  const id=idOf(req.params.id);if(!id)throw fail('PDF inválido.');
  const [rows]=await pool.execute('SELECT pdf FROM medical_leave_files WHERE id=?',[id]);
  if(!rows.length)throw fail('PDF no encontrado.',404);
  res.set('Cache-Control','no-store').set('X-Content-Type-Options','nosniff');
  res.set('Content-Disposition','attachment; filename="licencia-medica-'+id+'.pdf"');
  res.type('application/pdf').send(Buffer.from(rows[0].pdf));
}));
