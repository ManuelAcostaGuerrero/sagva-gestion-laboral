import React,{useEffect,useState} from 'react';
import {api} from './services/api.js';
const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);};
const month=()=>today().slice(0,7);
const money=v=>Number(v||0).toLocaleString('es-CL');
export default function EmployeeBonuses({employeeId}){
 const [catalog,setCatalog]=useState([]),[assigned,setAssigned]=useState([]),[evaluations,setEvaluations]=useState([]);
 const [canManage,setCanManage]=useState(false),[bonusId,setBonusId]=useState(''),[from,setFrom]=useState(today);
 const [evaluating,setEvaluating]=useState(null),[form,setForm]=useState({period:month(),plannedUnits:30,correctUnits:0,evidence:''});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){
  const [cat,workers]=await Promise.all([api('/labor-bonuses/catalog'),api('/labor-bonuses/workers/'+employeeId)]);
  setCatalog(cat.bonuses||[]);setCanManage(!!cat.canManage);
  setAssigned(workers.assignments||[]);setEvaluations(workers.evaluations||[]);
 }
 useEffect(()=>{let alive=true;setError('');setEvaluating(null);setBonusId('');
  if(employeeId)load().catch(e=>{if(alive)setError(e.message);});
  return()=>{alive=false;};
 },[employeeId]);
 async function execute(fn){
  setBusy(true);setError('');setNotice('');
  try{const result=await fn();await load();setNotice(result.message||'Registro guardado.');return true;}
  catch(e){setError(e.message);return false;}finally{setBusy(false);}
 }
 if(!employeeId)return <p className="ef-note">Guarda primero al trabajador para asignar bonos.</p>;
 const unassigned=catalog.filter(b=>b.active&&!assigned.some(a=>a.bonusId===b.id));
 const editing=assigned.find(a=>a.id===evaluating);
 const previous=evaluations.find(e=>e.assignmentId===evaluating&&e.period===form.period);
 return <fieldset className="ef-section ef-field-wide">
  <legend>Bonos y conceptos vinculados al trabajador</legend>
  <p>Permite varios bonos. Los valores imponibles son propiedades del catálogo; aquí se evalúan resultados, no se descuentan sueldos.</p>
  {error&&<p role="alert" className="ef-note">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <div className="la-scroll"><table><thead><tr><th>Concepto</th><th>Referencia CLP</th><th>Imponible</th><th>Cláusula</th><th>Estado</th><th></th></tr></thead>
   <tbody>{assigned.map(a=><tr key={a.id}><td>{a.name}</td><td>{money(a.amountOverrideClp??a.amountClp)}</td><td>{a.taxable?'Sí':'No'}</td><td>{a.withClause?'Sí':'No'}</td><td>{a.active?'Asignado':'Suspendido'}</td>
    <td className="la-inline-actions"><button type="button" className="la-small" disabled={busy} onClick={()=>{setEvaluating(a.id);setForm({period:month(),plannedUnits:30,correctUnits:0,evidence:''});}}>Evaluar</button>
    <button type="button" className="la-small" disabled={busy} onClick={()=>execute(()=>api('/labor-bonuses/workers/'+employeeId+'/assignments/'+a.id,{method:'PUT',body:JSON.stringify({revision:a.revision,active:!a.active,amountOverrideClp:a.amountOverrideClp,validFrom:a.validFrom})}))}>{a.active?'Suspender':'Reactivar'}</button></td></tr>)}
    {!assigned.length&&<tr><td colSpan={6}>Aún sin bonos asignados.</td></tr>}</tbody></table></div>
  {!!unassigned.length&&<div className="la-inline-actions">
   <label>Incorporar bono<select value={bonusId} onChange={e=>setBonusId(e.target.value)}><option value="">Seleccionar</option>{unassigned.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
   <label>Vigencia desde<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
   <button type="button" className="la-small" disabled={busy||!bonusId||!from} onClick={()=>execute(()=>api('/labor-bonuses/workers/'+employeeId+'/assignments',{method:'POST',body:JSON.stringify({bonusId:Number(bonusId),amountOverrideClp:null,validFrom:from})}))}>Asignar</button>
  </div>}
  {!catalog.length&&<p className="ef-note">Crea primero los conceptos desde Gestión → Contabilidad Laboral → Bonos.</p>}
  {editing&&<form onSubmit={async e=>{
    e.preventDefault();
    const ok=await execute(()=>api('/labor-bonuses/workers/'+employeeId+'/assignments/'+editing.id+'/evaluations',{method:'POST',body:JSON.stringify({...form,revision:previous?.revision||0})}));
    if(ok)setEvaluating(null);
   }}><fieldset className="ef-section"><legend>Evaluar {editing.name} · simulación</legend>
    <div className="ef-grid">
     <label>Período<input type="month" required value={form.period} onChange={e=>{
      const p=e.target.value,old=evaluations.find(a=>a.assignmentId===editing.id&&a.period===p);
      setForm({period:p,plannedUnits:old?.plannedUnits||30,correctUnits:old?.correctUnits||0,evidence:old?.evidence||''});
     }}/></label>
     <label>Unidades previstas (p. ej., cierres)<input type="number" min="1" max="366" required value={form.plannedUnits} onChange={e=>setForm(v=>({...v,plannedUnits:Number(e.target.value)}))}/></label>
     <label>Unidades correctas verificadas<input type="number" min="0" max={form.plannedUnits} required value={form.correctUnits} onChange={e=>setForm(v=>({...v,correctUnits:Number(e.target.value)}))}/></label>
     <label className="ef-field-wide">Evidencia y motivo<textarea minLength={5} maxLength={3000} required value={form.evidence} onChange={e=>setForm(v=>({...v,evidence:e.target.value}))}/></label>
     <p className="ef-note ef-field-wide">Proyección: {form.plannedUnits>0&&form.correctUnits<=form.plannedUnits?money(Math.round((editing.amountOverrideClp??editing.amountClp)*form.correctUnits/form.plannedUnits)):'Inválida'} CLP · pendiente de revisión y sin efecto en la nómina.</p>
    </div><div className="la-inline-actions"><button type="submit" disabled={busy||form.correctUnits>form.plannedUnits} className="primary la-small">Guardar evaluación</button><button type="button" className="la-small" onClick={()=>setEvaluating(null)}>Cancelar</button></div>
   </fieldset></form>}
  {!!evaluations.length&&<details><summary>Historial de evaluaciones ({evaluations.length})</summary>
   <div className="la-scroll"><table><thead><tr><th>Bono</th><th>Mes</th><th>Cierres correctos</th><th>Simulación</th><th>Estado</th></tr></thead><tbody>
    {evaluations.map(e=><tr key={e.id}><td>{assigned.find(a=>a.id===e.assignmentId)?.name||e.assignmentId}</td><td>{e.period}</td><td>{e.correctUnits}/{e.plannedUnits}</td><td>{money(e.suggestedClp)} CLP</td><td>Pendiente de revisión</td></tr>)}
   </tbody></table></div></details>}
 </fieldset>;
}
