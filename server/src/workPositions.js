export const normalizeWorkLabel=value=>String(value??'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleUpperCase('es-CL');
export async function migrateWorkPositions(db) {
 const id='20261009_009_work_positions_uppercase';
 if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[id]))[0].length) return;
 await db.execScript(`CREATE TABLE IF NOT EXISTS work_positions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT COLLATE NOCASE NOT NULL UNIQUE,
 description TEXT,
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN(0,1)),
 created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
 deactivated_at TEXT,
 deactivated_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
 deactivation_reason TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TRIGGER IF NOT EXISTS work_positions_updated_at AFTER UPDATE ON work_positions
BEGIN UPDATE work_positions SET updated_at=datetime('now','localtime') WHERE id=NEW.id; END;`);
 const [areas]=await db.execute('SELECT id,name FROM work_areas ORDER BY id');
 const seen=new Set();
 for(const a of areas) {const name=normalizeWorkLabel(a.name);if(seen.has(name)) throw new Error('Áreas duplicadas tras normalizar: '+name);seen.add(name);}
 for(const a of areas) {const name=normalizeWorkLabel(a.name);if(name!==a.name) await db.execute('UPDATE work_areas SET name=? WHERE id=?',[name,a.id]);}
 const [people]=await db.execute('SELECT id,position_name AS name FROM employees WHERE position_name IS NOT NULL');
 for(const person of people) {
   const name=normalizeWorkLabel(person.name);
   if(name) await db.execute('INSERT INTO work_positions(name) VALUES(?) ON CONFLICT(name) DO NOTHING',[name]);
   if((name||null)!==person.name) await db.execute('UPDATE employees SET position_name=? WHERE id=?',[name||null,person.id]);
 }
 await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[id]);
}
export async function resolvePosition(value,db,oldValue=null) {
 const name=normalizeWorkLabel(value);
 if(!name) return null;
 const [matches]=await db.execute('SELECT name,is_active AS active FROM work_positions WHERE name=?',[name]);
 if(matches.length&&(matches[0].active||name===normalizeWorkLabel(oldValue)))return matches[0].name;
 if(name===normalizeWorkLabel(oldValue))return name; // El valor histórico no impide guardar otro campo.
 throw Object.assign(new Error('Selecciona un cargo activo del catálogo Cargos.'),{status:400});
}
