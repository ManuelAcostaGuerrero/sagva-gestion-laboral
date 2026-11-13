import {normalizeDocumentName} from './employeeDocuments.js';
export const EQUIPMENT_DOCUMENT_NAME='ENTREGA DE IMPLEMENTOS DE TRABAJO';
export const EQUIPMENT_MIGRATION='20261113_042_equipment_documents';
export async function migrateEquipmentDocuments(db){
 if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[EQUIPMENT_MIGRATION]))[0].length)return;
 await db.execScript([
  "CREATE TABLE equipment_document_items(id INTEGER PRIMARY KEY AUTOINCREMENT,type_id INTEGER NOT NULL REFERENCES employee_document_types(id) ON DELETE RESTRICT,name TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),created_by INTEGER REFERENCES admins(id),UNIQUE(type_id,name));",
  "CREATE TABLE equipment_delivery_lines(entry_id INTEGER NOT NULL REFERENCES employee_document_entries(id) ON DELETE RESTRICT,item_id INTEGER NOT NULL REFERENCES equipment_document_items(id) ON DELETE RESTRICT,item_name TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 1000),PRIMARY KEY(entry_id,item_id));",
  "CREATE INDEX equipment_document_items_type ON equipment_document_items(type_id,active);"
 ].join('\n'));
 await db.execute("INSERT INTO employee_document_types(name,expiry_mode,applicability) VALUES(?,'NONE','ALL') ON CONFLICT(name) DO NOTHING",[EQUIPMENT_DOCUMENT_NAME]);
 await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[EQUIPMENT_MIGRATION]);
}
export async function updateEquipmentCatalog(db,typeId,names,userId){
 const want=new Set((names||[]).map(normalizeDocumentName).filter(Boolean));
 const [previous]=await db.execute('SELECT id,name FROM equipment_document_items WHERE type_id=?',[typeId]);
 for(const item of previous){
  await db.execute('UPDATE equipment_document_items SET active=? WHERE id=?',[want.has(item.name)?1:0,item.id]);
  want.delete(item.name);
 }
 for(const name of want)await db.execute('INSERT INTO equipment_document_items(type_id,name,created_by) VALUES(?,?,?)',[typeId,name,userId]);
}
