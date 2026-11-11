import crypto from 'node:crypto';

// Primera capa de evidencia técnica. No sustituye certificación, sello de tiempo
// verificable independiente ni comprobante completo exigido por Res. 38/2024.
export const ATTENDANCE_PROOF_MIGRATION='20261111_034_attendance_proofs';

export async function migrateAttendanceProofs(db){
  if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[ATTENDANCE_PROOF_MIGRATION]))[0].length)return;
  await db.execScript(`
    CREATE TABLE attendance_integrity_proofs (
      record_id INTEGER PRIMARY KEY REFERENCES attendance_records(id) ON DELETE RESTRICT,
      algorithm TEXT NOT NULL DEFAULT 'SHA-256' CHECK(algorithm='SHA-256'),
      canonical_version INTEGER NOT NULL DEFAULT 1 CHECK(canonical_version=1),
      snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
      digest_hex TEXT NOT NULL UNIQUE CHECK(length(digest_hex)=64),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TRIGGER attendance_proof_no_update BEFORE UPDATE ON attendance_integrity_proofs
    BEGIN SELECT RAISE(ABORT,'Prueba criptografica de asistencia inmutable'); END;
    CREATE TRIGGER attendance_proof_no_delete BEFORE DELETE ON attendance_integrity_proofs
    BEGIN SELECT RAISE(ABORT,'No borrar prueba criptografica de asistencia'); END;
    CREATE TRIGGER attendance_protected_mark_fields BEFORE UPDATE OF
      employee_id,record_type,registered_at,device_name,mark_method,terminal_id,request_key
      ON attendance_records
    WHEN EXISTS(SELECT 1 FROM attendance_integrity_proofs p WHERE p.record_id=OLD.id)
    BEGIN SELECT RAISE(ABORT,'No modificar datos originales de una marcacion respaldada'); END;
  `);
  await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[ATTENDANCE_PROOF_MIGRATION]);
}

const snapshotFields=[
  ['id','recordId'],['employee_id','employeeId'],['record_type','type'],
  ['registered_at','registeredAt'],['device_name','deviceName'],
  ['mark_method','markMethod'],['terminal_id','terminalId'],['request_key','requestKey']
];
const sha256=text=>crypto.createHash('sha256').update(text,'utf8').digest('hex');
function digestMatches(snapshot,expected){
  const computed=sha256(snapshot);
  if(!/^[a-f0-9]{64}$/.test(expected||''))return false;
  return crypto.timingSafeEqual(Buffer.from(computed,'hex'),Buffer.from(expected,'hex'));
}
async function recordSnapshot(db,recordId){
  const [rows]=await db.execute(`SELECT
    r.id,r.employee_id,r.record_type,r.registered_at,r.device_name,
    r.mark_method,r.terminal_id,r.request_key,
    e.full_name AS workerName,e.document_id AS workerRut,
    f.company_id AS employerId,c.legal_name AS employerName,c.tax_id AS employerRut
    FROM attendance_records r JOIN employees e ON e.id=r.employee_id
      LEFT JOIN employee_files f ON f.employee_id=e.id
      LEFT JOIN company_profiles c ON c.id=f.company_id
    WHERE r.id=?`,[recordId]);
  return rows[0]||null;
}
function canonicalEvent(row,nonce){
  return {
    v:1,
    nonce,
    recordId:row.id,
    employeeId:row.employee_id,
    type:row.record_type,
    registeredAt:row.registered_at,
    deviceName:row.device_name,
    markMethod:row.mark_method,
    terminalId:row.terminal_id,
    requestKey:row.request_key,
    // Identidad/documentación tal cual existía al momento de la marca.
    workerName:row.workerName,
    workerRut:row.workerRut,
    employerId:row.employerId,
    employerName:row.employerName,
    employerRut:row.employerRut
  };
}

export async function createAttendanceProof(db,recordId){
  if(!Number.isSafeInteger(recordId)||recordId<1)throw new Error('Marcacion invalida para prueba de integridad');
  const row=await recordSnapshot(db,recordId);
  if(!row)throw new Error('No existe la marcacion original');
  const snapshot=JSON.stringify(canonicalEvent(row,crypto.randomBytes(16).toString('hex')));
  const digest=sha256(snapshot);
  await db.execute('INSERT INTO attendance_integrity_proofs(record_id,snapshot_json,digest_hex) VALUES(?,?,?)',
    [recordId,snapshot,digest]);
  return {algorithm:'SHA-256',digest};
}

// Compara el hash almacenado con el snapshot y los campos originales sin revelar PII.
export async function verifyAttendanceProof(db,recordId){
  const [proofs]=await db.execute('SELECT snapshot_json AS snapshot,digest_hex AS digest FROM attendance_integrity_proofs WHERE record_id=?',[recordId]);
  if(!proofs.length)return {exists:false,valid:false,reason:'NO_PROOF'};
  const p=proofs[0];
  if(!digestMatches(p.snapshot,p.digest))return {exists:true,valid:false,reason:'DIGEST_MISMATCH'};
  let snapshot;
  try { snapshot=JSON.parse(p.snapshot); } catch{return {exists:true,valid:false,reason:'SNAPSHOT_INVALID'};}
  const row=await recordSnapshot(db,recordId);
  if(!row)return {exists:true,valid:false,reason:'SOURCE_MISSING'};
  if(snapshot.v!==1 || snapshot.recordId!==recordId || snapshotFields.some(([column,key])=>row[column]!==snapshot[key]))
    return {exists:true,valid:false,reason:'SOURCE_CHANGED'};
  return {exists:true,valid:true,algorithm:'SHA-256',digest:p.digest};
}
