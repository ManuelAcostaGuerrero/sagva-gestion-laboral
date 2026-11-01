import {Router, raw} from 'express';
import {createHash} from 'node:crypto';
import {pool} from '../db.js';
import {runMigrations} from '../migrations.js';
import {requireRoles} from '../auth.js';
import {asyncHandler} from '../asyncHandler.js';
import {recordAudit} from '../auditLog.js';
import {fileSelect,presentFile} from '../employeeFiles.js';
import {contractPreparation} from '../contractFiles.js';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const idOf=value=>Number.isSafeInteger(Number(value)) && Number(value)>0 ? Number(value) : null;
export const contractFilesRouter=Router();
contractFilesRouter.use(requireRoles('admin','supervisor','operator'));
contractFilesRouter.get('/workers/:id',asyncHandler(async(req,res)=>{
  await runMigrations();
  const id=idOf(req.params.id);
  if(!id)throw fail('Trabajador inválido.');
  const [files]=await pool.execute(`${fileSelect} WHERE e.id=?`,[id]);
  if(!files.length)throw fail('Ficha no encontrada.',404);
  const [attachments]=await pool.execute('SELECT f.id,f.annex_order AS annexOrder,f.filename,f.source,f.uploaded_at AS uploadedAt,a.full_name AS uploadedByName FROM employee_contract_files f JOIN admins a ON a.id=f.uploaded_by WHERE f.employee_id=? ORDER BY f.id DESC',[id]);
  res.json({attachments,preparation:contractPreparation(presentFile(files[0]))});
}));
contractFilesRouter.post('/workers/:id/:target/pdf',raw({type:'application/pdf',limit:'8mb'}),asyncHandler(async(req,res)=>{
  await runMigrations();
  const id=idOf(req.params.id),target=req.params.target;
  if(!id || !['contract','1','2'].includes(target))throw fail('Contrato o anexo inválido.');
  const annexOrder=target==='contract'?null:Number(target),pdf=req.body;
  if(!Buffer.isBuffer(pdf) || !pdf.length || pdf.length>8*1024*1024 || pdf.subarray(0,5).toString('latin1')!=='%PDF-' || !pdf.subarray(Math.max(0,pdf.length-2048)).includes(Buffer.from('%%EOF')))throw fail('Adjunta un PDF válido de hasta 8 MB.');
  const revision=Number(req.header('X-Ficha-Revision'));
  if(!req.header('X-Ficha-Revision') || !Number.isInteger(revision) || revision<0)throw fail('Guarda y vuelve a abrir la ficha antes de adjuntar el PDF.');
  const db=await pool.getConnection();
  try {
    await db.beginTransaction();
    const [rows]=await db.execute(`${fileSelect} WHERE e.id=?`,[id]);
    if(!rows.length)throw fail('Ficha no encontrada.',404);
    const file=presentFile(rows[0]);
    if(file.revision!==revision)throw fail('La ficha cambió en otra sesión. Vuelve a abrirla antes de adjuntar el PDF.',409);
    if(annexOrder && !file.annexes[annexOrder-1])throw fail('Guarda primero el anexo correspondiente.',409);
    if(!annexOrder && !['INDEFINIDO','PLAZO_FIJO'].includes(file.contractType))throw fail('Guarda primero el tipo de contrato.',409);
    const sha256=createHash('sha256').update(pdf).digest('hex');
    if((await db.execute('SELECT id FROM employee_contract_files WHERE employee_id=? AND annex_order IS ? AND sha256=?',[id,annexOrder,sha256]))[0].length)throw fail('Este PDF ya está adjunto al contrato o anexo.',409);
    const snapshot={contractType:file.contractType,hireDate:file.hireDate,terminationDate:file.terminationDate,revision,annex:annexOrder?file.annexes[annexOrder-1]:null};
    const filename=annexOrder?`anexo-${annexOrder}.pdf`:'contrato.pdf';
    const [created]=await db.execute('INSERT INTO employee_contract_files(employee_id,annex_order,filename,pdf,sha256,contract_snapshot_json,uploaded_by) VALUES(?,?,?,?,?,?,?)',[id,annexOrder,filename,pdf,sha256,JSON.stringify(snapshot),req.admin.id]);
    await recordAudit(req.admin,'upload','employee_contract_file',created.insertId,{employeeId:id,annexOrder,sha256,bytes:pdf.length,snapshot},db);
    await db.commit();
    res.status(201).json({id:created.insertId,message:'PDF guardado sin borrar respaldos anteriores.'});
  } catch(error) {await db.rollback();throw error;} finally {db.release();}
}));
contractFilesRouter.get('/:id/pdf',asyncHandler(async(req,res)=>{
  await runMigrations();
  const id=idOf(req.params.id);
  if(!id)throw fail('Archivo inválido.');
  const [files]=await pool.execute('SELECT filename,pdf FROM employee_contract_files WHERE id=?',[id]);
  if(!files.length)throw fail('PDF no encontrado.',404);
  res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');
  res.set('Content-Disposition',`attachment; filename="${files[0].filename}"`);
  res.type('application/pdf').send(Buffer.from(files[0].pdf));
}));
