import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {projectRoot} from '../databasePath.js';

test('DT: base de ensayo nueva y aislada sin sobreescritura ni datos reales',()=>{
 const run=spawnSync(process.execPath,['tools/crear-base-ensayo-dt.mjs'],{
   cwd:projectRoot,encoding:'utf8',timeout:30000,env:{...process.env}
 });
 assert.equal(run.status,0,run.stderr||run.stdout);
 const report=JSON.parse(run.stdout);
 assert.equal(report.purpose,'DT_TEST_ONLY');
 assert.equal(report.integrity,'ok');
 assert.equal(report.productionModified,false);
 assert.equal(report.workers,0);
 const folder=path.dirname(path.join(projectRoot,report.database));
 assert.equal(path.dirname(folder),path.join(projectRoot,'.local'));
 assert.match(path.basename(folder),/^dt-ensayo-[a-zA-Z0-9]{6,}$/);
 const target=path.join(folder,'asistencia-ensayo.db');
 const db=new DatabaseSync(target,{readOnly:true});
 try{
   assert.equal(db.prepare('SELECT COUNT(*) n FROM employees').get().n,0);
   assert.equal(db.prepare('SELECT COUNT(*) n FROM employment_relationships').get().n,0);
   assert.equal(db.prepare('SELECT COUNT(*) n FROM employee_prevision_versions').get().n,0);
   assert.equal(db.prepare('SELECT COUNT(*) n FROM dt_jornada_normative_versions').get().n,4);
   assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{
   db.close();
   // Únicamente se retira el entorno efímero que generó esta prueba.
   fs.rmSync(folder,{recursive:true,force:true});
 }
});
