export const JOB_DUTIES_MIGRATION='20261110_031_job_duty_templates';
export async function migrateJobDuties(db){
 if((await db.execute('SELECT id FROM schema_migrations WHERE id=?',[JOB_DUTIES_MIGRATION]))[0].length)return;
 await db.execScript([
  "CREATE TABLE labor_job_duty_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, area_id INTEGER NOT NULL REFERENCES work_areas(id) ON DELETE RESTRICT, position_name TEXT NOT NULL, duties TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1, updated_by INTEGER REFERENCES admins(id), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(area_id,position_name));",
  "CREATE TABLE labor_job_duty_history (id INTEGER PRIMARY KEY AUTOINCREMENT, template_id INTEGER NOT NULL REFERENCES labor_job_duty_templates(id), revision INTEGER NOT NULL, duties TEXT NOT NULL, reason TEXT NOT NULL, changed_by INTEGER REFERENCES admins(id), changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(template_id,revision));"
 ].join('\n'));
 await db.execute('INSERT INTO schema_migrations(id) VALUES(?)',[JOB_DUTIES_MIGRATION]);
}
