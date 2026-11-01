import {validContractDate} from './employeeContracts.js';

export const leaveBlocksSchedule = status => ['RECIBIDA','EN_TRAMITACION','APROBADA'].includes(status);
export function inclusiveDays(start,end) {
  if(!validContractDate(start)||!validContractDate(end)||end<start)
    throw Object.assign(new Error('El período de licencia debe tener fechas válidas y término no anterior al inicio.'),{status:400});
  return Math.round((Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000)+1;
}
export async function migrateMedicalLeaves(db) {
  const id='20261009_012_medical_leaves';
  if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[id]))[0].length)return;
  await db.execScript([
    'CREATE TABLE medical_leaves (',
    'id INTEGER PRIMARY KEY AUTOINCREMENT,',
    'employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,',
    'folio TEXT,issued_on TEXT,received_on TEXT,',
    'start_on TEXT NOT NULL,end_on TEXT NOT NULL,',
    "status TEXT NOT NULL DEFAULT 'RECIBIDA' CHECK(status IN ('RECIBIDA','EN_TRAMITACION','APROBADA','RECHAZADA','ANULADA')),",
    'notes TEXT,created_by INTEGER REFERENCES admins(id),updated_by INTEGER REFERENCES admins(id),',
    "created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),",
    "updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),",
    'UNIQUE(employee_id,folio),CHECK(end_on>=start_on)',
    ');',
    'CREATE INDEX medical_leaves_dates ON medical_leaves(start_on,end_on,status,employee_id);',
    'CREATE INDEX medical_leaves_worker ON medical_leaves(employee_id,id DESC);',
    'CREATE TABLE medical_leave_files (',
    'id INTEGER PRIMARY KEY AUTOINCREMENT,',
    'leave_id INTEGER NOT NULL REFERENCES medical_leaves(id) ON DELETE RESTRICT,',
    'pdf BLOB NOT NULL,sha256 TEXT NOT NULL,uploaded_by INTEGER REFERENCES admins(id),',
    "uploaded_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),",
    'UNIQUE(leave_id,sha256)',
    ');'
  ].join('\n'));
  await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[id]);
}

// Los planificadores solo reciben identidad y fechas; nunca folio, PDF ni observaciones clínicas.
export async function medicalLeaveDays(from,to,db) {
  const [rows]=await db.execute("SELECT employee_id AS employeeId,start_on AS startOn,end_on AS endOn FROM medical_leaves WHERE status IN ('RECIBIDA','EN_TRAMITACION','APROBADA') AND start_on<=? AND end_on>=?",[to,from]);
  const days=[];
  for(const r of rows) {
    const start=r.startOn>from?r.startOn:from;
    const end=r.endOn<to?r.endOn:to;
    for(let stamp=Date.parse(start+'T00:00:00Z');stamp<=Date.parse(end+'T00:00:00Z');stamp+=86400000)
      days.push({employeeId:r.employeeId,date:new Date(stamp).toISOString().slice(0,10)});
  }
  return days;
}
