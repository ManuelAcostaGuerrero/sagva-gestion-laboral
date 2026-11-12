import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 groupContractShiftPlan,summarizeShiftPlan,legacySummarizeShiftPlan,
 updateDraftShiftPlan,contractShiftFullLabels
} from '../../../client/src/contractShiftSummary.js';

const days=['LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO','DOMINGO'];
const shift=(id,start,end)=>({id,name:'Rotativo · '+start+'–'+end,startTime:start,endTime:end});
const library=Array.from({length:35},(_,i)=>shift(i+1,'08:'+String(i).padStart(2,'0'),'17:'+String(i).padStart(2,'0')));
const fullPlan=days.map(day=>({day,enabled:true,shifts:structuredClone(library)}));

test('Jornada: siete días con 35 horarios idénticos se muestran una sola vez',()=>{
 const groups=groupContractShiftPlan(fullPlan);
 assert.equal(groups.length,1);
 assert.deepEqual(groups[0].days,days);
 assert.equal(groups[0].shifts.length,35);
 const summary=summarizeShiftPlan(fullPlan);
 assert.match(summary,/LUNES A DOMINGO: 35 alternativas de turno/);
 assert.match(summary,/32 más/);
 assert.doesNotMatch(summary,/MARTES:/);
 assert.ok(summary.length<500,'resumen corto, sin repetición por cada día');
 assert.equal(fullPlan.reduce((count,row)=>count+row.shifts.length,0),245,
  'el detalle estructurado contiene los 245 turnos seleccionados');
 assert.equal(contractShiftFullLabels(groups[0].shifts).length,35);
});

test('Jornada: agrupa solo días con las mismas alternativas y reporta días sin horario',()=>{
 const [a,b,c,d]=fullPlan;
 const plan=[
  {...a,shifts:[library[0],library[1]]},
  {...b,shifts:[library[0],library[1]]},
  {...c,shifts:[library[2]]},
  {...d,enabled:false,shifts:[library[0]]}
 ];
 const groups=groupContractShiftPlan(plan);
 assert.equal(groups.length,2);
 const summary=summarizeShiftPlan(plan);
 assert.match(summary,/LUNES Y MARTES: 2 alternativas/);
 assert.match(summary,/MIÉRCOLES: 08:02–17:02/);
 assert.match(summary,/DÍAS SIN HORARIO CONFIGURADO:/);
 assert.doesNotMatch(summary,/JUEVES: 08:00/);
});

test('Jornada: nunca corta texto a la mitad y mantiene texto manual histórico',()=>{
 const current={shiftPlan:fullPlan,shiftDistribution:legacySummarizeShiftPlan(fullPlan)};
 assert.equal(current.shiftDistribution.length,2000,'fixture del formato antiguo recortado');
 const changed=fullPlan.map(row=>({...row,shifts:row.shifts.slice(0,30)}));
 const migrated=updateDraftShiftPlan(current,changed);
 assert.equal(migrated.shiftDistribution,summarizeShiftPlan(changed));
 assert.ok(migrated.shiftDistribution.length<2000);
 const custom=updateDraftShiftPlan({...current,shiftDistribution:'Cláusula revisada manualmente.'},changed);
 assert.equal(custom.shiftDistribution,'Cláusula revisada manualmente.');
 assert.deepEqual(custom.shiftPlan,changed);
 assert.equal(current.shiftPlan[0].shifts.length,35,'ningún registro original mutado');
});

test('Jornada: soporta selección vacía y múltiples grupos sin truncar',()=>{
 assert.equal(summarizeShiftPlan([]),'');
 const distinct=days.map((day,i)=>({day,enabled:true,shifts:Array.from({length:100},(_,j)=>({
  id:i*100+j+1,name:'Rotativo muy largo '.repeat(8),startTime:'07:00',endTime:'23:00'
 }))}));
 const summary=summarizeShiftPlan(distinct);
 assert.ok(summary.length<=2000);
 assert.equal(summary.split('\n').filter(x=>x.includes('alternativa')).length,7);
 assert.match(summary,/DOMINGO:/);
 assert.equal(groupContractShiftPlan(distinct).length,7);
});

test('Ficha: elimina los dos controles efímeros, pero mantiene aviso DT no contractual',()=>{
 const source=readFileSync(new URL('../../../client/src/ContractTerms.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/Fecha para evaluar la jornada \(no se guarda\)/);
 assert.doesNotMatch(source,/Régimen de jornada a evaluar \(no se guarda\)/);
 assert.match(source,/jornada\/assessment/);
 assert.match(source,/todayInChile\(\)/);
 assert.match(source,/No determina el régimen de este trabajador/);
 assert.match(source,/Resumen de jornada agrupado por días/);
 assert.match(source,/Texto de jornada para revisión jurídica \(editable\)/);
});
