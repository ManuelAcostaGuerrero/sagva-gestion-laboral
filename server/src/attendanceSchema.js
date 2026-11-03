import { runMigrations } from './migrations.js';

export const ATTENDANCE_TYPES = [
  'entrada',
  'salida',
  'salida_colacion',
  'entrada_colacion'
];

export async function ensureAttendanceRecordTypes() {
  await runMigrations();
}
