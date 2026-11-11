import React,{forwardRef,useEffect,useImperativeHandle,useState} from 'react';
import {api} from './services/api.js';
import {blankContractTerms} from '../../server/src/contractTerms.js';
import ContractShiftSelector,{summarizeShiftPlan} from './ContractShiftSelector.jsx';

const ContractTerms = forwardRef(function ContractTerms({employeeId,positionName,areaId,positions=[],suggestedWorkplace='',onDirtyChange},ref){
 const [draft,setDraft]=useState(blankContractTerms),[saved,setSaved]=useState(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const [jobTemplates,setJobTemplates]=useState([]);
 const dirty=saved!==null&&JSON.stringify(saved)!==JSON.stringify(draft);
 useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false);},[dirty,onDirtyChange]);
 useEffect(()=>{
  let active=true;setLoading(true);setError('');
  api('/contract-terms/workers/'+employeeId).then(result=>{
   if(active){setSaved(result.terms);setDraft(structuredClone(result.terms));}
  }).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
  return ()=>{active=false;};
 },[employeeId]);
 useEffect(()=>{let active=true;api('/labor-job-duties').then(x=>{if(active)setJobTemplates(x.templates||[]);}).catch(()=>{});
  return()=>{active=false;};
 },[]);
 const change=(key,value)=>setDraft(current=>({...current,[key]:value}));
 const template=jobTemplates.find(x=>Number(x.areaId)===Number(areaId)&&x.positionName===positionName);
 useEffect(()=>{
  if(loading||saved===null||!template?.duties)return;
  setDraft(current=>current.jobDuties?.trim()?current:{...current,jobDuties:template.duties});
 },[loading,saved?.revision,template?.revision,areaId,positionName]);
 const changeShiftPlan=plan=>setDraft(current=>({...current,shiftPlan:plan,shiftDistribution:summarizeShiftPlan(plan)}));
 async function saveChanges(){
  if(!dirty)return;
  if(loading||busy||saved===null)throw new Error('Las condiciones aún están cargando.');
  setBusy(true);setError('');
  try{
   const result=await api('/contract-terms/workers/'+employeeId,{method:'PUT',body:JSON.stringify(draft)});
   setSaved(result.terms);setDraft(structuredClone(result.terms));
  }catch(e){setError(e.message);throw e;}finally{setBusy(false);}
 }
 useImperativeHandle(ref,()=>({saveChanges,isDirty:()=>dirty}),[dirty,draft,loading,busy,saved,employeeId]);
 const position=positions.find(p=>p.name===positionName);
 return <fieldset className="ef-section ef-field-wide" disabled={busy||loading}>
  <legend>Condiciones para un futuro contrato</legend>
  <p>Datos específicos de este trabajador. Se guardan con historial y no generan, firman ni registran un contrato.</p>
  {error&&<p className="ef-note" role="alert">{error}</p>}
  {loading?<p>Cargando condiciones…</p>:<div className="ef-grid">
   <label>Sueldo base mensual (CLP)
    <input type="text" inputMode="numeric" pattern="[0-9.]*" value={draft.monthlyBaseSalary===''?'':Number(draft.monthlyBaseSalary||0).toLocaleString('es-CL')}
     onChange={e=>{const digits=e.target.value.replace(/[^0-9]/g,'');change('monthlyBaseSalary',digits===''?'':Number(digits));}}/></label>
   <label>Gratificación<select value={draft.gratification} onChange={e=>change('gratification',e.target.value)}>
    <option value="">Por definir</option><option value="ART_50">Artículo 50</option><option value="ART_47">Artículo 47</option><option value="OTHER">Otra modalidad (revisión)</option></select></label>
   <label>Horas semanales pactadas
    <input type="number" min="0" max="45" step=".5" value={draft.weeklyHours} onChange={e=>change('weeklyHours',e.target.value===''?'':Number(e.target.value))}/></label>
   <label>Colación (minutos)
    <input type="number" min="0" max="240" step="1" value={draft.breakMinutes} onChange={e=>change('breakMinutes',e.target.value===''?'':Number(e.target.value))}/></label>
   <label>Medio de pago<select value={draft.paymentMethod} onChange={e=>change('paymentMethod',e.target.value)}>
    <option value="">Por definir</option>
    <option value="TRANSFERENCIA">Transferencia</option><option value="EFECTIVO">Efectivo</option>
    <option value="MIXTO">Transferencia y efectivo</option><option value="CHEQUE">Cheque</option><option value="OTRO">Otro</option></select></label>
   {draft.paymentMethod==='MIXTO'&&<label className="ef-field-wide">Detalle del pago mixto
    <input maxLength={1000} placeholder="Indicar distribución entre transferencia y efectivo" value={draft.paymentDetails||''} onChange={e=>change('paymentDetails',e.target.value)}/></label> 
   <label>Lugar habitual de prestación
    <input value={draft.workplace} maxLength={500} onChange={e=>change('workplace',e.target.value.toLocaleUpperCase('es-CL'))} placeholder={suggestedWorkplace||'Por definir'}/></label>
   {suggestedWorkplace&&<div className="ef-field-wide">
    <button type="button" disabled={draft.workplace===suggestedWorkplace} onClick={()=>change('workplace',suggestedWorkplace)}>Usar sucursal sugerida: {suggestedWorkplace}</button>
    <p className="ef-note">Sugerencia opcional; no modifica el lugar histórico sin confirmación.</p>
   </div>}
   <ContractShiftSelector value={draft.shiftPlan||[]} disabled={busy||loading} onChange={changeShiftPlan}/>
   <label className="ef-field-wide">Resumen textual de jornada para revisión
    <textarea rows={3} maxLength={2000} value={draft.shiftDistribution||''}
     onChange={e=>change('shiftDistribution',e.target.value)}/></label>
   <label className="ef-field-wide">Funciones del cargo
    <textarea rows={4} maxLength={5000} value={draft.jobDuties}
     onChange={e=>change('jobDuties',e.target.value)}/></label>
   {template?.duties&&<div className="ef-field-wide"><button type="button" className="la-small" onClick={()=>change('jobDuties',template.duties)}>Usar funciones aprobadas: {template.areaName} · {positionName}</button>
     <p className="ef-note">Puedes personalizar el texto de esta ficha sin modificar el catálogo ni contratos históricos.</p></div>}
   {!template?.duties&&position?.description&&<div className="ef-field-wide">
     <button type="button" onClick={()=>change('jobDuties',position.description)}>Usar descripción del cargo {position.name}</button>
   </div>}
   <label className="ef-field-wide">Condiciones adicionales para revisión jurídica
    <textarea rows={3} maxLength={2000} value={draft.additionalTerms}
     onChange={e=>change('additionalTerms',e.target.value)}/></label>
   <p className="ef-note ef-field-wide" aria-live="polite">{dirty ? 'Cambios pendientes: usa Guardar ficha (botón general).' : saved?.revision ? 'Condiciones guardadas con historial.' : 'Sin condiciones registradas.'}</p>
  </div>}
 </fieldset>;
});
export default ContractTerms;
