import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateBonusPreview} from '../laborBonuses.js';

process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='bonos-clave-aislada-para-pruebas';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');

test('función de proyección legada sigue disponible, sin uso en la nueva ficha',()=>{
 assert.equal(calculateBonusPreview(100000,30,20),66667);
 assert.throws(()=>calculateBonusPreview(100000,30,31),/inválida/);
});

test('bonos: formulario mínimo, historial, bloqueo contractual y sin cálculo desde asistencia',async t=>{
 await runMigrations();await runMigrations();
 const [migration]=await pool.execute("SELECT COUNT(*) AS count FROM schema_migrations WHERE id='20261111_036_bonus_assignment_notes'");
 assert.equal(migration[0].count,1,'Migración histórica idempotente');
 const [user]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('bonus-simple-admin','hash','Admin sintético','admin')");
 const [worker]=await pool.execute("INSERT INTO employees(full_name,document_id) VALUES('Empleado Ficticio Nuevo Bono','18.000.000-5')");
 const token=signAdmin({id:user.insertId,username:'bonus-simple-admin',role:'admin'});
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>server.close());
 const base='http://127.0.0.1:'+server.address().port+'/api';
 async function call(path,method='GET',body){
  const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,data:await response.json()};
 }
 const simple={name:'Bono de cierre correcto de cajas',amountClp:50000,taxable:true,
  conditions:'Si el 90 % de cajas cierra correctamente, corresponde el 100 % del bono; de 80 % a 89 %, corresponde el 80 %. Requiere respaldo contractual.'};
 assert.equal((await call('/labor-bonuses/catalog','POST',simple)).status,403,
  'No se puede crear sin permisos del catálogo');
 process.env.SAGVA_CONFIGURATION_USER_IDS=String(user.insertId);
 const created=await call('/labor-bonuses/catalog','POST',simple);
 assert.equal(created.status,201,JSON.stringify(created.data));
 let catalog=(await call('/labor-bonuses/catalog')).data.bonuses;
 let bonus=catalog.find(b=>b.id===created.data.id);
 assert.match(bonus.code,/^BONO_[A-F0-9]{12}$/,'Código generado internamente');
 assert.equal(bonus.taxable,true);
 assert.equal(bonus.overtimeBase,false,'No deducir base de horas extra desde imponibilidad');
 assert.equal(bonus.withClause,true,'Condiciones unificadas, sin checkbox');
 assert.equal(bonus.conditions,simple.conditions);
 assert.equal(bonus.assignedCount,0);
 assert.equal(bonus.evaluationRules,'');
 const [snapshots]=await pool.execute('SELECT snapshot_json AS data FROM labor_bonus_definition_history WHERE bonus_id=?',[bonus.id]);
 assert.equal(snapshots.length,1);
 assert.equal('reason' in JSON.parse(snapshots[0].data),false,'El motivo libre no es requisito');
 // Editar una plantilla que todavía NO se ha asignado está permitido y auditado.
 const edit=await call('/labor-bonuses/catalog/'+bonus.id,'PUT',
  {...simple,amountClp:60000,revision:bonus.revision});
 assert.equal(edit.status,200,JSON.stringify(edit.data));
 catalog=(await call('/labor-bonuses/catalog')).data.bonuses;
 bonus=catalog.find(b=>b.id===created.data.id);
 assert.equal(bonus.amountClp,60000);
 assert.equal(bonus.revision,2);
 // Formato anterior sigue legible sin destruir cláusula y métricas históricas.
 const oldForm={code:'BONO_LEGADO',name:'Bono anterior',kind:'BONO',amountClp:30000,
  taxable:false,overtimeBase:false,withClause:true,clauseText:'Cláusula documental original',
  evaluationRules:'Métrica original por cierre mensual',legalReviewed:false,active:true,
  reason:'Motivo de versión legada'};
 const legacy=await call('/labor-bonuses/catalog','POST',oldForm);
 assert.equal(legacy.status,201);
 const past=(await call('/labor-bonuses/catalog')).data.bonuses.find(b=>b.id===legacy.data.id);
 assert.match(past.conditions,/Cláusula documental original/);
 assert.match(past.conditions,/Métrica original por cierre mensual/);
 assert.equal(past.taxable,false);

 const id=worker.insertId;
 const createdAssignment=await call('/labor-bonuses/workers/'+id+'/assignments','POST',
  {bonusId:bonus.id,amountOverrideClp:40000,validFrom:'2026-11-12',notes:'Asignación sintética documentada'});
 assert.equal(createdAssignment.status,201,JSON.stringify(createdAssignment.data));
 const another=await call('/labor-bonuses/workers/'+id+'/assignments','POST',
  {bonusId:legacy.data.id,amountOverrideClp:null,validFrom:'2026-11-12'});
 assert.equal(another.status,201);
 const assignments=(await call('/labor-bonuses/workers/'+id)).data.assignments;
 assert.equal(assignments.length,2);
 const a=assignments.find(x=>x.bonusId===bonus.id);
 assert.equal(a.amountOverrideClp,40000);
 assert.equal(a.taxable,true);
 assert.equal(a.conditions,simple.conditions);
 assert.equal(a.notes,'Asignación sintética documentada');
 // Cambios contractuales: bloqueados por API aunque se intente omitir la UI.
 const forbidden=await call('/labor-bonuses/catalog/'+bonus.id,'PUT',
  {...simple,amountClp:99999,revision:bonus.revision});
 assert.equal(forbidden.status,409,'Modificación de catálogo con empleado requiere anexo');
 const blockedAmount=await call('/labor-bonuses/workers/'+id+'/assignments/'+a.id,'PUT',
  {revision:a.revision,active:true,amountOverrideClp:55000,validFrom:a.validFrom});
 assert.equal(blockedAmount.status,409,'Monto asignado requiere anexo');
 assert.equal((await call('/labor-bonuses/workers/'+id+'/assignments/'+a.id,'PUT',
  {revision:a.revision,active:false,amountOverrideClp:40000,validFrom:a.validFrom})).status,409,'Suspender requiere anexo');
 assert.equal((await call('/labor-bonuses/workers/'+id+'/assignments/'+a.id,'PUT',
  {revision:a.revision,active:true,amountOverrideClp:40000,validFrom:'2026-12-01'})).status,409,'Cambiar vigencia requiere anexo');
 // Cliente anterior que omite notes no puede borrarlas silenciosamente.
 const noop=await call('/labor-bonuses/workers/'+id+'/assignments/'+a.id,'PUT',
  {revision:a.revision,active:true,amountOverrideClp:40000,validFrom:a.validFrom});
 assert.equal(noop.status,200);
 const notes=await call('/labor-bonuses/workers/'+id+'/assignments/'+a.id,'PUT',
  {revision:a.revision,active:true,amountOverrideClp:40000,validFrom:a.validFrom,notes:'Nota administrativa actualizada'});
 assert.equal(notes.status,200,JSON.stringify(notes.data));
 const after=(await call('/labor-bonuses/workers/'+id)).data.assignments.find(x=>x.id===a.id);
 assert.equal(after.notes,'Nota administrativa actualizada');
 assert.equal(after.amountOverrideClp,40000);
 const [history]=await pool.execute('SELECT COUNT(*) AS count FROM employee_bonus_assignment_history WHERE assignment_id=?',[a.id]);
 assert.equal(history[0].count,2,'Alta y observación: historial sin crear revisiones ficticias');
 const oldEvaluation=await call('/labor-bonuses/workers/'+id+'/assignments/'+a.id+'/evaluations','POST',
  {period:'2026-11',plannedUnits:30,correctUnits:25,evidence:'Evidencia sintética',revision:0});
 assert.equal(oldEvaluation.status,410,'Asistencia no realiza cálculos o evaluaciones pagables');
 const [legacyEvaluations]=await pool.execute('SELECT COUNT(*) AS count FROM employee_bonus_evaluations');
 assert.equal(legacyEvaluations[0].count,0);
 const [terms]=await pool.execute('SELECT COUNT(*) AS count FROM employee_contract_terms');
 assert.equal(terms[0].count,0,'El bono no modifica contratos ni sus términos automáticamente');
});
