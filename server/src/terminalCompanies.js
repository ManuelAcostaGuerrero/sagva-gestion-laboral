export async function migrateTerminalCompanies(db) {
 const id='20261019_020_terminal_companies';
 if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[id]))[0].length)return;
 await db.execScript(`ALTER TABLE attendance_terminals ADD COLUMN company_id INTEGER REFERENCES company_profiles(id) ON DELETE RESTRICT;
 ALTER TABLE attendance_terminals ADD COLUMN camera_mark_enabled INTEGER NOT NULL DEFAULT 0 CHECK(camera_mark_enabled IN (0,1));
 CREATE INDEX terminal_company ON attendance_terminals(company_id);`);
 await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[id]);
}
