import {Router} from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import {z} from 'zod';
import {pool} from '../db.js';
import {runMigrations} from '../migrations.js';
import {asyncHandler} from '../asyncHandler.js';
import {requireRoles} from '../auth.js';
import {recordAudit} from '../auditLog.js';
import {getConfiguredDateTime,getSystemSettings} from '../systemSettings.js';
import {sendAttendanceNotification} from '../pushNotifications.js';
import {workerName} from '../workerNames.js';
import {ATTENDANCE_TYPES} from '../attendanceSchema.js';
import {createAttendanceProof,verifyAttendanceProof} from '../attendanceProofs.js';
import {createAttendanceReceipt,readAttendanceReceipt,dispatchAttendanceReceipt} from '../attendanceReceipts.js';
import {terminalActivationQrPayload} from '../terminalActivationQr.js';

const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const random=()=>crypto.randomBytes(32).toString('base64url');
const error=(message,status=400)=>Object.assign(new Error(message),{status});
const management=requireRoles('admin','supervisor');
export const tokenRouter=Router();
tokenRouter.use(asyncHandler(async(_req,_res,next)=>{await runMigrations();next();}));
// Buscar solo bajo demanda, sin enviar todo el personal ni sus credenciales al abrir Usuarios.
tokenRouter.get('/workers',management,asyncHandler(async(req,res)=>{
  const q=String(req.query.q||'').trim();
  if(q.length<2)return res.json({workers:[]});
  if(q.length>80)throw error('La búsqueda es demasiado extensa.');
  const escaped=q.replace(/[\\%_]/g,c=>'\\'+c);
  const like='%'+escaped+'%';
  const [people]=await pool.execute(`SELECT e.id,e.full_name AS fullName,e.is_active AS isActive,
    e.access_code_enabled AS pinEnabled,f.extra_json AS extraJson,
    (SELECT created_at FROM worker_tokens t WHERE t.employee_id=e.id AND t.revoked_at IS NULL) AS issuedAt
    FROM employees e LEFT JOIN employee_files f ON f.employee_id=e.id
    WHERE e.full_name LIKE ? ESCAPE '\\' OR e.document_id LIKE ? ESCAPE '\\'
    ORDER BY e.is_active DESC,e.full_name LIMIT 30`,[like,like]);
  res.set('Cache-Control','no-store');
  res.json({workers:people.map(p=>({id:p.id,displayName:workerName(p),isActive:!!p.isActive,pinEnabled:!!p.pinEnabled,issuedAt:p.issuedAt}))});
}));
// Emisión múltiple únicamente de QR NUEVOS. No revocar credenciales existentes.
const batchIssueSchema=z.object({
  employeeIds:z.array(z.number().int().positive()).min(1).max(20)
}).refine(data=>new Set(data.employeeIds).size===data.employeeIds.length,
  'Hay trabajadores repetidos en la selección.');
tokenRouter.post('/workers/batch-issue',requireRoles('admin'),asyncHandler(async(req,res)=>{
  const parsed=batchIssueSchema.safeParse(req.body);
  if(!parsed.success)throw error('Selecciona entre 1 y 20 trabajadores distintos.');
  const ids=parsed.data.employeeIds;
  const c=await pool.getConnection();
  try {
    await c.beginTransaction();
    const placeholders=ids.map(()=>'?').join(',');
    const [people]=await c.execute(`SELECT e.id,e.full_name AS fullName,e.is_active AS isActive,
      f.extra_json AS extraJson,t.id AS existingToken
      FROM employees e LEFT JOIN employee_files f ON f.employee_id=e.id
      LEFT JOIN worker_tokens t ON t.employee_id=e.id AND t.revoked_at IS NULL
      WHERE e.id IN (${placeholders})`,ids);
    if(people.length!==ids.length||people.some(p=>!p.isActive||p.existingToken)){
      throw error('Lote cancelado: algún trabajador está inactivo, no existe o ya tiene QR. No se reemplazó ninguna tarjeta.',409);
    }
    const byId=new Map(people.map(p=>[p.id,p]));
    const cards=[];
    for(const id of ids){
      const person=byId.get(id),token='at_'+random();
      const qrDataUrl=await QRCode.toDataURL('asistencia:'+token,{errorCorrectionLevel:'M',width:360,margin:3});
      const [created]=await c.execute('INSERT INTO worker_tokens(employee_id,token_hash,created_by) VALUES(?,?,?)',
        [id,hash(token),req.admin.id]);
      await recordAudit(req.admin,'issue_worker_token','employee',id,
        {credentialId:created.insertId,batch:true},c);
      cards.push({employeeId:id,name:workerName(person),qrDataUrl});
    }
    await c.commit();
    res.set('Cache-Control','no-store');
    res.status(201).json({cards,message:`Se emitieron ${cards.length} tarjetas nuevas. Imprime o guarda ahora: no se pueden recuperar desde el servidor.`});
  }catch(e){await c.rollback();throw e;}finally{c.release();}
}));
tokenRouter.post('/workers/:id/issue',management,asyncHandler(async(req,res)=>{
  const id=Number(req.params.id);const token='at_'+random();const qrDataUrl=await QRCode.toDataURL(`asistencia:${token}`,{errorCorrectionLevel:'M',width:360,margin:3});
  const c=await pool.getConnection();try{await c.beginTransaction();
    const [people]=await c.execute('SELECT id,is_active FROM employees WHERE id=?',[id]);if(!people[0]?.is_active)throw error('Trabajador activo no encontrado.',404);
    await c.execute("UPDATE worker_tokens SET revoked_at=datetime('now','localtime') WHERE employee_id=? AND revoked_at IS NULL",[id]);
    const [created]=await c.execute('INSERT INTO worker_tokens(employee_id,token_hash,created_by) VALUES(?,?,?)',[id,hash(token),req.admin.id]);
    await recordAudit(req.admin,'issue_worker_token','employee',id,{credentialId:created.insertId},c);await c.commit();
    res.status(201).json({token,qrDataUrl,message:'QR emitido. El anterior ya no sirve. Guarda o imprime esta tarjeta; el token no se vuelve a mostrar.'});
  }catch(e){await c.rollback();throw e;}finally{c.release();}
}));
tokenRouter.post('/workers/:id/revoke',management,asyncHandler(async(req,res)=>{
  const id=Number(req.params.id);if(!Number.isInteger(id)||id<1)throw error('Trabajador inválido.');
  const c=await pool.getConnection();try{await c.beginTransaction();await c.execute("UPDATE worker_tokens SET revoked_at=datetime('now','localtime') WHERE employee_id=? AND revoked_at IS NULL",[id]);await recordAudit(req.admin,'revoke_worker_token','employee',id,{},c);await c.commit();res.json({message:'QR revocado.'});}catch(e){await c.rollback();throw e;}finally{c.release();}
}));
tokenRouter.put('/workers/:id/pin',management,asyncHandler(async(req,res)=>{
  const parsed=z.object({enabled:z.boolean(),pin:z.string().regex(/^\d{4,8}$/).optional()}).safeParse(req.body);
  if(!parsed.success || (parsed.data.enabled&&!parsed.data.pin))throw error('El PIN debe tener entre 4 y 8 dígitos.');
  const id=Number(req.params.id),pinHash=parsed.data.enabled?await bcrypt.hash(parsed.data.pin,12):null;
  const c=await pool.getConnection();try{await c.beginTransaction();const [people]=await c.execute('SELECT id FROM employees WHERE id=?',[id]);if(!people.length)throw error('Trabajador no encontrado.',404);
    await c.execute('UPDATE employees SET access_code_enabled=?,access_code_hash=? WHERE id=?',[parsed.data.enabled,pinHash,id]);
    await recordAudit(req.admin,parsed.data.enabled?'set_worker_pin':'disable_worker_pin','employee',id,{},c);await c.commit();res.json({message:'PIN actualizado.'});
  }catch(e){await c.rollback();throw e;}finally{c.release();}
}));
tokenRouter.get('/terminals',management,asyncHandler(async(_req,res)=>{
  const [terminals]=await pool.execute('SELECT t.id,t.name,t.company_id AS companyId,c.legal_name AS companyName,t.camera_mark_enabled AS cameraMarkEnabled,t.is_active AS isActive,t.activated_at AS activatedAt,t.created_at AS createdAt FROM attendance_terminals t LEFT JOIN company_profiles c ON c.id=t.company_id ORDER BY t.id');res.json({terminals});
}));
tokenRouter.post('/terminals',management,asyncHandler(async(req,res)=>{
  const name=String(req.body.name||'').trim();if(!name ||name.length>80)throw error('Indica el nombre de la terminal.');
  const companyId=Number(req.body.companyId);if(!Number.isSafeInteger(companyId)||companyId<1)throw error('Selecciona la empresa de la terminal.');
  const activationCode=random();const activationQrDataUrl=await QRCode.toDataURL(terminalActivationQrPayload(activationCode),{errorCorrectionLevel:'M',width:360,margin:3});const c=await pool.getConnection();try{await c.beginTransaction();
    if(!(await c.execute('SELECT id FROM company_profiles WHERE id=? AND is_active=1',[companyId]))[0].length)throw error('Selecciona una empresa activa.');
    const [created]=await c.execute('INSERT INTO attendance_terminals(name,company_id,activation_hash,activation_expires,created_by) VALUES(?,?,?,?,?)',[name,companyId,hash(activationCode),Date.now()+10*60*1000,req.admin.id]);
    await recordAudit(req.admin,'create_terminal','terminal',created.insertId,{},c);await c.commit();res.set('Cache-Control','private, no-store');res.status(201).json({id:created.insertId,activationCode,activationQrDataUrl,message:'Código o QR de un solo uso. Vence en 10 minutos.'});
  }catch(e){await c.rollback();throw e;}finally{c.release();}
}));
tokenRouter.post('/terminals/:id/config',management,asyncHandler(async(req,res)=>{
 const id=Number(req.params.id),companyId=Number(req.body.companyId);
 if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(companyId)||companyId<1||typeof req.body.cameraMarkEnabled!=='boolean')throw error('Revisa empresa y permiso de cámara.');
 const c=await pool.getConnection();try{await c.beginTransaction();
  const [companies]=await c.execute('SELECT id FROM company_profiles WHERE id=? AND is_active=1',[companyId]);
  const [rows]=await c.execute('SELECT company_id AS companyId,is_active AS active FROM attendance_terminals WHERE id=?',[id]);
  if(!companies.length||!rows[0]?.active)throw error('Empresa o terminal no disponible.');
  const changed=rows[0].companyId!==companyId;
  const activationCode=changed?random():null;
  const activationQrDataUrl=activationCode?await QRCode.toDataURL(terminalActivationQrPayload(activationCode),{errorCorrectionLevel:'M',width:360,margin:3}):null;
  await c.execute('UPDATE attendance_terminals SET company_id=?,camera_mark_enabled=? WHERE id=?',[companyId,req.body.cameraMarkEnabled?1:0,id]);
  if(changed)await c.execute('UPDATE attendance_terminals SET token_hash=NULL,activated_at=NULL,activation_hash=?,activation_expires=? WHERE id=?',[hash(activationCode),Date.now()+600000,id]);
  await recordAudit(req.admin,'configure_terminal','terminal',id,{companyId,cameraMarkEnabled:req.body.cameraMarkEnabled,reissued:changed},c);
  await c.commit();res.set('Cache-Control','private, no-store');res.json({activationCode,activationQrDataUrl,message:changed?'Empresa asignada. Reactiva el equipo con el nuevo código o QR.':'Permiso de cámara actualizado.'});
 }catch(e){await c.rollback();throw e;}finally{c.release();}
}));

tokenRouter.post('/terminals/:id/revoke',requireRoles('admin'),asyncHandler(async(req,res)=>{
  const id=Number(req.params.id);if(!Number.isInteger(id)||id<1)throw error('Terminal inválida.');const c=await pool.getConnection();try{await c.beginTransaction();await c.execute("UPDATE attendance_terminals SET is_active=0,activation_hash=NULL,token_hash=NULL,revoked_at=datetime('now','localtime') WHERE id=?",[id]);await recordAudit(req.admin,'revoke_terminal','terminal',id,{},c);await c.commit();res.json({message:'Terminal revocada.'});}catch(e){await c.rollback();throw e;}finally{c.release();}
}));
tokenRouter.post('/activate',asyncHandler(async(req,res)=>{
  const code=String(req.body.activationCode||'').trim();if(code.length<30||code.length>100)throw error('Código de activación inválido.',401);
  const token='terminal_'+random(),c=await pool.getConnection();try{await c.beginTransaction();const [rows]=await c.execute('SELECT t.id,t.name,t.company_id AS companyId,c.legal_name AS companyName,t.camera_mark_enabled AS cameraMarkEnabled FROM attendance_terminals t JOIN company_profiles c ON c.id=t.company_id AND c.is_active=1 WHERE t.activation_hash=? AND t.activation_expires>? AND t.is_active=1',[hash(code),Date.now()]);
    if(!rows.length)throw error('Código vencido o ya utilizado.',401);const terminal=rows[0];await c.execute("UPDATE attendance_terminals SET activation_hash=NULL,activation_expires=NULL,token_hash=?,activated_at=datetime('now','localtime') WHERE id=?",[hash(token),terminal.id]);await recordAudit(null,'activate_terminal','terminal',terminal.id,{},c);await c.commit();res.json({terminal,terminalToken:token});
  }catch(e){await c.rollback();throw e;}finally{c.release();}
}));
async function requireTerminal(req,res,next){try{const value=String(req.get('X-Terminal-Token')||'');if(value.length<30||value.length>100)throw error('Activa esta terminal desde Administración.',401);const [rows]=await pool.execute('SELECT t.id,t.name,t.company_id AS companyId,c.legal_name AS companyName,t.camera_mark_enabled AS cameraMarkEnabled FROM attendance_terminals t LEFT JOIN company_profiles c ON c.id=t.company_id WHERE t.token_hash=? AND t.is_active=1 AND (t.company_id IS NULL OR c.is_active=1)',[hash(value)]);if(!rows.length)throw error('Terminal no autorizada o revocada.',401);if(!rows[0].companyId)throw error('La terminal no tiene empresa asignada. Configúrala en QR, PIN y terminales.',403);req.terminal=rows[0];next();}catch(e){next(e);}}
tokenRouter.get('/terminal-workers',requireTerminal,asyncHandler(async(req,res)=>{
  const terminal={name:req.terminal.name,companyName:req.terminal.companyName,cameraMarkEnabled:!!req.terminal.cameraMarkEnabled};
  // La cámara solo requiere validar el equipo. No consultar/enviar trabajadores hasta elegir PIN.
  if(req.query.includeWorkers==='0'){
    res.set('Cache-Control','no-store');
    return res.json({terminal,workers:[]});
  }
  const [people]=await pool.execute(
    'SELECT e.id,e.full_name AS fullName,f.extra_json AS extraJson FROM employees e LEFT JOIN employee_files f ON f.employee_id=e.id WHERE e.is_active=1 AND e.access_code_enabled=1 AND f.company_id=? ORDER BY e.full_name',
    [req.terminal.companyId]);
  res.set('Cache-Control','no-store');
  res.json({terminal,workers:people.map(p=>({id:p.id,displayName:workerName(p)}))});
}));
tokenRouter.post('/identify',requireTerminal,asyncHandler(async(req,res)=>{
 const value=String(req.body.token||'').trim().replace(/^asistencia:/i,'');
 if(!/^at_[A-Za-z0-9_-]{43}$/.test(value))throw error('QR no válido o no autorizado para esta empresa.',401);
 const [rows]=await pool.execute(`SELECT e.id,e.full_name AS fullName,f.extra_json AS extraJson FROM worker_tokens w
 JOIN employees e ON e.id=w.employee_id JOIN employee_files f ON f.employee_id=e.id
 JOIN attendance_terminals t ON t.id=? JOIN company_profiles c ON c.id=t.company_id
 WHERE w.token_hash=? AND w.revoked_at IS NULL AND e.is_active=1 AND c.is_active=1
 AND t.is_active=1 AND t.token_hash=? AND f.company_id=t.company_id`,[req.terminal.id,hash(value),hash(String(req.get('X-Terminal-Token')||''))]);
 if(!rows.length)throw error('QR no válido o no autorizado para esta empresa.',401);
 res.set('Cache-Control','no-store');res.json({readOnly:true,employee:{id:rows[0].id,displayName:workerName(rows[0])},cameraMarkEnabled:!!req.terminal.cameraMarkEnabled});
}));
const markSchema=z.object({source:z.enum(['CAMERA','MANUAL']).optional(),type:z.enum(ATTENDANCE_TYPES),requestId:z.string().uuid(),token:z.string().min(30).max(120).optional(),employeeId:z.number().int().positive().optional(),pin:z.string().min(4).max(20).optional()});
tokenRouter.post('/mark',requireTerminal,asyncHandler(async(req,res)=>{
  const parsed=markSchema.safeParse(req.body);if(!parsed.success)throw error('Selecciona la acción y presenta tu QR o PIN.');const input=parsed.data;
  const time=getConfiguredDateTime(await getSystemSettings());const c=await pool.getConnection();let employee,record,method;
  try{await c.beginTransaction();
    const [currentTerminal]=await c.execute('SELECT t.company_id AS companyId,t.camera_mark_enabled AS cameraMarkEnabled FROM attendance_terminals t JOIN company_profiles p ON p.id=t.company_id AND p.is_active=1 WHERE t.id=? AND t.is_active=1 AND t.token_hash=?',[req.terminal.id,hash(String(req.get('X-Terminal-Token')||''))]);
    if(!currentTerminal.length)throw error('Terminal revocada o empresa no disponible.',401);
    const terminalCompany=currentTerminal[0].companyId;
    if(input.source==='CAMERA'&&!currentTerminal[0].cameraMarkEnabled)throw error('La marcación por cámara no está habilitada para esta terminal.',403);
    if(input.token){method='QR';const value=input.token.replace(/^asistencia:/i,'').trim();const [people]=await c.execute('SELECT e.id,e.full_name AS fullName,e.document_id AS documentId,e.is_active AS isActive,f.extra_json AS extraJson FROM worker_tokens t JOIN employees e ON e.id=t.employee_id LEFT JOIN employee_files f ON f.employee_id=e.id WHERE t.token_hash=? AND t.revoked_at IS NULL AND e.is_active=1 AND f.company_id=?',[hash(value),terminalCompany]);employee=people[0];if(!employee)throw error('QR no válido o revocado.',401);}
    else if(input.employeeId && input.pin){method='PIN';if(!(await c.execute('SELECT e.id FROM employees e JOIN employee_files f ON f.employee_id=e.id WHERE e.id=? AND e.is_active=1 AND f.company_id=?',[input.employeeId,terminalCompany]))[0].length)throw error('Trabajador no autorizado para esta empresa.',401);const now=Date.now();const [attempts]=await c.execute("SELECT COUNT(*) n FROM pin_attempts WHERE employee_id=? AND attempted_at>? AND outcome='failed'",[input.employeeId,now-15*60*1000]);
      if(attempts[0].n>=5){await recordAudit(null,'pin_rate_limited','employee',input.employeeId,{terminalId:req.terminal.id},c);await c.commit();throw error('Demasiados intentos. Espera 15 minutos o usa tu QR.',429);}
      const [people]=await c.execute('SELECT e.id,e.full_name AS fullName,e.document_id AS documentId,e.access_code_hash AS pinHash,f.extra_json AS extraJson FROM employees e LEFT JOIN employee_files f ON f.employee_id=e.id WHERE e.id=? AND e.is_active=1 AND e.access_code_enabled=1 AND f.company_id=?',[input.employeeId,terminalCompany]);employee=people[0];
      if(!employee || !await bcrypt.compare(input.pin,employee.pinHash||'')){await c.execute("INSERT INTO pin_attempts(terminal_id,employee_id,attempted_at,outcome) VALUES(?,?,?,'failed')",[req.terminal.id,input.employeeId,now]);await recordAudit(null,'failed_worker_pin','employee',input.employeeId,{terminalId:req.terminal.id},c);await c.commit();throw error('PIN incorrecto.',401);}
    }else throw error('Presenta tu QR o selecciona tu nombre e ingresa el PIN.');
    const [prior]=await c.execute('SELECT id,record_type AS type,registered_at AS registeredAt,employee_id,terminal_id FROM attendance_records WHERE request_key=?',[input.requestId]);
    if(prior.length){if(prior[0].employee_id!==employee.id||prior[0].terminal_id!==req.terminal.id||prior[0].type!==input.type)throw error('La solicitud anterior corresponde a otra marcación.',409);record=prior[0];
      const proof=await verifyAttendanceProof(c,record.id);
      if(proof.exists&&!proof.valid)throw error('Inconsistencia de integridad en marcación anterior. Requiere revisión.',409);
      const [hasReceipt]=await c.execute('SELECT record_id FROM attendance_receipts WHERE record_id=?',[record.id]);
      const receipt=hasReceipt.length?await readAttendanceReceipt(c,record.id):null;
      await c.commit();
      return res.json({employee:{id:employee.id,displayName:workerName(employee)},
        record:{id:record.id,type:record.type,registeredAt:record.registeredAt,
          integrityProof:proof.valid?{algorithm:proof.algorithm,digest:proof.digest}:null,
          integrityStatus:proof.valid?'VERIFIED':'LEGACY_UNVERIFIED',receipt},repeated:true});}
    const [created]=await c.execute('INSERT INTO attendance_records(employee_id,record_type,registered_at,device_name,mark_method,terminal_id,request_key) VALUES(?,?,?,?,?,?,?)',[employee.id,input.type,time,req.terminal.name,method,req.terminal.id,input.requestId]);
    record={id:created.insertId,type:input.type,registeredAt:time,method,terminal:req.terminal.name};
    record.integrityProof=await createAttendanceProof(c,record.id);
    record.integrityStatus='VERIFIED';
    record.receipt=await createAttendanceReceipt(c,record.id);
    await recordAudit(null,'register_attendance','attendance_record',record.id,{employeeId:employee.id,method,terminalId:req.terminal.id,companyId:req.terminal.companyId,source:input.source||'MANUAL'},c);await c.commit();
  }catch(e){await c.rollback();throw e;}finally{c.release();}
  try{record.receipt=await dispatchAttendanceReceipt(pool,record.id);}catch(e){
    console.error('No se pudo registrar el envío de comprobante:',e.code||e.message);
    record.receipt={...record.receipt,deliveryStatus:'DELIVERY_LOG_ERROR'};
  }
  await sendAttendanceNotification({employee:{id:employee.id,fullName:employee.fullName},record,source:method});
  res.set('Cache-Control','private, no-store');
  res.status(201).json({employee:{id:employee.id,displayName:workerName(employee)},record});
}));
