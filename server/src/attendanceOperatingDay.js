// Día operativo local: comienza 06:00 y termina antes de las 06:00 siguientes.
export function operatingDay(stamp){
 const m=/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):\d{2}/.exec(String(stamp||''));
 if(!m)throw new Error('Fecha de marcación inválida.');
 const date=new Date(m[1]+'T12:00:00Z');
 if(date.toISOString().slice(0,10)!==m[1])throw new Error('Día inválido.');
 if(Number(m[2])<6)date.setUTCDate(date.getUTCDate()-1);
 const day=date.toISOString().slice(0,10);date.setUTCDate(date.getUTCDate()+1);
 return {date:day,start:day+' 06:00:00',end:date.toISOString().slice(0,10)+' 06:00:00'};
}
export function recommendType(records){
 const last=records.at(-1)?.type||null;
 return {lastType:last,recommendedType:last==='entrada'?'salida_colacion':last==='salida_colacion'?'entrada_colacion':last==='entrada_colacion'?'salida':last==='salida'?null:'entrada',completed:last==='salida'};
}
