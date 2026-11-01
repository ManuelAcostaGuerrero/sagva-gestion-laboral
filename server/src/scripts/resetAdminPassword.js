import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { pool } from '../db.js';

dotenv.config();

const username = process.env.ADMIN_USER || 'admin';
const newPassword = process.env.ADMIN_RESET_PASSWORD || process.env.ADMIN_PASSWORD;

if (!newPassword || newPassword.length < 8) {
  throw new Error('Define ADMIN_RESET_PASSWORD con al menos 8 caracteres en server/.env');
}

const passwordHash = await bcrypt.hash(newPassword, 10);
const [result] = await pool.execute(
  'UPDATE admins SET password_hash = :passwordHash WHERE username = :username',
  { passwordHash, username }
);

if (!result.affectedRows) {
  throw new Error(`No existe el admin ${username}. Ejecuta primero npm run seed:admin --workspace server`);
}

console.log(`Clave restablecida para admin: ${username}`);
await pool.end();
