import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='test-medical-leaves-20261009';
const {app}=await import('../app.js');
const {pool}=await import('../db.js');
const {runMigrations}=await import('../migrations.js');
const {signAdmin}=await import('../auth.js');
const {inclusiveDays}=await import('../medicalLeaves.js');
const {projectRoot}=await import('../databasePath.js');

test('Fechas de licencia son inclusivas y excluyen calendarios inválidos',()=>{
  assert.equal(inclusiveDays('2026-10-12','2026-10-18'),7);
  assert.equal(inclusiveDays('2026-10-12','2026-10-12'),1);
  assert.throws(()=>inclusiveDays('2026-10-19','2026-10-18'));
  assert.throws(()=>inclusiveDays('2026-02-30','2026-03-04'));
});

test('Licencia no borra turno preexistente, devuelve fechas sin diagnósticos y bloquea asignación nueva',async()=>{
  await runMigrations();await runMigrations();
  const [a]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('leave-a','hash','Admin','admin')");
  const [oper]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('leave-oper','hash','Operador','operator')");
  const [areas]=await pool.execute('SELECT id FROM work_areas WHERE is_active=1 ORDER BY id LIMIT 1');
  const areaId=areas[0].id;
  const [worker]=await pool.execute('INSERT INTO employees(full_name,work_area_id) VALUES(?,?)',['Personal licencia',areaId]);
  const tok=signAdmin({id:a.insertId,username:'leave-a',role:'admin'});
  const tokOper=signAdmin({id:oper.insertId,username:'leave-oper',role:'operator'});
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/api';
  async function req(endpoint,method='GET',body,expected=200,token=tok){
    const response=await fetch(base+endpoint,{
      method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:body===undefined?undefined:JSON.stringify(body)
    });
    const data=await response.json();
    assert.equal(response.status,expected,endpoint+': '+JSON.stringify(data));
    return data;
  }
  const monday='2026-10-12',nextMonday='2026-10-19';
  const weekUrl='/planner/week?areaId='+areaId+'&weekStart='+monday;
  const nextUrl='/planner/week?areaId='+areaId+'&weekStart='+nextMonday;
  try {
    const models=await req('/planner/library?areaId='+areaId);
    assert.ok(models.shifts.length>0,'Biblioteca disponible');
    const shiftId=models.shifts[0].id;
    const before=await req(weekUrl);
    const days=Array.from({length:7},(_,i)=>i<2?{dayType:'work',shiftId,availability:null}:null);
    const original=await req(weekUrl,'PUT',{revision:before.revision,requiredStaff:[0,0,0,0,0,0,0],
      rows:[{id:'medical-row-a',label:'Persona con turno',employeeId:worker.insertId,days}]});
    assert.equal(original.rows[0].days[0].shiftId,shiftId);
    await req('/planner/week/publish?areaId='+areaId+'&weekStart='+monday,'POST',
      {revision:original.revision,allowIncomplete:true,replaceExisting:false});
    const [calendarBefore]=await pool.execute('SELECT * FROM employee_shift_calendar WHERE employee_id=?',[worker.insertId]);
    assert.equal(calendarBefore.length,2);
    await req('/medical-leaves/workers/'+worker.insertId,'POST',{
      startOn:'2026-10-12',endOn:'2026-10-20',folio:'LM-008',status:'RECIBIDA',notes:'Solo registro administrativo'
    },403,tokOper);
    const leave=await req('/medical-leaves/workers/'+worker.insertId,'POST',{
      startOn:'2026-10-12',endOn:'2026-10-20',folio:'LM-008',status:'RECIBIDA',notes:'Solo registro administrativo'
    },201);
    await req('/medical-leaves/workers/'+worker.insertId,'POST',{
      startOn:'2026-10-12',endOn:'2026-10-20',folio:'LM-008',status:'RECIBIDA'
    },409);
    const after=await req(weekUrl);
    assert.equal(after.rows[0].days[0].shiftId,shiftId);
    assert.equal(after.rows[0].days[1].shiftId,shiftId);
    assert.ok(after.medicalLeaveDays.some(d=>d.employeeId===worker.insertId&&d.date==='2026-10-12'));
    assert.equal(after.medicalLeaveDays.some(d=>d.date==='2026-10-19'),false);
    assert.equal(after.coverage[0].available,0);
    assert.deepEqual((await pool.execute('SELECT * FROM employee_shift_calendar WHERE employee_id=?',[worker.insertId]))[0],calendarBefore);
    const freshWeek=await req(nextUrl);
    assert.ok(freshWeek.medicalLeaveDays.some(d=>d.date==='2026-10-19'));
    const created=await req(nextUrl,'PUT',{
      revision:freshWeek.revision,requiredStaff:[0,0,0,0,0,0,0],
      rows:[{id:'medical-row-new',label:'Turno nuevo',employeeId:worker.insertId,
        days:[{dayType:'work',shiftId,availability:null},null,null,null,null,null,null]}]
    },409);
    assert.match(created.message,/licencia médica/i);
    const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
    const uploaded=await fetch(base+'/medical-leaves/'+leave.id+'/pdf',{
      method:'POST',headers:{Authorization:'Bearer '+tok,'Content-Type':'application/pdf'},body:pdf
    });
    assert.equal(uploaded.status,201,await uploaded.text());
    const files=await req('/medical-leaves/'+leave.id+'/files');
    assert.equal(files.files.length,1);
    const unauthorized=await req('/medical-leaves/'+leave.id+'/files','GET',undefined,403,tokOper);
    assert.ok(unauthorized.message);
    const download=await fetch(base+'/medical-leaves/files/'+files.files[0].id+'/pdf',{
      headers:{Authorization:'Bearer '+tok}
    });
    assert.equal(download.status,200);
    assert.deepEqual(Buffer.from(await download.arrayBuffer()),pdf);
    const edited=await req('/medical-leaves/'+leave.id,'PUT',{
      startOn:'2026-10-12',endOn:'2026-10-20',folio:'LM-008',status:'ANULADA',notes:'Error de digitación'
    });
    assert.match(edited.message,/actualizada/);
    const noCover=await req(weekUrl);
    assert.equal(noCover.medicalLeaveDays.length,0);
    assert.equal(noCover.rows[0].days[0].shiftId,shiftId);
    assert.deepEqual((await pool.execute('SELECT * FROM employee_shift_calendar WHERE employee_id=?',[worker.insertId]))[0],calendarBefore);
    const history=await req('/medical-leaves/workers/'+worker.insertId);
    assert.equal(history.leaves[0].status,'ANULADA');
    assert.equal(history.leaves[0].pdfCount,1);
    assert.ok((await pool.execute("SELECT id FROM audit_logs WHERE entity_type='medical_leave'"))[0].length>=2);
    const css=fs.readFileSync(path.join(projectRoot,'client/src/weeklyWorkspace.css'),'utf8');
    const ui=fs.readFileSync(path.join(projectRoot,'client/src/WeeklyPlanner.jsx'),'utf8');
    assert.match(css,/background: #f15c69 !important/);
    assert.ok(ui.includes('medical-leave-conflict'));
    assert.deepEqual((await pool.execute('PRAGMA foreign_key_check'))[0],[]);
  }finally{
    await new Promise(resolve=>server.close(resolve));
    await pool.end();
  }
});
