import React,{useEffect,useState} from 'react';
import {api} from './services/api.js';

const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);};
const money=v=>Number(v||0).toLocaleString('es-CL');
const amountToNumber=value=>value===''?null:Number(value);

export default function EmployeeBonuses({employeeId}){
 const [catalog,setCatalog]=useState([]),[assigned,setAssigned]=useState([]),[legacyEvaluations,setLegacyEvaluations]=useState([]);
 const [bonusId,setBonusId]=useState(''),[from,setFrom]=useState(today);
 const [amountInput,setAmountInput]=useState(''),[notesInput,setNotesInput]=useState('');
 const [editingAssignment,setEditingAssignment]=useState(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');

 async function load(){
  const [cat,workers]=await Promise.all([api('/labor-bonuses/catalog'),api('/labor-bonuses/workers/'+employeeId)]);
  setCatalog(cat.bonuses||[]);
  setAssigned(workers.assignments||[]);
  setLegacyEvaluations(workers.evaluations||[]);
 }
 useEffect(()=>{
  let alive=true;setError('');setNotice('');setEditingAssignment(null);
  setBonusId('');setAmountInput('');setNotesInput('');
  if(employeeId)load().catch(e=>{if(alive)setError(e.message);});
  return()=>{alive=false;};
 },[employeeId]);
 async function execute(fn){
  setBusy(true);setError('');setNotice('');
  try{
   const result=await fn();await load();
   setNotice(result.message||'Registro guardado.');return true;
  }catch(e){setError(e.message);return false;}
  finally{setBusy(false);}
 }
 const unassigned=catalog.filter(b=>b.active&&!assigned.some(a=>a.bonusId===b.id));
 const selectedBonus=catalog.find(b=>String(b.id)===bonusId);
 const validMoney=value=>value===''||(/^\d+$/.test(value)&&Number(value)<=100000000);
 return <fieldset className="ef-section ef-field-wide ef-bonuses-section" aria-label="Bonos del trabajador">
  <legend>Bonos</legend>
  <p>Registra el bono asociado a este trabajador, su monto de referencia individual, vigencia y observación.
   Las condiciones y métricas provienen del catálogo. La asistencia no calcula pagos ni descuentos.</p>
  {!employeeId?<p className="ef-note">Guarda primero al trabajador para asignar bonos. Los datos bancarios siguen en su sección independiente.</p>:<>
   {error&&<p role="alert" className="ef-note">{error}</p>}
   {notice&&<p role="status" className="ef-note">{notice}</p>}
   <div className="la-scroll"><table>
    <thead><tr><th>Bono</th><th>Monto CLP</th><th>Imponibilidad</th><th>Condiciones del bono</th><th>Observación</th><th>Estado</th><th>Acciones</th></tr></thead>
    <tbody>{assigned.map(a=><tr key={a.id}>
     <td>{a.name}</td><td>{money(a.amountOverrideClp??a.amountClp)}</td>
     <td>{a.taxable?'Imponible':'No imponible'}</td>
     <td style={{whiteSpace:'pre-wrap'}}>{a.conditions||'Sin condiciones documentadas'}</td>
     <td>{a.notes||'—'}</td><td>{a.active?'Asignado':'Suspendido'}</td>
     <td><div className="la-inline-actions">
      <button type="button" className="la-small" disabled={busy}
       onClick={()=>setEditingAssignment({id:a.id,revision:a.revision,active:a.active,validFrom:a.validFrom,
        amountOverrideClp:a.amountOverrideClp===null?'':String(a.amountOverrideClp),notes:a.notes||''})}>Editar asignación</button>
      <button type="button" className="la-small" disabled={busy}
       onClick={()=>execute(()=>api('/labor-bonuses/workers/'+employeeId+'/assignments/'+a.id,{
        method:'PUT',body:JSON.stringify({revision:a.revision,active:!a.active,
         amountOverrideClp:a.amountOverrideClp,validFrom:a.validFrom,notes:a.notes||''})
       }))}>{a.active?'Suspender':'Reactivar'}</button>
     </div></td>
    </tr>)}
    {!assigned.length&&<tr><td colSpan={7}>Aún no hay bonos asignados.</td></tr>}
    </tbody>
   </table></div>

   {editingAssignment&&<div className="ef-bonus-editor">
    <h4>Editar asignación del trabajador</h4>
    <div className="ef-grid">
     <label>Monto individual CLP (vacío = catálogo)
      <input type="number" min="0" max="100000000" step="1" value={editingAssignment.amountOverrideClp}
       onChange={e=>setEditingAssignment(v=>({...v,amountOverrideClp:e.target.value}))}/></label>
     <label>Vigencia desde
      <input type="date" value={editingAssignment.validFrom}
       onChange={e=>setEditingAssignment(v=>({...v,validFrom:e.target.value}))}/></label>
     <label className="ef-field-wide">Observación administrativa
      <textarea rows={2} maxLength={1000} value={editingAssignment.notes}
       onChange={e=>setEditingAssignment(v=>({...v,notes:e.target.value}))}/></label>
    </div>
    <p className="ef-note">Los cambios económicos con efecto contractual deben respaldarse mediante un anexo. Este formulario no genera anexos ni autoriza pagos.</p>
    <div className="la-inline-actions">
     <button type="button" className="primary la-small"
      disabled={busy||!editingAssignment.validFrom||!validMoney(editingAssignment.amountOverrideClp)}
      onClick={async()=>{const d=editingAssignment;
       const ok=await execute(()=>api('/labor-bonuses/workers/'+employeeId+'/assignments/'+d.id,{
        method:'PUT',body:JSON.stringify({revision:d.revision,active:d.active,validFrom:d.validFrom,
         amountOverrideClp:amountToNumber(d.amountOverrideClp),notes:d.notes})}));
       if(ok)setEditingAssignment(null);
      }}>Guardar asignación</button>
     <button type="button" className="la-small" onClick={()=>setEditingAssignment(null)}>Cancelar</button>
    </div>
   </div>}

   {!!unassigned.length&&<div className="ef-bonus-editor">
    <h4>Agregar bono</h4>
    <div className="ef-grid">
     <label>Bono
      <select value={bonusId} onChange={e=>{setBonusId(e.target.value);setAmountInput('');}}>
       <option value="">Seleccionar bono</option>
       {unassigned.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
      </select></label>
     <label>Monto individual CLP (vacío = catálogo)
      <input type="number" min="0" max="100000000" step="1" value={amountInput}
       onChange={e=>setAmountInput(e.target.value)}/></label>
     <label>Vigencia desde
      <input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
     <label className="ef-field-wide">Observación administrativa (opcional)
      <textarea rows={2} maxLength={1000} value={notesInput}
       onChange={e=>setNotesInput(e.target.value)}/></label>
    </div>
    {selectedBonus&&<div className="ef-bonus-preview" aria-live="polite">
     <span><strong>Monto del catálogo:</strong> {money(selectedBonus.amountClp)} CLP</span>
     <span><strong>Imponibilidad:</strong> {selectedBonus.taxable?'Imponible':'No imponible'}</span>
     <span style={{whiteSpace:'pre-wrap'}}><strong>Condiciones y métricas:</strong> {selectedBonus.conditions||'No documentadas'}</span>
    </div>}
    <button type="button" className="primary la-small"
     disabled={busy||!bonusId||!from||!validMoney(amountInput)}
     onClick={async()=>{
      const ok=await execute(()=>api('/labor-bonuses/workers/'+employeeId+'/assignments',{
       method:'POST',body:JSON.stringify({bonusId:Number(bonusId),amountOverrideClp:amountToNumber(amountInput),
        validFrom:from,notes:notesInput})}));
      if(ok){setBonusId('');setAmountInput('');setNotesInput('');}
     }}>+ Agregar bono</button>
   </div>}
   {!catalog.length&&<p className="ef-note">Crea los bonos desde Gestión → Contabilidad Laboral → Bonos; el cálculo futuro se hará en el sistema contable.</p>}
   {!!catalog.length&&!unassigned.length&&<p className="ef-note">Todos los bonos disponibles ya están vinculados.</p>}
   {!!legacyEvaluations.length&&<details>
    <summary>Evaluaciones históricas existentes ({legacyEvaluations.length})</summary>
    <p className="ef-note">Registros anteriores conservados solo para consulta; esta ficha ya no calcula ni genera nuevas evaluaciones.</p>
    <div className="la-scroll"><table>
     <thead><tr><th>Período</th><th>Registro anterior</th><th>Estado histórico</th></tr></thead>
     <tbody>{legacyEvaluations.map(e=><tr key={e.id}>
      <td>{e.period}</td><td>{e.correctUnits}/{e.plannedUnits} unidades correctas</td>
      <td>Solo referencia anterior, no pago</td>
     </tr>)}</tbody>
    </table></div>
   </details>}
  </>}
 </fieldset>;
}
