import { Router, raw } from 'express';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { pool } from '../db.js';
import { requireRoles } from '../auth.js';
import { asyncHandler } from '../asyncHandler.js';
import { runMigrations } from '../migrations.js';
import { recordAudit } from '../auditLog.js';
import { validContractDate } from '../employeeContracts.js';
import { calculateDocumentExpiry, normalizeDocumentName } from '../employeeDocuments.js';

import {financialDocumentKind} from '../financialDocuments.js';
import {approveSalaryAnnex} from '../employeeSalaryApprovals.js';

export const employeeDocumentsRouter = Router();
employeeDocumentsRouter.use(requireRoles('admin', 'supervisor', 'operator'));

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const idOf = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const catalogSchema = z.object({
  name: z.string().trim().min(2).max(120),
  expiryMode: z.enum(['NONE', 'PERIOD', 'MANUAL', 'EVENT']),
  periodValue: z.coerce.number().int().min(1).max(1200).nullable().optional(),
  periodUnit: z.enum(['DAYS', 'WEEKS', 'MONTHS', 'YEARS']).nullable().optional()
});
const entrySchema = z.object({
  retroactive: z.boolean().optional(),
  retroactiveAmount: z.number().int().positive().max(1000000000000).nullable().optional(),
  retroactiveMonths: z.array(z.string().regex(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/)).max(120).optional(),
  agreedAmount: z.number().int().positive().max(1000000000000).nullable().optional(),
  amountMeaning: z.enum(['NEW_BASE','INCREASE','BONUS']).nullable().optional(),
  expiryMode: z.enum(['DEFAULT', 'MANUAL']).optional(),
  typeId: z.coerce.number().int().positive(),
  deliveredOn: z.string(),
  startOn: z.string().nullable().optional(),
  expiresOn: z.string().nullable().optional(),
  versionLabel: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional()
});
const clean = value => value?.trim() || null;

employeeDocumentsRouter.get('/types', asyncHandler(async (req, res) => {
  await runMigrations();
  const employeeId = req.query.workerId === undefined ? null : idOf(req.query.workerId);
  if (req.query.workerId !== undefined && !employeeId) throw fail('Trabajador inválido.');
  const includeInactive = req.query.includeInactive === '1' && (req.admin.role || 'admin') === 'admin' && employeeId === null;
  const [types] = await pool.execute(
    'SELECT t.id,t.name,t.expiry_mode AS expiryMode,t.period_value AS periodValue,t.period_unit AS periodUnit,' +
    't.is_active AS isActive,t.applicability,t.deactivation_reason AS deactivationReason,' +
    '(SELECT COUNT(*) FROM employee_document_entries h WHERE h.document_type_id=t.id) AS historyCount,' +
    '(SELECT COUNT(*) FROM employee_document_applicability a WHERE a.type_id=t.id) AS selectedCount ' +
    'FROM employee_document_types t WHERE ?=1 OR (' +
    't.is_active=1 AND (? IS NULL OR t.applicability=\'ALL\' OR EXISTS (' +
    'SELECT 1 FROM employee_document_applicability a WHERE a.type_id=t.id AND a.employee_id=?))) ' +
    'OR (? IS NOT NULL AND EXISTS (SELECT 1 FROM employee_document_entries h WHERE h.document_type_id=t.id AND h.employee_id=?)) ' +
    'ORDER BY t.is_active DESC,t.name',
    [includeInactive ? 1 : 0,employeeId,employeeId,employeeId,employeeId]
  );
  const selected = employeeId === null ? [] : (await pool.execute(
    'SELECT type_id AS typeId FROM employee_document_applicability WHERE employee_id=?',[employeeId]
  ))[0].map(a=>a.typeId);
  res.json({types:types.map(row=>({...row,financialKind:financialDocumentKind(row.name),isActive:!!row.isActive,historyCount:Number(row.historyCount),
    selectedCount:Number(row.selectedCount),
    canRegister:!!row.isActive && (employeeId===null || row.applicability==='ALL' || selected.includes(row.id))
  }))});
}));

employeeDocumentsRouter.post('/types', asyncHandler(async (req, res) => {
  await runMigrations();
  if ((req.admin.role || 'admin') !== 'admin') throw fail('Solo el administrador puede crear tipos de documentos.', 403);
  const parsed = catalogSchema.safeParse(req.body);
  if (!parsed.success) throw fail('Revisa el nombre y la modalidad de vencimiento.');
  const data = parsed.data;
  if (data.expiryMode === 'PERIOD' && (!data.periodValue || !data.periodUnit)) {
    throw fail('Define cantidad y unidad de vigencia para el vencimiento automático.');
  }
  const name = normalizeDocumentName(data.name);
  const [existing] = await pool.execute('SELECT id FROM employee_document_types WHERE name=?', [name]);
  if (existing.length) throw fail('Ya existe un documento con ese nombre.', 409);
  const [created] = await pool.execute(
    'INSERT INTO employee_document_types(name,expiry_mode,period_value,period_unit,created_by) VALUES(?,?,?,?,?)',
    [name, data.expiryMode, data.expiryMode === 'PERIOD' ? data.periodValue : null,
      data.expiryMode === 'PERIOD' ? data.periodUnit : null, req.admin.id]
  );
  await recordAudit(req.admin, 'create', 'employee_document_type', created.insertId, { name, expiryMode: data.expiryMode });
  res.status(201).json({ id: created.insertId, message: 'Tipo de documento creado.' });
}));

employeeDocumentsRouter.get('/workers/:workerId', asyncHandler(async (req, res) => {
  await runMigrations();
  const workerId = idOf(req.params.workerId);
  if (!workerId) throw fail('Trabajador inválido.');
  const [workers] = await pool.execute('SELECT id FROM employees WHERE id=?', [workerId]);
  if (!workers.length) throw fail('Trabajador no encontrado.', 404);
  const [entries] = await pool.execute(
    'SELECT id,employee_id AS employeeId,document_type_id AS typeId,document_name AS documentName,expiry_mode AS expiryMode,delivered_on AS deliveredOn,start_on AS startOn,expires_on AS expiresOn,version_label AS versionLabel,financial_kind AS financialKind,agreed_amount AS agreedAmount,amount_meaning AS amountMeaning,is_retroactive AS retroactive,retroactive_amount AS retroactiveAmount,retroactive_months_json AS retroactiveMonthsJson,notes,created_at AS createdAt,created_by AS createdBy, (SELECT approved_at FROM employee_salary_annex_approvals a WHERE a.entry_id=employee_document_entries.id) AS salaryApprovedAt, (SELECT new_salary FROM employee_salary_annex_approvals a WHERE a.entry_id=employee_document_entries.id) AS approvedSalary FROM employee_document_entries WHERE employee_id=? ORDER BY id DESC',
    [workerId]
  );
  let attachments = [];
  if (entries.length) {
    const [rows] = await pool.execute(
      'SELECT id,entry_id AS entryId,filename,sha256,signed_physical AS signedPhysical,signed_on AS signedOn,uploaded_at AS uploadedAt,uploaded_by AS uploadedBy FROM employee_document_attachments WHERE entry_id IN (' +
      entries.map(() => '?').join(',') + ') ORDER BY id DESC',
      entries.map(row => row.id)
    );
    attachments = rows;
  }
  const [physicalStatuses] = await pool.execute(
    'SELECT document_type_id AS typeId,status,revision,updated_at AS updatedAt FROM employee_document_physical_status WHERE employee_id=?',
    [workerId]
  );
  res.json({ physicalStatuses, entries: entries.map(({retroactiveMonthsJson,...entry}) => ({
    ...entry,
    retroactive:entry.retroactive==null?null:Boolean(entry.retroactive),
    retroactiveMonths:JSON.parse(retroactiveMonthsJson||'[]'),
    retroactiveAmount:['admin','supervisor'].includes(req.admin.role)?entry.retroactiveAmount:null,
    agreedAmount:['admin','supervisor'].includes(req.admin.role) ? entry.agreedAmount : null,
    approvedSalary:['admin','supervisor'].includes(req.admin.role) ? entry.approvedSalary : null,
    attachments: attachments.filter(file => file.entryId === entry.id).map(file => ({
      ...file, signedPhysical: Boolean(file.signedPhysical)
    }))
  })) });
}));


const physicalStatusSchema=z.object({
  status:z.enum(['UNVERIFIED','AVAILABLE','MISSING']),
  revision:z.number().int().nonnegative()
}).strict();

employeeDocumentsRouter.put('/workers/:workerId/types/:typeId/physical-status',
 requireRoles('admin','supervisor'),asyncHandler(async(req,res)=>{
  await runMigrations();
  const workerId=idOf(req.params.workerId),typeId=idOf(req.params.typeId);
  const parsed=physicalStatusSchema.safeParse(req.body);
  if(!workerId||!typeId||!parsed.success)throw fail('Estado físico, documento o revisión inválidos.');
  const db=await pool.getConnection();
  try{
   await db.beginTransaction();
   const [worker]=await db.execute('SELECT id FROM employees WHERE id=?',[workerId]);
   if(!worker.length)throw fail('Trabajador no encontrado.',404);
   const [type]=await db.execute('SELECT id FROM employee_document_types WHERE id=?',[typeId]);
   if(!type.length)throw fail('Tipo de documento no encontrado.',404);
   const [rows]=await db.execute('SELECT status,revision FROM employee_document_physical_status WHERE employee_id=? AND document_type_id=?',[workerId,typeId]);
   const before=rows[0]?.status||'UNVERIFIED',revision=rows[0]?.revision||0;
   if(revision!==parsed.data.revision)throw fail('El estado físico cambió en otra sesión; actualiza antes de guardar.',409);
   if(rows.length){
    await db.execute("UPDATE employee_document_physical_status SET status=?,revision=revision+1,updated_by=?,updated_at=datetime('now','localtime') WHERE employee_id=? AND document_type_id=?",
     [parsed.data.status,req.admin.id,workerId,typeId]);
   }else{
    await db.execute('INSERT INTO employee_document_physical_status(employee_id,document_type_id,status,updated_by) VALUES(?,?,?,?)',
     [workerId,typeId,parsed.data.status,req.admin.id]);
   }
   await recordAudit(req.admin,'update','employee_document_physical_status',workerId,
    {typeId,before,after:parsed.data.status,revision:revision+1,documentUnchanged:true},db);
   await db.commit();
   res.json({status:parsed.data.status,revision:revision+1,message:'Disponibilidad física registrada; los PDF y entregas existentes no se modificaron.'});
  }catch(e){await db.rollback();throw e;}finally{db.release();}
 })
);

employeeDocumentsRouter.post('/workers/:workerId/entries', asyncHandler(async (req, res) => {
  await runMigrations();
  const workerId = idOf(req.params.workerId);
  const parsed = entrySchema.safeParse(req.body);
  if (!workerId || !parsed.success) throw fail('Completa las fechas y los datos del documento.');
  const data = parsed.data;
  if (!validContractDate(data.deliveredOn)) throw fail('Fecha de entrega inválida.');
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const [workers] = await db.execute('SELECT id FROM employees WHERE id=?', [workerId]);
    if (!workers.length) throw fail('Trabajador no encontrado.', 404);
    const [types] = await db.execute(
      'SELECT id,name,expiry_mode AS expiryMode,period_value AS periodValue,period_unit AS periodUnit FROM employee_document_types WHERE id=?',
      [data.typeId]
    );
    if (!types.length) throw fail('Tipo de documento no encontrado.', 404);
    const [rules] = await db.execute('SELECT is_active AS active,applicability FROM employee_document_types WHERE id=?',[data.typeId]);
    if(!rules[0].active)throw fail('Documento desactivado: no permite registrar nuevas entregas.',409);
    if(rules[0].applicability === 'SELECTED' &&
      !(await db.execute('SELECT 1 FROM employee_document_applicability WHERE type_id=? AND employee_id=?',
        [data.typeId,workerId]))[0].length)throw fail('Este documento no está asignado a este trabajador.',403);
    const type = types[0];
    const financialKind=financialDocumentKind(type.name);
    if(financialKind && !['admin','supervisor'].includes(req.admin.role))throw fail('Solo administración o supervisión puede registrar montos de anexos.',403);
    if(financialKind && !data.agreedAmount)throw fail('Indica el monto acordado en pesos chilenos.');
    if(financialKind==='SALARY_INCREASE' && !['NEW_BASE','INCREASE'].includes(data.amountMeaning))throw fail('Indica si el monto corresponde al nuevo sueldo base o al aumento.');
    if(!financialKind && (data.agreedAmount!=null || data.amountMeaning!=null))throw fail('Este documento no admite un monto de anexo.');
    const retroactive=financialKind==='SALARY_INCREASE' ? data.retroactive||false : null;
    const retroactiveMonths=[...new Set(data.retroactiveMonths||[])].sort();
    if(financialKind!=='SALARY_INCREASE' && (data.retroactive || data.retroactiveAmount!=null || retroactiveMonths.length))throw fail('El retroactivo solo corresponde al anexo de aumento de sueldo.');
    if(retroactive && (!data.retroactiveAmount || !retroactiveMonths.length))throw fail('Indica el monto total del retroactivo y uno o más meses.');
    if(!retroactive && (data.retroactiveAmount!=null || retroactiveMonths.length))throw fail('Selecciona Sí en retroactivo para registrar su monto y meses.');
    const versionLabel=financialKind==='SALARY_INCREASE'?null:clean(data.versionLabel);
    const amountMeaning=financialKind==='BONUS'?'BONUS':financialKind?data.amountMeaning:null;
    const expiryMode = data.expiryMode === 'MANUAL' ? 'MANUAL' : type.expiryMode;
    const startOn = clean(data.startOn);
    let expiresOn = null;
    if (startOn && !validContractDate(startOn)) throw fail('Fecha de inicio inválida.');
    if ((financialKind || ['PERIOD', 'MANUAL'].includes(expiryMode)) && !startOn) throw fail('Indica la fecha de inicio.');
    if (expiryMode === 'PERIOD') {
      expiresOn = calculateDocumentExpiry(startOn, type.periodValue, type.periodUnit);
    } else if (expiryMode === 'MANUAL') {
      expiresOn = clean(data.expiresOn);
      if (!validContractDate(expiresOn)) throw fail('Indica una fecha de vencimiento válida.');
    }
    if (startOn && expiresOn && expiresOn < startOn) throw fail('El vencimiento no puede ser anterior al inicio.');
    const [created] = await db.execute(
      'INSERT INTO employee_document_entries(employee_id,document_type_id,document_name,expiry_mode,delivered_on,start_on,expires_on,version_label,notes,created_by,financial_kind,agreed_amount,amount_meaning,is_retroactive,retroactive_amount,retroactive_months_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [workerId, type.id, type.name, expiryMode, data.deliveredOn, startOn, expiresOn, versionLabel, clean(data.notes), req.admin.id,financialKind,financialKind?data.agreedAmount:null,amountMeaning,retroactive==null?null:retroactive?1:0,retroactive?data.retroactiveAmount:null,retroactive?JSON.stringify(retroactiveMonths):null]
    );
    await recordAudit(req.admin, 'create', 'employee_document_entry', created.insertId, {
      employeeId: workerId, typeId: type.id, expiryMode, financialKind, amountMeaning, amountRecorded:!!financialKind, retroactive, retroactiveMonths, deliveredOn: data.deliveredOn, startOn, expiresOn, versionLabel
    }, db);
    await db.commit();
    res.status(201).json({ id: created.insertId, message: 'Entrega registrada. Falta adjuntar el documento si aún no tiene respaldo.' });
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}));

employeeDocumentsRouter.post('/entries/:entryId/pdf',
  raw({ type: 'application/pdf', limit: '8mb' }),
  asyncHandler(async (req, res) => {
    await runMigrations();
    const entryId = idOf(req.params.entryId);
    if (!entryId) throw fail('Registro inválido.');
    const pdf = req.body;
    if (!Buffer.isBuffer(pdf) || !pdf.length || pdf.length > 8 * 1024 * 1024 ||
      pdf.subarray(0, 5).toString('latin1') !== '%PDF-' ||
      !pdf.subarray(Math.max(0, pdf.length - 2048)).includes(Buffer.from('%%EOF'))) {
      throw fail('Adjunta un PDF válido de hasta 8 MB.');
    }
    const isSigned = req.header('X-Documento-Firmado') === 'si';
    const signedOn = req.header('X-Fecha-Firma') || null;
    if (isSigned && !validContractDate(signedOn)) throw fail('Indica la fecha de firma del documento.');
    if (!isSigned && signedOn) throw fail('No puede registrarse fecha de firma sin confirmarla.');
    const hash = createHash('sha256').update(pdf).digest('hex');
    const db = await pool.getConnection();
    try {
      await db.beginTransaction();
      const [entries] = await db.execute('SELECT id FROM employee_document_entries WHERE id=?', [entryId]);
      if (!entries.length) throw fail('Entrega o renovación no encontrada.', 404);
      const [duplicate] = await db.execute('SELECT id FROM employee_document_attachments WHERE entry_id=? AND sha256=?', [entryId, hash]);
      if (duplicate.length) throw fail('Este PDF ya fue adjuntado a este registro.', 409);
      const [created] = await db.execute(
        'INSERT INTO employee_document_attachments(entry_id,filename,pdf,sha256,signed_physical,signed_on,uploaded_by) VALUES(?,?,?,?,?,?,?)',
        [entryId, 'respaldo.pdf', pdf, hash, isSigned ? 1 : 0, signedOn, req.admin.id]
      );
      await recordAudit(req.admin, 'upload', 'employee_document_attachment', created.insertId, {
        entryId, sha256: hash, signedPhysical: isSigned, signedOn, bytes: pdf.length
      }, db);
      await db.commit();
      res.status(201).json({ id: created.insertId, message: 'PDF incorporado al historial.' });
    } catch (error) {
      await db.rollback();
      throw error;
    } finally {
      db.release();
    }
  })
);


// La firma del PDF por sí sola NO altera remuneraciones: requiere aprobación explícita.
// Transacción única: aplicar monto, registrar historial, marcar aplicado y auditar.
employeeDocumentsRouter.post('/entries/:entryId/approve-salary',
  requireRoles('admin','supervisor'),asyncHandler(async(req,res)=>{
    await runMigrations();
    const entryId=idOf(req.params.entryId);
    if(!entryId)throw fail('Anexo inválido.');
    const db=await pool.getConnection();
    try{
      await db.beginTransaction();
      const approved=await approveSalaryAnnex(db,{entryId,admin:req.admin});
      await db.commit();
      res.json({approved,message:'Anexo aprobado. El nuevo sueldo base fue guardado con historial.'});
    }catch(error){await db.rollback();throw error;}finally{db.release();}
  })
);

employeeDocumentsRouter.get('/attachments/:attachmentId/pdf', asyncHandler(async (req, res) => {
  await runMigrations();
  const id = idOf(req.params.attachmentId);
  if (!id) throw fail('Archivo inválido.');
  const [files] = await pool.execute('SELECT pdf FROM employee_document_attachments WHERE id=?', [id]);
  if (!files.length) throw fail('Archivo no encontrado.', 404);
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Disposition', 'attachment; filename="documento-laboral-' + id + '.pdf"');
  res.type('application/pdf').send(Buffer.from(files[0].pdf));
}));
