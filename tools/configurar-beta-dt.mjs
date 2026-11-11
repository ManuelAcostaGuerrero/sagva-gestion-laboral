// Ejecutar sólo tras crear-base-ensayo-dt.mjs; nunca copia configuración del principal.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import bcrypt from 'bcryptjs';
if(fs.existsSync('.local/beta-dt.json'))throw Error('Configuración beta ya existe. No se rota.');
const report=JSON.parse(fs.readFileSync('.local/clean-database.json','utf8').replace(/^\uFEFF/,''));
if(report.purpose!=='DT_TEST_ONLY'||!/^\.local\/dt-ensayo-[A-Za-z0-9]+\/asistencia-ensayo\.db$/.test(report.database)||!fs.existsSync(path.join(path.dirname(report.database),'SOLO_ENSAYO_NO_PRODUCCION.txt')))throw Error('Base de ensayo no autorizada.');
const config={purpose:'DT_TEST_ONLY',database:report.database,apiPort:4022,webPort:5195,jwtSecret:crypto.randomBytes(48).toString('hex'),bankKey:crypto.randomBytes(32).toString('hex')};
const db=new DatabaseSync(config.database);
try{
 if(db.prepare('SELECT COUNT(*) n FROM employees').get().n!==0||db.prepare('SELECT COUNT(*) n FROM admins').get().n!==0)throw Error('Base no vacía.');
 const password=crypto.randomBytes(18).toString('base64url');const hash=await bcrypt.hash(password,10);
 db.exec('BEGIN IMMEDIATE');
 const id=Number(db.prepare("INSERT INTO admins(username,password_hash,full_name,role) VALUES('beta-root',?,'ROOT SINTETICO BETA','admin')").run(hash).lastInsertRowid);
 db.prepare("INSERT INTO security_user_profiles(user_id,profile) VALUES(?,'root')").run(id);
 fs.writeFileSync('.local/beta-dt.json',JSON.stringify(config,null,2),{flag:'wx'});
 fs.writeFileSync('.local/beta-access.txt','SOLO BETA FICTICIA\nUsuario: beta-root\nClave: '+password+'\nURL: http://127.0.0.1:5195\n',{flag:'wx'});
 db.exec('COMMIT');console.log('Beta configurada con secretos independientes; acceso guardado sólo en .local/beta-access.txt.');
}catch(e){if(db.isTransaction)db.exec('ROLLBACK');throw e;}finally{db.close();}
