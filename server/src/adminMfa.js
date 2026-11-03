import { runMigrations } from './migrations.js';

export async function ensureAdminMfaColumns() {
  await runMigrations();
}
