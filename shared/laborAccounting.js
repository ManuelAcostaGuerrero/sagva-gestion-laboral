// Definiciones compartidas entre interfaz y servidor. Los montos de planes
// Isapre son individuales y no se fijan en este catálogo.
export const laborMetrics=Object.freeze([
 {code:'AFP_OBLIGATORIA',label:'Cotización obligatoria AFP',group:'TRABAJADOR',unit:'PERCENT'},
 {code:'SALUD_LEGAL',label:'Cotización legal de salud',group:'TRABAJADOR',unit:'PERCENT'},
 {code:'AFP_COMISION',label:'Comisión de administración AFP',group:'AFP',unit:'PERCENT',entityKind:'AFP'},
 {code:'TOPE_PREVISION_UF',label:'Tope imponible pensiones y salud',group:'TOPES',unit:'UF'},
 {code:'TOPE_CESANTIA_UF',label:'Tope imponible seguro de cesantía',group:'TOPES',unit:'UF'},
 {code:'EMPLEADOR_TOTAL',label:'Aporte previsional total del empleador (incluye componentes)',group:'EMPLEADOR',unit:'PERCENT'},
 {code:'EMPLEADOR_CUENTA',label:'Empleador: cuenta individual',group:'EMPLEADOR',unit:'PERCENT'},
 {code:'EMPLEADOR_CRP',label:'Empleador: rentabilidad protegida',group:'EMPLEADOR',unit:'PERCENT'},
 {code:'EMPLEADOR_FAPP_SIS',label:'Empleador: FAPP, expectativa de vida y SIS',group:'EMPLEADOR',unit:'PERCENT'}
]);
export const laborMetric=code=>laborMetrics.find(item=>item.code===code)||null;
export function laborScaled(value,unit){
 const n=Number(value);
 const limit=unit==='PERCENT'?100:unit==='UF'?100000:100000000;
 if(!Number.isFinite(n)||n<0||n>limit||Math.abs(n*100-Math.round(n*100))>1e-6)
   throw new Error('El valor debe ser un número entre 0 y '+limit+' con hasta dos decimales.');
 return Math.round(n*100);
}
export const laborValue=hundredths=>Number(hundredths)/100;
export function laborValuesAt(versions,date){
 const result={};
 for(const row of [...versions].sort((a,b)=>
   String(b.effectiveFrom).localeCompare(String(a.effectiveFrom))||
   Number(b.id)-Number(a.id))){
   if(row.effectiveFrom>date)continue;
   const key=row.metric+':'+(row.entityId??'GLOBAL');
   if(!result[key])result[key]=row;
 }
 return result;
}
