import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

// Todas las marcaciones de prueba quedan en memoria; nunca en data/asistencia.db.
process.env.SQLITE_PATH=':memory:';
process.env.JWT_SECRET='sqlite-test-secret-not-for-production-000000';
const { app }=await import('../app.js');
const { pool }=await import('../db.js');
const { runMigrations }=await import('../migrations.js');

test('API SQLite: login, empleados, identificación QR/PIN, marcacion, reportes, horarios y auditoria',async()=> {
  await runMigrations();
  await pool.execute('INSERT INTO admins(username,password_hash,full_name) VALUES(:username,:hash,:name)',{
    username:'testadmin',hash:await bcrypt.hash('TestPassword2026',10),name:'Administrador prueba'
  });
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}/api`;
  let token, terminalToken;
  async function request(route,method='GET',body,status=200) {
    const result=await fetch(base+route,{method,headers:{'content-type':'application/json',...(terminalToken?{'X-Terminal-Token':terminalToken}:{}),...(token?{authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    const raw=await result.text();
    assert.ok(result.headers.get('content-type')?.includes('application/json'),`${method} ${route}: ${result.status} ${raw.slice(0,150)}`);
    const data=JSON.parse(raw);
    assert.equal(result.status,status,`${method} ${route}: ${JSON.stringify(data)}`);
    return data;
  }
  try {
    assert.equal((await request('/health')).ok,true);
    await request('/employees','GET',undefined,401);
    await request('/auth/login','POST',{username:'testadmin',password:'incorrecta'},401);
    token=(await request('/auth/login','POST',{username:'TESTADMIN',password:'TestPassword2026'})).token;
    const area=(await request('/areas','POST',{name:'Sala',requiredStaff:2},201)).id;
    assert.equal((await request('/areas?includeInactive=1')).areas.find(a=>a.id===area).name,'SALA');
    await request('/areas','POST',{name:'sala'},409);
    const job=(await request('/positions','POST',{name:'Cajero'},201)).id;
    await request('/positions','POST',{name:'CAJERO'},409);
    assert.equal((await request('/positions')).positions.find(p=>p.id===job).name,'CAJERO');
    await request('/employees','POST',{documentId:'99999999-1',fullName:'Cargo fuera de catálogo',positionName:'otro cargo'},400);
    const employee=(await request('/employees','POST',{documentId:'12345678-9',fullName:'Persona prueba',workAreaId:area,positionName:'cajero'},201)).id;
    assert.equal((await request('/employees')).employees.find(e=>e.id===employee).positionName,'CAJERO');
    await request(`/positions/${job}`,'PUT',{name:'Cajero Principal'},200);
    assert.equal((await request('/employees')).employees.find(e=>e.id===employee).positionName,'CAJERO PRINCIPAL');
    await request(`/positions/${job}`,'DELETE',{reason:'Cambio de cargo laboral'},200);
    await request('/employees','POST',{documentId:'99999999-1',fullName:'Cargo desactivado',positionName:'CAJERO PRINCIPAL'},400);
    await request(`/positions/${job}/reactivate`,'POST',undefined,200);
    await request('/employees','POST',{documentId:'12345678-9',fullName:'Duplicado'},409);
    const groups=await request('/schedules');
    const groupId=groups.groups.find(group=>group.name==='Rotativo').id;
    const shift=(await request('/schedules/shifts','POST',{name:'Turno dia',groupId,startTime:'09:00',endTime:'18:00',breakMinutes:60},201)).id;
    await request(`/schedules/employees/${employee}`,'PUT',{shiftId:shift});
    await request(`/schedules/calendar/${employee}`,'PUT',{workDate:'2026-10-02',shiftId:shift,dayType:'work'});
    await request(`/schedules/calendar/${employee}`,'PUT',{workDate:'2026-10-02',shiftId:shift,dayType:'work'});
    await request(`/employees/${employee}/access-code`,'PUT',{enabled:true,code:'4321'});
    await request('/attendance/register-code','POST',{documentId:'12345678-9',code:'4321',type:'entrada'},410);
    const [terminalCompany]=await pool.execute("INSERT INTO company_profiles(legal_name) VALUES('EMPRESA QR PRUEBA')");
    await pool.execute('INSERT INTO employee_files(employee_id,company_id) VALUES(?,?) ON CONFLICT(employee_id) DO UPDATE SET company_id=excluded.company_id',[employee,terminalCompany.insertId]);
    const activation=await request('/tokens/terminals','POST',{name:'Prueba',companyId:terminalCompany.insertId},201);
    terminalToken=(await request('/tokens/activate','POST',{activationCode:activation.activationCode})).terminalToken;
    await request('/tokens/mark','POST',{employeeId:employee,pin:'wrong',type:'entrada',requestId:'00000000-0000-4000-8000-000000000001'},401);
    const codeMark=await request('/tokens/mark','POST',{employeeId:employee,pin:'4321',type:'entrada',requestId:'00000000-0000-4000-8000-000000000002'},201);
    assert.match(codeMark.record.registeredAt,/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.match(codeMark.record.integrityProof.digest,/^[a-f0-9]{64}$/);
    await assert.rejects(
      pool.execute('UPDATE attendance_records SET registered_at=? WHERE id=?',['2026-09-30 09:00:00',codeMark.record.id]),
      /No modificar datos originales/
    );
    await request('/attendance/register','POST',{template:'synthetic',type:'entrada'},410);
    await request('/auth/login-fingerprint','POST',{template:'synthetic'},410);
    await request('/employees/'+employee+'/fingerprint','PUT',{fingerLabel:'indice_derecho',template:'synthetic'},410);
    // Stored legacy identifiers are archived; retirement never deletes history.
    await pool.execute('INSERT INTO fingerprints(employee_id,finger_label,template,template_hash) VALUES(?,?,?,?)',[employee,'indice_derecho','synthetic-archived','archived-hash']);
    const people=await request('/employees');
    assert.equal(people.employees[0].fingerprints,1);
    const ids=[];
    for (const [type,time] of [['entrada','09:15'],['salida_colacion','13:00'],['entrada_colacion','14:00'],['salida','18:00']]) {
      ids.push((await request('/attendance/records/manual','POST',{employeeId:employee,type,registeredAt:`2026-10-02T${time}:00`,reason:'Prueba de migracion SQLite'},201)).id);
    }
    const records=await request('/attendance/records?from=2026-10-02&to=2026-10-02');
    assert.ok(records.records.some(row=>row.type==='entrada' && row.lateMinutes===15));
    // Filtrar la marca por codigo (dia actual) no afecta los reportes historicos.
    const [manual]=await pool.execute('SELECT id FROM attendance_records WHERE id IN (?,?,?,?)',ids);
    assert.equal(manual.length,4);
    const calendar=await request(`/attendance/calendar?month=2026-10&employeeId=${employee}`);
    assert.ok(calendar.days.some(day=>day.date==='2026-10-02' && day.status==='complete'));
    const report=await request(`/attendance/expected-report?month=2026-10&employeeId=${employee}`);
    const day=report.items.find(row=>String(row.workDate).startsWith('2026-10-02'));
    assert.equal(day.lateMinutes,15);
    assert.equal(day.mealMinutes,60);
    assert.equal(day.expectedMinutes,480);
    await request('/attendance/summary?date=2026-10-02');
    await request(`/schedules/calendar?month=2026-10&employeeId=${employee}`);
    await request(`/schedules/weekly?areaId=${area}&weekStart=2026-09-28`);
    await request('/schedules/calendar/bulk','POST',{employeeId:employee,month:'2026-11',shiftId:shift,mode:'weekdays'});
    await request(`/schedules/weekly/${employee}`,'PUT',{workDate:'2026-10-03',dayType:'rest',shiftId:null});
    await request(`/employees/${employee}/document`,'PUT',{documentId:'98765432-1',reason:'Correccion de documento'});
    const settings=(await request('/settings')).settings;
    await request('/settings','PUT',{...settings,companyName:'Empresa de prueba'});
    assert.equal((await request('/settings')).settings.companyName,'Empresa de prueba');
    const subscription={endpoint:'https://example.com/push/test',keys:{p256dh:'keylongenough0001',auth:'keylongenough0002'}};
    await request('/notifications/subscribe','POST',{subscription},201);
    await request('/notifications/subscribe','POST',{subscription},201);
    assert.equal((await request('/notifications/status')).activeSubscriptions,1);
    await request('/notifications/subscribe','DELETE',{endpoint:subscription.endpoint});
    await request(`/attendance/records/${ids[3]}`,'DELETE',{reason:'Anulacion de prueba'});
    await request(`/employees/${employee}`,'DELETE',{reason:'Desactivacion de prueba'});
    await request(`/employees/${employee}/reactivate`,'POST',{reason:'Reactivacion de prueba'});
    const [audit]=await pool.execute('SELECT action,details FROM audit_logs ORDER BY id');
    assert.ok(audit.some(row=>row.action==='change_document' && JSON.parse(row.details).newDocumentId==='98765432-1'));
    const visibleAudit=await request('/admin/audit');
    assert.ok(visibleAudit.logs.some(row=>row.action==='change_document' && row.details.newDocumentId==='98765432-1'));
    const [counts]=await pool.execute('SELECT COUNT(*) AS total FROM employee_shift_calendar WHERE employee_id=? AND work_date=?',[employee,'2026-10-02']);
    assert.equal(counts[0].total,1);
    const [checks]=await pool.execute('PRAGMA foreign_key_check'); assert.deepEqual(checks,[]);
  } finally { await new Promise(resolve=>server.close(resolve)); await pool.end(); }
});
