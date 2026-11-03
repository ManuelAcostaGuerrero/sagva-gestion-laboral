import { runMigrations } from './migrations.js';

export async function ensureEmployeeAccessColumns() {
  await runMigrations();
}
