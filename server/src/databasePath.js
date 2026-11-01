import path from 'node:path';
import dotenv from 'dotenv';

export const projectRoot = path.resolve(import.meta.dirname, '../..');
dotenv.config({ path: path.join(projectRoot, 'server/.env') });

export function resolveDatabasePath(config = process.env) {
  if (config.DB_HOST && !config.SQLITE_PATH) {
    throw new Error('Configuracion MySQL antigua detectada. Respalda los datos y configura SQLITE_PATH antes de continuar.');
  }
  const value = config.SQLITE_PATH || 'data/asistencia.db';
  if (value === ':memory:') return value;
  const file = path.resolve(projectRoot, value);
  const relative = path.relative(projectRoot, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('SQLITE_PATH debe estar dentro de la carpeta del proyecto.');
  return file;
}
