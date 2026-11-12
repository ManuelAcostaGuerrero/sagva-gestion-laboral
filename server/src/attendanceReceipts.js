import crypto from 'node:crypto';
import {formatRut} from './rut.js';
import {verifyAttendanceProof} from './attendanceProofs.js';

// A01: complemento aditivo de pruebas de marcación existentes, sin backfill histórico.
export const ATTENDANCE_RECEIPTS_MIGRATION='20261112_043_attendance_receipts';
const sha256=value=>crypto.createHash('sha256').update(value,'utf8').digest('hex');
const signingKey=()=>String(process.env.SAGVA_RECEIPT_SIGNING_KEY||'');
const error=(message,status=400)=>Object.assign(new Error(message),{status});
const safeEqual=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length
  &&crypto.timingSafeEqual(Buffer.from(a,'utf8'),Buffer.from(b,'utf8'));
const clean=value=>String(value??'').trim();
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export async function migrateAttendanceReceipts(db){
  if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[ATTENDANCE_RECEIPTS_MIGRATION]))[0].length)return;
  await db.execScript([
    'CREATE TABLE attendance_receipts(',
    'record_id INTEGER PRIMARY KEY REFERENCES attendance_records(id) ON DELETE RESTRICT,',
    'canonical_json TEXT NOT NULL CHECK(json_valid(canonical_json)),',
    'checksum_hex TEXT NOT NULL UNIQUE CHECK(length(checksum_hex)=64),',
    'hmac_hex TEXT CHECK(hmac_hex IS NULL OR length(hmac_hex)=64),',
    'created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);',
    'CREATE TRIGGER attendance_receipt_immutable_update BEFORE UPDATE ON attendance_receipts',
    "BEGIN SELECT RAISE(ABORT,'Comprobante inmutable'); END;",
    'CREATE TRIGGER attendance_receipt_immutable_delete BEFORE DELETE ON attendance_receipts',
    "BEGIN SELECT RAISE(ABORT,'No borrar comprobante'); END;",
    'CREATE TABLE attendance_receipt_delivery_attempts(',
    'id INTEGER PRIMARY KEY AUTOINCREMENT,',
    'record_id INTEGER NOT NULL REFERENCES attendance_receipts(record_id) ON DELETE RESTRICT,',
    'recipient_email TEXT,',
    "channel TEXT NOT NULL DEFAULT 'EMAIL' CHECK(channel='EMAIL'),",
    "status TEXT NOT NULL CHECK(status IN('CONFIG_PENDING','EMAIL_MISSING','EMAIL_DUPLICATED','ACCEPTED_BY_PROVIDER','FAILED')),",
    'provider_id TEXT,error_code TEXT,attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);',
    'CREATE INDEX attendance_receipt_delivery_record ON attendance_receipt_delivery_attempts(record_id,id);',
    'CREATE TRIGGER attendance_receipt_attempt_no_update BEFORE UPDATE ON attendance_receipt_delivery_attempts',
    "BEGIN SELECT RAISE(ABORT,'Intento de envio inmutable'); END;",
    'CREATE TRIGGER attendance_receipt_attempt_no_delete BEFORE DELETE ON attendance_receipt_delivery_attempts',
    "BEGIN SELECT RAISE(ABORT,'No borrar intento de envio'); END;",
    'CREATE TABLE attendance_receipt_delivery_events(',
    'event_id TEXT PRIMARY KEY,record_id INTEGER NOT NULL REFERENCES attendance_receipts(record_id) ON DELETE RESTRICT,',
    "provider_id TEXT NOT NULL,event_type TEXT NOT NULL CHECK(event_type IN('email.delivered','email.bounced','email.delivery_delayed')),",
    'received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);',
    'CREATE INDEX receipt_delivery_event_record ON attendance_receipt_delivery_events(record_id,received_at);',
    'CREATE TRIGGER receipt_delivery_event_no_update BEFORE UPDATE ON attendance_receipt_delivery_events',
    "BEGIN SELECT RAISE(ABORT,'Evento de entrega inmutable'); END;",
    'CREATE TRIGGER receipt_delivery_event_no_delete BEFORE DELETE ON attendance_receipt_delivery_events',
    "BEGIN SELECT RAISE(ABORT,'No borrar evento de entrega'); END;"
  ].join(' '));
  await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[ATTENDANCE_RECEIPTS_MIGRATION]);
}
function markDateTime(stamp){
  const match=/^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d):(\d\d)/.exec(clean(stamp));
  if(!match)throw error('Fecha de marcación no válida para el comprobante.',409);
  return {date:match[3]+'/'+match[2]+'/'+match[1].slice(2),time:match[4]+':'+match[5]+':'+match[6]};
}
function signChecksum(sum){
  const key=signingKey();
  return key.length>=32?crypto.createHmac('sha256',key).update(sum).digest('hex'):null;
}
export async function createAttendanceReceipt(db,recordId){
  if(!Number.isSafeInteger(Number(recordId))||Number(recordId)<1)throw error('Marca inválida.',400);
  const [existing]=await db.execute('SELECT record_id FROM attendance_receipts WHERE record_id=?',[recordId]);
  if(existing.length)return readAttendanceReceipt(db,recordId);
  const proof=await verifyAttendanceProof(db,Number(recordId));
  if(!proof.valid)throw error('No se puede generar comprobante sin integridad verificable.',409);
  const [proofRows]=await db.execute(
    'SELECT snapshot_json AS snapshot FROM attendance_integrity_proofs WHERE record_id=?',[recordId]);
  const mark=JSON.parse(proofRows[0].snapshot);
  const [meta]=await db.execute(
    'SELECT c.address,c.commune,c.city,c.region,c.default_branch AS defaultBranch,t.name AS terminalName '+
    'FROM attendance_records a LEFT JOIN company_profiles c ON c.id=? '+
    'LEFT JOIN attendance_terminals t ON t.id=a.terminal_id WHERE a.id=?',[mark.employerId,recordId]);
  if(!meta.length)throw error('Marcación sin datos de contexto.',409);
  const location=meta[0];
  const when=markDateTime(mark.registeredAt);
  const gaps=[];
  if(!clean(mark.workerRut))gaps.push('Falta RUT del trabajador');
  if(!clean(mark.employerName)||!clean(mark.employerRut))gaps.push('Faltan datos legales del empleador');
  if(!clean(location.address)||!clean(location.commune)||!clean(location.region))
    gaps.push('Faltan datos del lugar efectivo de prestación');
  gaps.push('Validar domicilio de prestación y régimen excepcional con la documentación laboral');
  const receipt={
    version:1,recordId:Number(recordId),date:when.date,time:when.time,
    type:mark.type,markMethod:mark.markMethod||'ANTERIOR',
    worker:{name:clean(mark.workerName),rut:formatRut(mark.workerRut)},
    employer:{name:clean(mark.employerName),rut:formatRut(mark.employerRut)},
    workplace:{
      name:clean(location.terminalName||location.defaultBranch||'No especificado'),
      address:clean(location.address),commune:clean(location.commune),
      city:clean(location.city),region:clean(location.region),
      addressSource:'FICHA_EMPRESA_PENDIENTE_VALIDACION'
    },
    exceptionalRegime:'SIN_VERIFICAR',
    attendanceProof:{algorithm:'SHA-256',checksum:proof.digest},
    reviewWarnings:gaps
  };
  const canonical=JSON.stringify(receipt),checksum=sha256(canonical),signature=signChecksum(checksum);
  await db.execute('INSERT INTO attendance_receipts(record_id,canonical_json,checksum_hex,hmac_hex) VALUES(?,?,?,?)',
    [recordId,canonical,checksum,signature]);
  return {receipt,checksum,signature,integrityStatus:'VERIFIED',authenticityStatus:signature?'SIGNED':'SIGNATURE_NOT_CONFIGURED',deliveryStatus:'NOT_ATTEMPTED'};
}
export async function verifyReceipt(db,recordId,checksum){
  const [rows]=await db.execute('SELECT canonical_json AS canonical,checksum_hex AS checksum,hmac_hex AS signature FROM attendance_receipts WHERE record_id=?',[recordId]);
  if(!rows.length)return {valid:false,reason:'NOT_FOUND'};
  const row=rows[0];
  if(!safeEqual(row.checksum,sha256(row.canonical)))return {valid:false,reason:'RECEIPT_CHANGED'};
  if(checksum&&!safeEqual(row.checksum,checksum))return {valid:false,reason:'CHECKSUM_MISMATCH'};
  const expected=signChecksum(row.checksum);
  if(row.signature && (!expected||!safeEqual(row.signature,expected)))return {valid:false,reason:'SIGNATURE_INVALID'};
  const proof=await verifyAttendanceProof(db,Number(recordId));
  if(!proof.valid)return {valid:false,reason:'ATTENDANCE_PROOF_INVALID'};
  let receipt;
  try{receipt=JSON.parse(row.canonical);}catch{return {valid:false,reason:'RECEIPT_INVALID'};}
  if(receipt.recordId!==Number(recordId)||receipt.attendanceProof?.checksum!==proof.digest)
    return {valid:false,reason:'SOURCE_MISMATCH'};
  return {valid:true,receipt,checksum:row.checksum,signature:row.signature,
    integrityStatus:'VERIFIED',authenticityStatus:row.signature?'SIGNED':'SIGNATURE_NOT_CONFIGURED'};
}
export async function readAttendanceReceipt(db,recordId){
  const verified=await verifyReceipt(db,recordId);
  if(!verified.valid)throw error('Comprobante no verificable: '+verified.reason,409);
  const [attempts]=await db.execute(
    'SELECT status,attempted_at AS attemptedAt FROM attendance_receipt_delivery_attempts '+
    'WHERE record_id=? ORDER BY id DESC LIMIT 1',[recordId]);
  const [events]=await db.execute('SELECT event_type AS type FROM attendance_receipt_delivery_events WHERE record_id=? ORDER BY rowid DESC LIMIT 1',[recordId]);
  const event=events[0]?.type;
  const status=event==='email.delivered'?'DELIVERED_TO_MAIL_SERVER':event==='email.bounced'?'BOUNCED':event==='email.delivery_delayed'?'DELIVERY_DELAYED':attempts[0]?.status||'NOT_ATTEMPTED';
  return {...verified,deliveryStatus:status,deliveryAttemptedAt:attempts[0]?.attemptedAt||null};
}
export function receiptText(receipt){
  const workplace=receipt.workplace;
  return [
    'COMPROBANTE DE MARCACIÓN · SAGVA Gestión Laboral',
    'Folio: '+receipt.recordId,
    'Fecha: '+receipt.date+' · Hora: '+receipt.time,
    'Tipo: '+receipt.type+' · Medio: '+receipt.markMethod,
    'Trabajador: '+receipt.worker.name+' · RUT: '+receipt.worker.rut,
    'Empleador: '+receipt.employer.name+' · RUT: '+receipt.employer.rut,
    'Lugar: '+workplace.name+' · '+[workplace.address,workplace.commune,workplace.city,workplace.region].filter(Boolean).join(', '),
    'Jornada excepcional: '+receipt.exceptionalRegime,
    'SHA-256 de marcación: '+receipt.attendanceProof.checksum,
    'SHA-256 de comprobante: '+sha256(JSON.stringify(receipt)),
    ...(receipt.reviewWarnings.length?['Revisión pendiente: '+receipt.reviewWarnings.join('; ')]:[]),
    'La autenticidad se verifica en el servidor; este documento no acredita certificación DT.'
  ].join('\n');
}
export function receiptEmailHtml(receipt){
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comprobante de marcación</title>'+
    '<style>body{font:15px system-ui,sans-serif;max-width:780px;margin:30px auto;color:#142b23}'+
    'pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.6}'+
    '@media print{body{margin:1cm}}</style></head><body><pre>'+escapeHtml(receiptText(receipt))+'</pre></body></html>';
}
export async function resendTransport({to,receipt,idempotencyKey}){
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,
      'Content-Type':'application/json','Idempotency-Key':idempotencyKey},
    body:JSON.stringify({from:process.env.SAGVA_RECEIPT_FROM,to:[to],
      subject:'Comprobante de marcación #'+receipt.recordId,
      text:receiptText(receipt),html:receiptEmailHtml(receipt)}),
    signal:AbortSignal.timeout(8000)
  });
  const parsed=await response.json().catch(()=>({}));
  if(!response.ok||!parsed.id)throw Object.assign(new Error('Rechazado por proveedor'),{code:'PROVIDER_REJECTED'});
  return {id:String(parsed.id)};
}
export async function dispatchAttendanceReceipt(db,recordId,{transport=resendTransport}={}){
  const verified=await readAttendanceReceipt(db,recordId);
  if(['ACCEPTED_BY_PROVIDER','DELIVERED_TO_MAIL_SERVER'].includes(verified.deliveryStatus))return verified;
  const [rows]=await db.execute('SELECT e.email FROM attendance_records a JOIN employees e ON e.id=a.employee_id WHERE a.id=?',[recordId]);
  const email=clean(rows[0]?.email).toLowerCase();
  let status='FAILED',providerId=null,errorCode=null;
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))status='EMAIL_MISSING';
  else{
    const [same]=await db.execute('SELECT COUNT(*) AS n FROM employees WHERE lower(trim(email))=?',[email]);
    if(Number(same[0].n)!==1)status='EMAIL_DUPLICATED';
    else if(!clean(process.env.RESEND_API_KEY)||!clean(process.env.SAGVA_RECEIPT_FROM))
      status='CONFIG_PENDING';
    else{
      try{
        const sent=await transport({to:email,receipt:verified.receipt,
          idempotencyKey:'sagva-receipt-'+recordId+'-'+verified.checksum.slice(0,20)});
        providerId=sent.id;status='ACCEPTED_BY_PROVIDER';
      }catch(e){status='FAILED';errorCode=clean(e.code)||'PROVIDER_ERROR';}
    }
  }
  await db.execute('INSERT INTO attendance_receipt_delivery_attempts '+
    '(record_id,recipient_email,status,provider_id,error_code) VALUES(?,?,?,?,?)',
    [recordId,email||null,status,providerId,errorCode]);
  return readAttendanceReceipt(db,recordId);
}


// Resend/Svix: validar firma HMAC sobre bytes originales, ventana anti-replay
// y proveedor conocido antes de aceptar confirmación de entrega.
export function verifyResendWebhook(raw,headers){
  const secret=clean(process.env.RESEND_WEBHOOK_SECRET);
  const id=clean(headers.id),timestamp=clean(headers.timestamp),signature=clean(headers.signature);
  if(!/^whsec_[A-Za-z0-9+/=]+$/.test(secret)||!id||!/^\d{10}$/.test(timestamp))
    throw error('Webhook no autorizado.',401);
  if(Math.abs(Math.floor(Date.now()/1000)-Number(timestamp))>300)
    throw error('Webhook fuera de plazo.',401);
  const payload=Buffer.isBuffer(raw)?raw:Buffer.from(raw||'');
  const encoded=crypto.createHmac('sha256',Buffer.from(secret.slice(6),'base64'))
    .update(Buffer.concat([Buffer.from(id+'.'+timestamp+'.'),payload])).digest();
  const accepted=signature.split(/\s+/).some(part=>{
    if(!/^v1,[A-Za-z0-9+/=]+$/.test(part))return false;
    const bytes=Buffer.from(part.slice(3),'base64');
    return bytes.length===encoded.length&&crypto.timingSafeEqual(bytes,encoded);
  });
  if(!accepted)throw error('Webhook no autorizado.',401);
  return payload;
}
export async function recordResendDeliveryEvent(db,raw,headers){
  const verified=verifyResendWebhook(raw,headers);
  let data;
  try{data=JSON.parse(verified.toString('utf8'));}catch{throw error('Evento inválido.',400);}
  const type=clean(data.type),providerId=clean(data.data?.email_id),eventId=clean(headers.id);
  if(!['email.delivered','email.bounced','email.delivery_delayed'].includes(type))return {ignored:true};
  if(!providerId||!eventId)throw error('Evento incompleto.',400);
  const [attempts]=await db.execute(
    "SELECT record_id AS recordId FROM attendance_receipt_delivery_attempts WHERE provider_id=? AND status='ACCEPTED_BY_PROVIDER' ORDER BY id DESC LIMIT 1",
    [providerId]);
  if(!attempts.length)throw error('Envío aún no registrado. Reintentar evento.',409);
  await db.execute(
    'INSERT OR IGNORE INTO attendance_receipt_delivery_events(event_id,record_id,provider_id,event_type) VALUES(?,?,?,?)',
    [eventId,attempts[0].recordId,providerId,type]);
  return {accepted:true};
}
