import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {summarizeScheduleDay} from '../attendanceReport.js';
import {aggregateAttendancePeriods,attendancePeriodCsv,secondsAsHms} from '../attendancePeriodReport.js';

test('A03: calcula en segundos antes del redondeo y mantiene campos legacy de minutos',()=>{
  const day={employeeId:1,fullName:'PERSONA DE PRUEBA',documentId:'FICTICIO',workDate:'2026-11-12',
    dayType:'work',shift:{id:1,name:'Turno',breakMinutes:30,workMinutes:480,
      segments:[{startMinute:480,endMinute:990,startTime:'08:00',endTime:'16:30'}]}};
  const records=[
    {type:'entrada',registeredAt:'2026-11-12 08:00:30'},
    {type:'salida_colacion',registeredAt:'2026-11-12 12:00:00'},
    {type:'entrada_colacion',registeredAt:'2026-11-12 12:30:15'},
    {type:'salida',registeredAt:'2026-11-12 16:31:45'}
  ];
  const result=summarizeScheduleDay(day,records);
  assert.equal(result.actualSeconds,28860);
  assert.equal(result.expectedSeconds,28800);
  assert.equal(result.mealSeconds,1815);
  assert.equal(result.lateSeconds,30);
  assert.equal(result.overtimeSeconds,60,'exceso técnico; no autorización');
  assert.equal(result.actualMinutes,481);
  assert.equal(result.status,'with_observations');
  assert.equal(secondsAsHms(result.actualSeconds),'08:01:00');
});

test('A03: agrupa diaria/semanal/mensualmente por trabajador, no mezcla personas',()=>{
  const make=(employeeId,workDate,actualSeconds)=>({employeeId,fullName:'PERSONA '+employeeId,
    documentId:'FICTICIO'+employeeId,workDate,dayType:'work',shiftId:1,totalRecords:2,
    status:'complete',actualSeconds,expectedSeconds:28800,mealSeconds:0,
    lateSeconds:0,earlyLeaveSeconds:0,overtimeSeconds:0,missingSeconds:0});
  const days=[make(1,'2026-11-02',28801),make(1,'2026-11-03',28803),make(2,'2026-11-03',30001)];
  const day=aggregateAttendancePeriods(days,'daily','2026-11');
  const week=aggregateAttendancePeriods(days,'weekly','2026-11');
  const month=aggregateAttendancePeriods(days,'monthly','2026-11');
  assert.equal(day.rows.length,3);
  assert.equal(week.rows.length,2);
  assert.equal(month.rows.length,2);
  assert.equal(week.rows.find(x=>x.employeeId===1).period,'2026-11-02');
  assert.equal(week.rows.find(x=>x.employeeId===1).actualSeconds,57604);
  assert.equal(month.summary.actualSeconds,87605);
  assert.equal(day.overtimeIsAuthorized,false);
});

test('A03: semana que cruza mes no suma días del mes vecino',()=>{
  const days=[{employeeId:1,fullName:'FICTICIO',documentId:'X',workDate:'2026-11-01',totalRecords:0,
    status:'absent',actualSeconds:null},{employeeId:1,fullName:'FICTICIO',documentId:'X',
    workDate:'2026-10-31',totalRecords:2,status:'complete',actualSeconds:3600}];
  const report=aggregateAttendancePeriods(days,'weekly','2026-11');
  assert.equal(report.rows.length,1);
  assert.equal(report.rows[0].period,'2026-10-26');
  assert.equal(report.rows[0].from,'2026-11-01');
  assert.equal(report.rows[0].uncalculatedDays,1);
  assert.equal(report.summary.actualSeconds,0);
});

test('A03: CSV conserva segundos, identificador, y bloquea fórmulas inyectadas',()=>{
  const r=aggregateAttendancePeriods([{employeeId:1,fullName:'=SUM(1+1)',documentId:'@cmd',
    workDate:'2026-11-12',totalRecords:2,status:'complete',actualSeconds:28801,
    expectedSeconds:28800,mealSeconds:0,lateSeconds:0,earlyLeaveSeconds:0,
    overtimeSeconds:1,missingSeconds:0}],'daily','2026-11');
  const id='export-ficticio',when='2026-11-12T12:00:00.000Z';
  const csv=attendancePeriodCsv(r,id,when);
  assert.match(csv,/08:00:01/);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes("'=SUM(1+1)"));
  assert.ok(csv.includes("'@cmd"));
  assert.ok(csv.includes(id));
});

test('A03: API de reportes protegida y exportación CSV auditada',async()=>{
  process.env.SQLITE_PATH=':memory:';
  process.env.JWT_SECRET='synthetic-a03-test';
  const {app}=await import('../app.js');
  const {pool}=await import('../db.js');
  const {runMigrations}=await import('../migrations.js');
  const {signAdmin}=await import('../auth.js');
  await runMigrations();
  const [admin]=await pool.execute("INSERT INTO admins(username,password_hash,full_name,role) VALUES('a03-test','hash','Admin de prueba','admin')");
  const [worker]=await pool.execute("INSERT INTO employees(full_name,document_id) VALUES('TRABAJADOR SINTETICO','PRUEBA-0001')");
  await pool.execute("INSERT INTO attendance_records(employee_id,record_type,registered_at) VALUES(?,'entrada','2026-11-12 08:00:10')",[worker.insertId]);
  await pool.execute("INSERT INTO attendance_records(employee_id,record_type,registered_at) VALUES(?,'salida','2026-11-12 16:00:35')",[worker.insertId]);
  const token=signAdmin({id:admin.insertId,username:'a03-test',role:'admin'});
  const server=app.listen(0,'127.0.0.1');
  await new Promise(ok=>server.once('listening',ok));
  try{
    const root='http://127.0.0.1:'+server.address().port;
    const path='/api/attendance/period-report?month=2026-11&period=daily&employeeId='+worker.insertId;
    assert.equal((await fetch(root+path)).status,401);
    assert.equal((await fetch(root+'/api/attendance/period-report?month=noviembre&period=daily',{headers:{Authorization:'Bearer '+token}})).status,400);
    const result=await fetch(root+path,{headers:{Authorization:'Bearer '+token}});
    assert.equal(result.status,200);
    assert.equal(result.headers.get('cache-control'),'private, no-store');
    const report=await result.json();
    assert.equal(report.rows.length,1);
    assert.equal(report.rows[0].actualSeconds,28825);
    assert.equal(report.rows[0].period,'2026-11-12');
    const exported=await fetch(root+path.replace('/period-report?','/period-report/export?'),{headers:{Authorization:'Bearer '+token}});
    assert.equal(exported.status,200);
    const csv=await exported.text();
    assert.ok(csv.includes('08:00:25'));
    assert.ok(csv.includes('TRABAJADOR SINTETICO'));
    const checksum=crypto.createHash('sha256').update(csv).digest('hex');
    assert.equal(exported.headers.get('x-report-sha256'),checksum);
    const [audit]=await pool.execute("SELECT details FROM audit_logs WHERE action='export_attendance_period_report' ORDER BY id DESC LIMIT 1");
    assert.equal(JSON.parse(audit[0].details).sha256,checksum);
    const [original]=await pool.execute('SELECT COUNT(*) AS n FROM attendance_records WHERE employee_id=?',[worker.insertId]);
    assert.equal(original[0].n,2);
  }finally{
    await new Promise(resolve=>server.close(resolve));
    await pool.end();
  }
});
