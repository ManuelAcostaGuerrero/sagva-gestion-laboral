import React,{useEffect,useState} from 'react';
import {api} from './services/api.js';

const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);};
const month=()=>today().slice(0,7);
const money=v=>Number(v||0).toLocaleString('es-CL');
const amountToNumber=value=>value===''?null:Number(value);

export default function EmployeeBonuses({employeeId}){
 const [catalog,setCatalog]=useState([]),[assigned,setAssigned]=useState([]),[evaluations,setEvaluations]=useState([]);
 const [bonusId,setBonusId]=useState(''),[from,setFrom]=useState(today);
 const [amountInput,setAmountInput]=useState(''),[notesInput,setNotesInput]=useState('');
 const [editingAssignment,setEditingAssignment]=useState(null);
 const [evaluating,setEvaluating]=useState(null),[form,setForm]=useState({period:month(),plannedUnits:30,correctUnits:0,evidence:''});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');

 async function load(){
  const [cat,workers]=await Promise.all([api('/labor-bonuses/catalog'),api('/labor-bonuses/workers/'+employeeId)]);
  setCatalog(cat.bonuses||[]);
  setAssigned(workers.assignments||[]);
  setEvaluations(workers.evaluations||[]);
 }
 useEffect(()=>{
  let alive=true;
  setError('');setNotice('');setEvaluating(null);setEditingAssignment(null);
  setBonusId('');setAmountInput('');setNotesInput('');
  if(employeeId)load().catch(e=>{if(alive)setError(e.message);});
  return()=>{alive=false;};
 },[employeeId]);
 async function execute(fn){
  setBusy(true);setError('');setNotice('');
  try{
   const result=await fn();
   await load();
   setNotice(result.message||'Registro guardado.');
   return true;
  }catch(e){setError(e.message);return false;}
  finally{setBusy(false);}
 }
 const unassigned=catalog.filter(b=>b.active&&!assigned.some(a=>a.bonusId===b.id));
 const selectedBonus=catalog.find(b=>String(b.id)===bonusId);
 const editing=assigned.find(a=>a.id===evaluating);
 const previous=evaluations.find(e=>e.assignmentId===evaluating&&e.period===form.period);
 const validMoney=value=>value===''||(/^\d+$/.test(value)&&Number(value)<=100000000);
 return <fieldset className="ef-section ef-field-wide ef-bonuses-section" aria-label="Bonos del trabajador">
  <legend>Bonos</legend>
  <p>Agrega varios bonos al trabajador. Tipo, imponibilidad y cláusulas se configuran en <strong>Gestión → Contabilidad Laboral → Bonos</strong>. Aquí se asigna monto individual, vigencia y observación, sin generar pagos ni descuentos.</p>
  {!employeeId?<p className="ef-note">Guarda primero la ficha del trabajador para habilitar «Agregar bono». Los datos bancarios se administran por separado.</p>:<>
   {error&&<p role="alert" className="ef-note">{error}</p>}
   {notice&&<p role="status" className="ef-note">{notice}</p>}
   <div className="la-scroll"><table>
    <thead><tr><th>Tipo de bono</th><th>Monto CLP</th><th>Imponible</th><th>Tiene cláusula</th><th>Cláusula / condición</th><th>Observación</th><th>Estado</th><th>Acciones</th></tr></thead>
    <tbody>
     {assigned.map(a=><tr key={a.id}>
      <td>{a.name}</td>
      <td>{money(a.amountOverrideClp??a.amountClp)}</td>
      <td>{a.taxable?'Sí':'No'}</td>
      <td>{a.withClause?'Sí':'No'}</td>
      <td>{a.withClause?(a.clauseText||'Por definir'):'—'}</td>
      <td>{a.notes||'—'}</td>
      <td>{a.active?'Asignado':'Suspendido'}</td>
      <td><div className="la-inline-actions">
       <button type="button" className="la-small" disabled={busy} onClick={()=>setEditingAssignment({id:a.id,revision:a.revision,active:a.active,validFrom:a.validFrom,amountOverrideClp:a.amountOverrideClp===null?'':String(a.amountOverrideClp),notes:a.notes||''})}>Editar</button>
       <button type="button" className="la-small" disabled={busy||!a.active} onClick={()=>{setEvaluating(a.id);setForm({period:month(),plannedUnits:30,correctUnits:0,evidence:''});}}>Evaluar</button>
       <button type="button" className="la-small" disabled={busy} onClick={()=>execute(()=>api('/labor-bonuses/workers/'+employeeId+'/assignments/'+a.id,{method:'PUT',body:JSON.stringify({revision:a.revision,active:!a.active,amountOverrideClp:a.amountOverrideClp,validFrom:a.validFrom,notes:a.notes||''})}))}>{a.active?'Suspender':'Reactivar'}</button>
      </div></td>
     </tr>)}
     {!assigned.length&&<tr><td colSpan={8}>Aún no hay bonos asignados.</td></tr>}
    </tbody>
   </table></div>

   {editingAssignment&&<div className="ef-bonus-editor">
    <h4>Editar bono asignado</h4>
    <div className="ef-grid">
     <label>Monto individual CLP (vacío = catálogo)
      <input type="number" min="0" max="100000000" step="1" value={editingAssignment.amountOverrideClp} onChange={e=>setEditingAssignment(v=>({...v,amountOverrideClp:e.target.value}))}/></label>
     <label>Vigencia desde
      <input type="date" value={editingAssignment.validFrom} onChange={e=>setEditingAssignment(v=>({...v,validFrom:e.target.value}))}/></label>
     <label className="ef-field-wide">Observación
      <textarea rows={2} maxLength={1000} value={editingAssignment.notes} onChange={e=>setEditingAssignment(v=>({...v,notes:e.target.value}))}/></label>
    </div>
    <div className="la-inline-actions">
     <button type="button" className="primary la-small" disabled={busy||!editingAssignment.validFrom||!validMoney(editingAssignment.amountOverrideClp)} onClick={async()=>{
      const d=editingAssignment;
      const ok=await execute(()=>api('/labor-bonuses/workers/'+employeeId+'/assignments/'+d.id,{method:'PUT',body:JSON.stringify({revision:d.revision,active:d.active,validFrom:d.validFrom,amountOverrideClp:amountToNumber(d.amountOverrideClp),notes:d.notes})}));
      if(ok)setEditingAssignment(null);
     }}>Guardar bono</button>
     <button type="button" className="la-small" disabled={busy} onClick={()=>setEditingAssignment(null)}>Cancelar</button>
    </div>
   </div>}

   {!!unassigned.length&&<div className="ef-bonus-editor">
    <h4>Agregar bono</h4>
    <div className="ef-grid">
     <label>Tipo de bono
      <select value={bonusId} onChange={e=>{setBonusId(e.target.value);setAmountInput('');}}>
       <option value="">Seleccionar bono</option>
       {unassigned.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
      </select></label>
     <label>Monto individual CLP (vacío = monto del catálogo)
      <input type="number" min="0" max="100000000" step="1" value={amountInput} onChange={e=>setAmountInput(e.target.value)}/></label>
     <label>Vigencia desde
      <input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
     <label className="ef-field-wide">Observación
      <textarea rows={2} maxLength={1000} value={notesInput} onChange={e=>setNotesInput(e.target.value)} placeholder="Motivo o antecedente específico de este trabajador (opcional)"/></label>
    </div>
    {selectedBonus&&<div className="ef-bonus-preview" aria-live="polite">
     <span><strong>Referencia:</strong> {money(selectedBonus.amountClp)} CLP</span>
     <span><strong>Imponible:</strong> {selectedBonus.taxable?'Sí':'No'} (catálogo)</span>
     <span><strong>Tiene cláusula:</strong> {selectedBonus.withClause?'Sí':'No'}</span>
     {selectedBonus.withClause&&<span><strong>Cláusula / condición:</strong> {selectedBonus.clauseText||'Pendiente de definir en catálogo'}</span>}
     {!selectedBonus.legalReviewed&&<span><strong>Revisión jurídica pendiente</strong></span>}
    </div>}
    <button type="button" className="primary la-small" disabled={busy||!bonusId||!from||!validMoney(amountInput)}
     onClick={async()=>{
      const ok=await execute(()=>api('/labor-bonuses/workers/'+employeeId+'/assignments',{method:'POST',body:JSON.stringify({bonusId:Number(bonusId),amountOverrideClp:amountToNumber(amountInput),validFrom:from,notes:notesInput})}));
      if(ok){setBonusId('');setAmountInput('');setNotesInput('');}
     }}>+ Agregar bono</button>
   </div>}
   {!catalog.length&&<p className="ef-note">No hay conceptos disponibles. Agrégalos en Gestión → Contabilidad Laboral → Bonos con un usuario autorizado.</p>}
   {!!catalog.length&&!unassigned.length&&<p className="ef-note">Todos los conceptos del catálogo están vinculados a este trabajador. Puedes editar sus montos u observaciones desde la tabla.</p>}

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
    </div>
    <div className="la-inline-actions">
     <button type="submit" disabled={busy||form.correctUnits>form.plannedUnits} className="primary la-small">Guardar evaluación</button>
     <button type="button" className="la-small" onClick={()=>setEvaluating(null)}>Cancelar</button>
    </div>
   </fieldset></form>}
   {!!evaluations.length&&<details><summary>Historial de evaluaciones ({evaluations.length})</summary>
    <div className="la-scroll"><table><thead><tr><th>Bono</th><th>Mes</th><th>Cierres correctos</th><th>Simulación</th><th>Estado</th></tr></thead><tbody>
     {evaluations.map(e=><tr key={e.id}>
      <td>{assigned.find(a=>a.id===e.assignmentId)?.name||e.assignmentId}</td><td>{e.period}</td><td>{e.correctUnits}/{e.plannedUnits}</td><td>{money(e.suggestedClp)} CLP</td><td>Pendiente de revisión</td>
     </tr>)}
    </tbody></table></div></details>}
  </>}
 </fieldset>;
}
