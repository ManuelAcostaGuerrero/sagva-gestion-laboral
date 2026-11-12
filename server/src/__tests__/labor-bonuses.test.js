import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateBonusPreview} from '../laborBonuses.js';

process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='bonos-clave-aislada-para-pruebas';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');

test('bonos: simulación no deduce automáticamente salario',()=>{
 assert.equal(calculateBonusPreview(100000,30,20),66667);
 assert.equal(calculateBonusPreview(100000,30,30),100000);
 assert.throws(()=>calculateBonusPreview(100000,30,31),/inválida/);
});

test('bonos: permisos, asignación múltiple, evaluación auditable y versionada',async t=>{
 await runMigrations();await runMigrations();
 const [migration]=await pool.execute("SELECT COUNT(*) AS count FROM schema_migrations WHERE id='20261111_036_bonus_assignment_notes'");
 assert.equal(migration[0].count,1,'La migración de observaciones se aplica una sola vez');
 const [users]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('bonus-admin','hash','Administrador','admin')");
 const [worker]=await pool.execute("INSERT INTO employees(full_name,document_id) VALUES('Empleado Ficticio Bono','18.000.000-5')");
 const id=users.insertId,employeeId=worker.insertId;
 const token=signAdmin({id,username:'bonus-admin',role:'admin'});
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>server.close());
 const base='http://127.0.0.1:'+server.address().port+'/api';
 async function call(path,method='GET',body){
  const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,data:await response.json()};
 }
 const form={code:'CAJA',name:'Bono de caja',kind:'BONO',amountClp:100000,taxable:true,overtimeBase:false,withClause:true,clauseText:'Cierres correctos',evaluationRules:'Cierres correctos por período',legalReviewed:false,active:true,reason:'Prueba de creación con versionado'};
 assert.equal((await call('/labor-bonuses/catalog','POST',form)).status,403);
 process.env.SAGVA_CONFIGURATION_USER_IDS=String(id);
 const created=await call('/labor-bonuses/catalog','POST',form);
 assert.equal(created.status,201,JSON.stringify(created.data));
 const second=await call('/labor-bonuses/catalog','POST',{...form,code:'PRODUCCION',name:'Bono de producción'});
 assert.equal(second.status,201);
 const cat=await call('/labor-bonuses/catalog');
 assert.equal(cat.data.bonuses.length,2);
 assert.equal(cat.data.bonuses.find(b=>b.code==='CAJA').taxable,true);
 const assigned=await call('/labor-bonuses/workers/'+employeeId+'/assignments','POST',{bonusId:created.data.id,amountOverrideClp:30000,validFrom:'2026-11-10',notes:'Bono asignado por cierres correctos de caja'});
 assert.equal(assigned.status,201,JSON.stringify(assigned.data));
 assert.equal((await call('/labor-bonuses/workers/'+employeeId+'/assignments','POST',{bonusId:second.data.id,amountOverrideClp:null,validFrom:'2026-11-10'})).status,201);
 const bad=await call('/labor-bonuses/workers/'+employeeId+'/assignments/'+assigned.data.id+'/evaluations','POST',{period:'2026-11',plannedUnits:30,correctUnits:31,evidence:'Cierre de prueba',revision:0});
 assert.equal(bad.status,400);
 const evaluated=await call('/labor-bonuses/workers/'+employeeId+'/assignments/'+assigned.data.id+'/evaluations','POST',{period:'2026-11',plannedUnits:30,correctUnits:20,evidence:'Veinte cierres de treinta',revision:0});
 assert.equal(evaluated.status,200,JSON.stringify(evaluated.data));
 assert.equal(evaluated.data.suggestedClp,20000,'La simulación utiliza el monto específico del trabajador');
 assert.equal(evaluated.data.status,'PENDIENTE_REVISION');
 const listed=await call('/labor-bonuses/workers/'+employeeId);
 assert.equal(listed.data.assignments.length,2);
 const caja=listed.data.assignments.find(a=>a.bonusId===created.data.id);
 assert.equal(caja.amountOverrideClp,30000);
 assert.equal(caja.notes,'Bono asignado por cierres correctos de caja');
 assert.equal(caja.taxable,true);
 assert.equal(caja.withClause,true);
 assert.equal(caja.clauseText,'Cierres correctos');
 const legacyUpdate=await call('/labor-bonuses/workers/'+employeeId+'/assignments/'+caja.id,'PUT',
  {revision:caja.revision,active:true,amountOverrideClp:30000,validFrom:'2026-11-10'});
 assert.equal(legacyUpdate.status,200,JSON.stringify(legacyUpdate.data));
 let updated=(await call('/labor-bonuses/workers/'+employeeId)).data.assignments.find(a=>a.id===caja.id);
 assert.equal(updated.notes,caja.notes,'Cliente antiguo sin notes no debe borrar observaciones');
 const withChanges=await call('/labor-bonuses/workers/'+employeeId+'/assignments/'+caja.id,'PUT',
  {revision:updated.revision,active:true,amountOverrideClp:40000,validFrom:'2026-11-10',notes:'Nueva observación documentada'});
 assert.equal(withChanges.status,200,JSON.stringify(withChanges.data));
 updated=(await call('/labor-bonuses/workers/'+employeeId)).data.assignments.find(a=>a.id===caja.id);
 assert.equal(updated.amountOverrideClp,40000);
 assert.equal(updated.notes,'Nueva observación documentada');
 const [assignmentHistory]=await pool.execute('SELECT COUNT(*) AS count FROM employee_bonus_assignment_history WHERE assignment_id=?',[caja.id]);
 assert.equal(assignmentHistory[0].count,3,'Historial conserva asignación y las dos revisiones');
 assert.equal(listed.data.evaluations.length,1);
 const [history]=await pool.execute('SELECT COUNT(*) AS count FROM employee_bonus_evaluation_history');
 assert.equal(history[0].count,1);
 const [terms]=await pool.execute('SELECT COUNT(*) AS count FROM employee_contract_terms');
 assert.equal(terms[0].count,0);
});
