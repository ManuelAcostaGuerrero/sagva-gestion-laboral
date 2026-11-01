import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';import dotenv from 'dotenv';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const option=key=>process.argv.includes(key)?process.argv[process.argv.indexOf(key)+1]:null;
const file=option('--file'),links=option('--links');if(!file)throw new Error('Indica --file con el informe de trabajadores.');
if(!process.argv.includes('--under-control')){const args=['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'tools/control-local.ps1'),'-Accion','CompletarFichas','-Archivo',path.resolve(file)];if(links)args.push('-Vinculos',path.resolve(links));execFileSync('powershell.exe',args,{cwd:root,stdio:'inherit'});process.exit(0);}
Object.assign(process.env,dotenv.parse(fs.readFileSync(path.join(root,'server/.env'))));
const folder=fs.mkdtempSync(path.join(root,'.local','worker-info-')),json=path.join(folder,'data.json');
try{execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'tools/read-workers.ps1'),'-Workbook',path.resolve(file),'-OutputJson',json,'-Columns','49'],{cwd:root,stdio:'inherit'});
  const {importWorkerInfo}=await import('../server/src/importWorkerInfo.js');const {pool}=await import('../server/src/db.js');try{const result=await importWorkerInfo(JSON.parse(fs.readFileSync(json,'utf8')),{approvedLinks:links?JSON.parse(fs.readFileSync(links,'utf8')):{}});console.log('Informe procesado:',JSON.stringify(result));}finally{await pool.end();}
}finally{if(fs.existsSync(json))fs.unlinkSync(json);fs.rmdirSync(folder);}
