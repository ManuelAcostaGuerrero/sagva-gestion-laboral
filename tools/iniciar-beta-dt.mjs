// Beta aislada: no lee ni escribe configuración del sistema principal.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const config=JSON.parse(fs.readFileSync(path.join(root,'.local/beta-dt.json'),'utf8'));
if(config.purpose!=='DT_TEST_ONLY'||![config.apiPort,config.webPort].every(p=>Number.isInteger(p)&&p>1024&&p<65536&&![4010,5183,5184].includes(p))||config.apiPort===config.webPort)throw Error('Puertos beta inválidos.');
const db=path.resolve(root,config.database),relative=path.relative(root,db).replaceAll('\\','/');
if(!relative.startsWith('.local/dt-ensayo-')||relative.includes('..')||!fs.existsSync(db)||!fs.existsSync(path.join(path.dirname(db),'SOLO_ENSAYO_NO_PRODUCCION.txt')))throw Error('Base beta no autorizada.');
const listeners=[];
try {
 for(const port of [config.apiPort,config.webPort]){const server=createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});listeners.push(server);}
}finally{await Promise.all(listeners.map(s=>new Promise(r=>s.close(r))));}
for(const key of ['DB_HOST','DB_USER','DB_PASSWORD','SAGVA_ROOT_USER_ID'])delete process.env[key];
Object.assign(process.env,{SQLITE_PATH:relative,JWT_SECRET:config.jwtSecret,SAGVA_BANK_DATA_KEY:config.bankKey,PORT:String(config.apiPort),HOST:'127.0.0.1',CLIENT_ORIGIN:'http://127.0.0.1:'+config.webPort});
const {app}=await import('../server/src/app.js');const {pool}=await import('../server/src/db.js');const {runMigrations}=await import('../server/src/migrations.js');const {createWebApp}=await import('./start-web.mjs');
await runMigrations();
const api=app.listen(config.apiPort,'127.0.0.1');await new Promise((r,j)=>{api.once('listening',r);api.once('error',j);});
const web=createWebApp({apiTarget:'http://127.0.0.1:'+config.apiPort}).listen(config.webPort,'127.0.0.1');await new Promise((r,j)=>{web.once('listening',r);web.once('error',j);});
console.log('BETA FICTICIA: http://127.0.0.1:'+config.webPort+' — API '+config.apiPort+'; nunca usar Actualizar.bat aquí.');
let closing=false;const close=async()=>{if(closing)return;closing=true;await Promise.all([api,web].map(s=>new Promise(r=>s.close(r))));await pool.end();};
process.on('SIGINT',()=>close().then(()=>process.exit(0)));process.on('SIGTERM',()=>close().then(()=>process.exit(0)));
