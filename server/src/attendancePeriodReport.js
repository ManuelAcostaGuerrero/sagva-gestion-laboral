// A03: resúmenes de asistencia para consulta, sin declarar horas extras autorizadas.
// La fuente sigue siendo expectedAttendanceReport; no se modifica una sola marcación.
const durationSeconds = value => value == null ? 0 : Math.max(0,Math.trunc(Number(value) || 0));

export function secondsAsHms(value){
  if(value == null)return '';
  const n=durationSeconds(value),h=Math.trunc(n/3600),m=Math.trunc(n%3600/60),s=n%60;
  return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':');
}

export function weekMonday(isoDate){
  const d=new Date(isoDate+'T00:00:00Z');
  const offset=(d.getUTCDay()+6)%7;
  d.setUTCDate(d.getUTCDate()-offset);
  return d.toISOString().slice(0,10);
}

export function aggregateAttendancePeriods(items,period,month){
  if(!['daily','weekly','monthly'].includes(period))throw new Error('Período no válido.');
  const buckets=new Map();
  for(const day of items){
    if(!day.workDate?.startsWith(month+'-'))continue;
    const key=period==='daily'?day.workDate:period==='weekly'?weekMonday(day.workDate):month;
    const bucketKey=day.employeeId+':'+key;
    let row=buckets.get(bucketKey);
    if(!row){
      row={period:key,employeeId:day.employeeId,fullName:day.fullName,documentId:day.documentId,
        from:day.workDate,to:day.workDate,days:0,scheduledDays:0,recordedDays:0,
        uncalculatedDays:0,absentDays:0,incompleteDays:0,observationDays:0,totalMarks:0,
        actualSeconds:0,expectedSeconds:0,mealSeconds:0,lateSeconds:0,
        earlyLeaveSeconds:0,technicalExcessSeconds:0,missingSeconds:0};
      buckets.set(bucketKey,row);
    }
    if(day.workDate<row.from)row.from=day.workDate;
    if(day.workDate>row.to)row.to=day.workDate;
    row.days++;
    if(day.shiftId != null && day.dayType==='work')row.scheduledDays++;
    if(day.totalRecords)row.recordedDays++;
    if(day.status==='absent')row.absentDays++;
    if(day.status==='incomplete')row.incompleteDays++;
    if(day.status==='with_observations')row.observationDays++;
    row.totalMarks+=Number(day.totalRecords||0);
    if(day.actualSeconds == null)row.uncalculatedDays++;
    for(const [dest,source] of [
      ['actualSeconds','actualSeconds'],['expectedSeconds','expectedSeconds'],
      ['mealSeconds','mealSeconds'],['lateSeconds','lateSeconds'],
      ['earlyLeaveSeconds','earlyLeaveSeconds'],['technicalExcessSeconds','overtimeSeconds'],
      ['missingSeconds','missingSeconds']
    ])row[dest]+=durationSeconds(day[source]);
  }
  const rows=[...buckets.values()].sort((a,b)=>a.from.localeCompare(b.from)||a.fullName.localeCompare(b.fullName)||a.employeeId-b.employeeId);
  const summary={periods:rows.length,employees:new Set(rows.map(r=>r.employeeId)).size,days:0,
    recordedDays:0,uncalculatedDays:0,absentDays:0,incompleteDays:0,actualSeconds:0,
    mealSeconds:0,lateSeconds:0,technicalExcessSeconds:0};
  for(const row of rows)for(const key of Object.keys(summary)){
    if(key!=='periods'&&key!=='employees')summary[key]+=row[key]||0;
  }
  return {month,granularity:period,source:'attendance_records + employee_shift_calendar',overtimeIsAuthorized:false,
    summary,rows};
}

function safeCell(value){
  let s=String(value ?? '').replace(/[\r\n]+/g,' ');
  // Protección contra inyección de fórmulas al abrir el archivo en Excel.
  if(/^\s*[=+\-@]/.test(s))s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
}

export function attendancePeriodCsv(report,exportId,generatedAt){
  const headers=['Exportación ID','Generado UTC','Agrupación','Período','Desde','Hasta','ID trabajador',
    'Trabajador','Documento','Días','Días programados','Días con marcas','Días sin cálculo',
    'Ausencias','Incompletos','Observaciones','Marcas','Trabajado HH:MM:SS',
    'Esperado HH:MM:SS','Colación HH:MM:SS','Atraso HH:MM:SS',
    'Salida anticipada HH:MM:SS','Exceso técnico NO autorizado HH:MM:SS','Déficit HH:MM:SS'];
  const lines=[headers,...report.rows.map(r=>[exportId,generatedAt,report.granularity,r.period,r.from,r.to,
    r.employeeId,r.fullName,r.documentId,r.days,r.scheduledDays,r.recordedDays,r.uncalculatedDays,
    r.absentDays,r.incompleteDays,r.observationDays,r.totalMarks,secondsAsHms(r.actualSeconds),
    secondsAsHms(r.expectedSeconds),secondsAsHms(r.mealSeconds),secondsAsHms(r.lateSeconds),
    secondsAsHms(r.earlyLeaveSeconds),secondsAsHms(r.technicalExcessSeconds),secondsAsHms(r.missingSeconds)])];
  return '\uFEFF'+lines.map(r=>r.map(safeCell).join(',')).join('\r\n')+'\r\n';
}
