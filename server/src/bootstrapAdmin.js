import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { projectRoot } from './databasePath.js';

// Inicializacion explicita; nunca cambia usuarios ni claves existentes.
export async function bootstrapAdmin() {
  const [admins]=await pool.execute('SELECT id FROM admins LIMIT 1');
  if (admins.length) { console.log('Administrador existente conservado.'); return; }
  const username=process.env.ADMIN_USER || 'admin';
  const password=process.env.ADMIN_PASSWORD || crypto.randomBytes(18).toString('base64url');
  if (password.length < 8) throw new Error('La clave inicial requiere al menos 8 caracteres.');
  const destination=path.join(projectRoot,'.local','acceso-inicial.txt');
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  // Si un intento anterior quedo incompleto, no pisar sus credenciales.
  if (fs.existsSync(destination)) throw new Error('Existe .local/acceso-inicial.txt pero no hay administrador. Revisa la inicializacion anterior antes de continuar.');
  const passwordHash=await bcrypt.hash(password,10);
  fs.writeFileSync(destination,`Usuario: ${username}\nClave inicial: ${password}\nAcceso: http://localhost:5173\nCambia la clave desde Sistema despues de ingresar.\n`,{flag:'wx',mode:0o600});
  try {
    await pool.execute('INSERT INTO admins (username,password_hash,full_name,role) VALUES (:username,:passwordHash,:fullName,:role)',{
      username,passwordHash,fullName:process.env.ADMIN_FULL_NAME || 'Administrador',role:'admin'
    });
  } catch (error) { fs.unlinkSync(destination); throw error; }
  console.log('Administrador inicial creado. Credenciales en .local/acceso-inicial.txt (no se muestran en logs).');
}
