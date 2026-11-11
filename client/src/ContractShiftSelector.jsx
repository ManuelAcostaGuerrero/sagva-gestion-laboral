import React,{useEffect,useState} from 'react';
import {api} from './services/api.js';

const DAYS=['LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO','DOMINGO'];
const copy=items=>structuredClone(items||[]);
const label=s=>(s.groupName?s.groupName+' · ':'')+(s.label||s.name||((s.startTime||'')+'–'+(s.endTime||'')));
const snapshot=s=>({id:Number(s.id),name:label(s).slice(0,150),startTime:String(s.startTime||''),endTime:String(s.endTime||'')});
export function summarizeShiftPlan(plan){
 return (plan||[]).filter(row=>row.enabled&&row.shifts?.length).map(row=>row.day+': '+row.shifts.map(s=>s.name).join(' / ')).join('\n').slice(0,2000);
}
export default function ContractShiftSelector({value=[],onChange,disabled=false}){
 const [library,setLibrary]=useState([]),[error,setError]=useState(''),[history,setHistory]=useState([]);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{let alive=true;setLoading(true);
  api('/schedules').then(data=>{if(alive)setLibrary((data.shifts||[]).filter(x=>x.isActive));})
   .catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[]);
 const configured=value||[];
 const apply=next=>{
  setHistory(p=>[...p.slice(-19),copy(configured)]);
  onChange(next);
 };
 const full=()=>DAYS.map(day=>({day,enabled:true,shifts:library.map(snapshot)}));
 const reset=()=>{if(!library.length)return;if(configured.length&&!window.confirm('Restablecer todos los turnos desde la biblioteca actual?'))return;apply(full());};
 const undo=()=>{if(!history.length)return;onChange(history[history.length-1]);setHistory(p=>p.slice(0,-1));};
 const modify=(day,fn)=>{
  const current=DAYS.map(d=>configured.find(x=>x.day===d)||{day:d,enabled:false,shifts:[]});
  apply(current.map(x=>x.day===day?fn(x):x));
 };
 return <section className="ef-field-wide csp-panel" aria-label="Turnos contractuales por día">
  <div className="csp-toolbar"><strong>Distribución contractual por día</strong>
   <button type="button" className="la-small" disabled={disabled||loading||!library.length} onClick={()=>apply(full())}>Incorporar turnos actuales</button>
   <button type="button" className="la-small" disabled={disabled||!history.length} onClick={undo}>Deshacer</button>
   <button type="button" className="la-small" disabled={disabled||!library.length} onClick={reset}>Restablecer</button>
  </div>
  <p className="ef-note">Selecciona los días; toca un horario para quitarlo. «Deshacer» recupera la última selección y «Restablecer» repone todos los horarios actuales sin modificar las plantillas originales.</p>
  {error&&<p role="alert" className="ef-note">{error}</p>}
  {loading&&<p>Cargando biblioteca de turnos…</p>}
  <div className="csp-days">{DAYS.map(day=>{
   const row=configured.find(x=>x.day===day)||{day,enabled:false,shifts:[]};
   const ids=new Set((row.shifts||[]).map(x=>Number(x.id)));
   return <div key={day} className="csp-day">
    <div className="csp-day-head">
     <label className="csp-toggle"><input type="checkbox" checked={!!row.enabled} disabled={disabled} onChange={e=>modify(day,x=>({...x,enabled:e.target.checked,shifts:e.target.checked?(x.shifts.length?x.shifts:library.map(snapshot)):[]}))}/>{day}</label>
     {row.enabled&&<span>{row.shifts.length} horario(s)</span>}
     {row.enabled&&<select aria-label={'Añadir horario '+day} disabled={disabled||loading} value="" onChange={e=>{const selected=library.find(x=>Number(x.id)===Number(e.target.value));if(selected)modify(day,x=>({...x,shifts:[...x.shifts,snapshot(selected)]}));}}>
      <option value="">Agregar horario…</option>
      {library.filter(x=>!ids.has(Number(x.id))).map(x=><option key={x.id} value={x.id}>{label(x)}</option>)}
     </select>}
    </div>
    {row.enabled&&<div className="csp-chips">{row.shifts.length?row.shifts.map(x=>
     <button type="button" key={x.id} className="csp-chip" disabled={disabled} title={'Quitar '+x.name+' de '+day} onClick={()=>modify(day,y=>({...y,shifts:y.shifts.filter(z=>z.id!==x.id)}))}>{x.name} <span aria-hidden="true">×</span></button>
    ):<span>Sin horarios seleccionados</span>}</div>}
   </div>;
  })}</div>
  <small>Selección propia del trabajador: los turnos de la biblioteca no se eliminan. Confirmar compatibilidad y jornada total al formalizar contrato.</small>
 </section>;
}
