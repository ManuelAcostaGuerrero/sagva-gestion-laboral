// Vista compacta para revisar la selección contractual. No reemplaza el detalle
// estructurado ni constituye por sí sola una cláusula de contrato aprobada.
export const CONTRACT_WEEK_DAYS = Object.freeze([
 'LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO','DOMINGO'
]);

const time = value => /^\d{2}:\d{2}/.test(String(value||'')) ? String(value).slice(0,5) : '';
const compactTurn = shift => {
 const start=time(shift.startTime),end=time(shift.endTime);
 return start&&end ? start+'–'+end : String(shift.name||'Turno sin hora').slice(0,45);
};
const printableName = shift => {
 const label=String(shift.name||'Turno sin nombre');
 const span=compactTurn(shift);
 return label.includes(span)||span==='Turno sin hora'?label:label+' · '+span;
};
export function groupContractShiftPlan(plan){
 const groups=new Map();
 const active=(Array.isArray(plan)?plan:[]).filter(row=>row.enabled&&Array.isArray(row.shifts)&&row.shifts.length);
 for(const day of CONTRACT_WEEK_DAYS){
  const row=active.find(item=>item.day===day);
  if(!row)continue;
  const shifts=[...row.shifts].sort((a,b)=>compactTurn(a).localeCompare(compactTurn(b),'es')||
   Number(a.id)-Number(b.id));
  // Se agrupan solo días con exactamente las mismas alternativas de turnos.
  const key=JSON.stringify(shifts.map(shift=>[shift.id,shift.startTime,shift.endTime,shift.name]));
  if(!groups.has(key))groups.set(key,{days:[],shifts});
  groups.get(key).days.push(day);
 }
 return [...groups.values()];
}
export function contractDaysLabel(days){
 const ordered=CONTRACT_WEEK_DAYS.filter(day=>days.includes(day));
 if(!ordered.length)return '';
 const indices=ordered.map(day=>CONTRACT_WEEK_DAYS.indexOf(day));
 const consecutive=indices.every((index,i)=>i===0||index===indices[i-1]+1);
 if(consecutive&&ordered.length>=3)return ordered[0]+' A '+ordered.at(-1);
 if(ordered.length===1)return ordered[0];
 if(ordered.length===2)return ordered.join(' Y ');
 return ordered.slice(0,-1).join(', ')+' Y '+ordered.at(-1);
}
export function summarizeShiftPlan(plan){
 const groups=groupContractShiftPlan(plan);
 if(!groups.length)return '';
 let lines=groups.map(group=>{
  const prefix=contractDaysLabel(group.days)+': ';
  const labels=group.shifts.map(compactTurn);
  if(labels.length===1)return prefix+labels[0];
  if(labels.length<=4)return prefix+labels.length+' alternativas de turno ('+labels.join(', ')+')';
  return prefix+labels.length+' alternativas de turno (ej.: '+labels.slice(0,3).join(', ')+
    '; y '+(labels.length-3)+' más). Ver detalle de horarios.';
 });
 const selectedDays=new Set(groups.flatMap(group=>group.days));
 const without=CONTRACT_WEEK_DAYS.filter(day=>!selectedDays.has(day));
 if(without.length)lines.push('DÍAS SIN HORARIO CONFIGURADO: '+contractDaysLabel(without)+'.');
 lines.push('Resumen de revisión: los turnos enumerados son alternativas; la distribución efectiva requiere confirmación.');
 let summary=lines.join('\n');
 // Nunca cortar en medio de un turno o un día. El detalle íntegro vive en shiftPlan.
 if(summary.length>2000){
  lines=groups.map(group=>contractDaysLabel(group.days)+': '+group.shifts.length+
   ' alternativa(s); revisar el detalle íntegro de turnos seleccionados.');
  if(without.length)lines.push('DÍAS SIN HORARIO CONFIGURADO: '+contractDaysLabel(without)+'.');
  lines.push('Resumen orientativo: consultar los turnos completos en la selección estructurada.');
  summary=lines.join('\n');
 }
 return summary;
}
export function legacySummarizeShiftPlan(plan){
 // Solo para reconocer y actualizar sin perder cambios manuales la versión previa.
 return (plan||[]).filter(row=>row.enabled&&row.shifts?.length)
  .map(row=>row.day+': '+row.shifts.map(s=>s.name).join(' / ')).join('\n').slice(0,2000);
}
export function contractShiftFullLabels(shifts){
 return (shifts||[]).map(printableName);
}
