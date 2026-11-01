export const medicalProfileMigrationId = '20261010_014_worker_medical_profiles';

export async function migrateMedicalProfiles(db) {
  const [existing] = await db.execute('SELECT id FROM schema_migrations WHERE id=?', [medicalProfileMigrationId]);
  if (existing.length) return;
  await db.execScript(`
    CREATE TABLE worker_medical_profiles (
      employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE RESTRICT,
      filled_on TEXT,
      profile_data TEXT NOT NULL CHECK(json_valid(profile_data)),
      revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
      created_by INTEGER REFERENCES admins(id),
      updated_by INTEGER REFERENCES admins(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);
  await db.execute('INSERT INTO schema_migrations(id) VALUES(?)', [medicalProfileMigrationId]);
}
