export const BONUS_MIGRATION='20261110_024_bonus_types';
export async function migrateBonusCatalog(db){
 if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[BONUS_MIGRATION]))[0].length)return;
 await db.execScript([
  "CREATE TABLE labor_bonus_types (id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT NOT NULL UNIQUE,name TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('BONO_REMUNERACIONAL','ASIGNACION_PERDIDA_CAJA')),active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),revision INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);",
  "CREATE TABLE labor_bonus_type_history (id INTEGER PRIMARY KEY AUTOINCREMENT,type_id INTEGER NOT NULL REFERENCES labor_bonus_types(id) ON DELETE RESTRICT,before_json TEXT,after_json TEXT NOT NULL,reason TEXT NOT NULL,changed_by INTEGER REFERENCES admins(id),changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);"
 ].join('\n'));
 const defaults=[
  ['PRODUCCION','BONO DE PRODUCCIÓN','BONO_REMUNERACIONAL'],
  ['METAS','BONO POR CUMPLIMIENTO DE METAS','BONO_REMUNERACIONAL'],
  ['ASISTENCIA','BONO POR ASISTENCIA','BONO_REMUNERACIONAL'],
  ['PERDIDA_CAJA','ASIGNACIÓN POR PÉRDIDA DE CAJA','ASIGNACION_PERDIDA_CAJA']
 ];
 for(const [code,name,kind] of defaults){
  const [created]=await db.execute('INSERT INTO labor_bonus_types(code,name,kind) VALUES(?,?,?)',[code,name,kind]);
  await db.execute('INSERT INTO labor_bonus_type_history(type_id,after_json,reason) VALUES(?,?,?)',
   [created.insertId,JSON.stringify({code,name,kind,active:true,revision:1}),'Precarga inicial de conceptos, sin cálculos']);
 }
 await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[BONUS_MIGRATION]);
}
