import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync, backup } from 'node:sqlite';
import dotenv from 'dotenv';
import { projectRoot as root, resolveDatabasePath } from '../server/src/databasePath.js';

const action=process.argv[2];
const envPath=path.join(root,'server/.env');
if (action === 'configure') {
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, `SQLITE_PATH=data/asistencia.db\nJWT_SECRET=${crypto.randomBytes(48).toString('base64url')}\nPORT=4000\nCLIENT_ORIGIN=http://localhost:5173\nVAPID_PUBLIC_KEY=\nVAPID_PRIVATE_KEY=\nVAPID_SUBJECT=mailto:admin@example.com\n`, { flag:'wx' });
  }
  const client=path.join(root,'client/.env');
  if (!fs.existsSync(client)) fs.writeFileSync(client,'VITE_API_URL=\n',{flag:'wx'});
  console.log('Configuracion lista. Archivos existentes conservados.');
  process.exit(0);
}
if (!fs.existsSync(envPath)) throw new Error('Falta server/.env. Ejecuta Preparar.bat.');
const config=dotenv.parse(fs.readFileSync(envPath));
if (['check','migrate','prepare'].includes(action)) {
  if (!config.JWT_SECRET || config.JWT_SECRET.length < 32 || /cambia_este/i.test(config.JWT_SECRET)) throw new Error('Configura JWT_SECRET con al menos 32 caracteres.');
  if (Number(config.PORT || 4000) !== 4000) throw new Error('Este control utiliza PORT=4000.');
}
const filename=resolveDatabasePath(config);
if (filename === ':memory:') throw new Error('El sistema local necesita una base persistente, no :memory:.');
if (action === 'check') process.exit(0);
if (action === 'backup') {
  if (!fs.existsSync(filename)) {
    console.log('No existe base SQLite todavia; respaldo de configuracion realizado.');
  } else {
    const database=new DatabaseSync(filename,{readOnly:true,timeout:5000});
    const destination=path.join(process.argv[3],'asistencia.db');
    try {
      await backup(database,destination);
      const saved=new DatabaseSync(destination,{readOnly:true});
      try {
        if (saved.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Respaldo SQLite con errores de integridad.');
        if (saved.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Respaldo con referencias invalidas.');
      } finally { saved.close(); }
      fs.writeFileSync(path.join(process.argv[3],'database-path.txt'),path.relative(root,filename));
      console.log('Respaldo SQLite verificado.');
    } catch (error) {
      if (fs.existsSync(destination)) fs.renameSync(destination,destination+'.incomplete');
      throw error;
    } finally { database.close(); }
  }
} else if (action === 'migrate' || action === 'prepare') {
  Object.assign(process.env,config);
  const { runMigrations }=await import('../server/src/migrations.js');
  const { pool }=await import('../server/src/db.js');
  try {
    await runMigrations();
    if (action === 'prepare') {
      const { bootstrapAdmin }=await import('../server/src/bootstrapAdmin.js');
      await bootstrapAdmin();
    }
    console.log('SQLite listo; migraciones aplicadas una sola vez.');
  } finally { await pool.end(); }
} else if (action === 'diagnose') {
  if (!fs.existsSync(filename)) throw new Error('Base no creada. Ejecuta Preparar.bat.');
  const database=new DatabaseSync(filename,{readOnly:true,timeout:5000});
  try {
    if (database.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Fallo de integridad SQLite.');
    if (database.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Referencias invalidas.');
    console.log(`Base SQLite correcta: ${filename}`);
  } finally { database.close(); }
} else throw new Error('Accion desconocida.');
