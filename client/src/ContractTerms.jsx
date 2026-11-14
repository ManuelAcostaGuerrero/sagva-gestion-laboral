import PesoField from './PesoField.jsx';
import React,{forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {api} from './services/api.js';
import {blankContractTerms} from '../../server/src/contractTerms.js';
import ContractShiftSelector from './ContractShiftSelector.jsx';
import {summarizeShiftPlan,updateDraftShiftPlan} from './contractShiftSummary.js';

function todayInChile(){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'})
  .formatToParts(new Date());
 const value=kind=>parts.find(p=>p.type===kind)?.value;
 return value('year')+'-'+value('month')+'-'+value('day');
}

const ContractTerms = forwardRef(function ContractTerms({employeeId,positionName,areaId,positions=[],suggestedWorkplace='',onDirtyChange},ref){
 const [draft,setDraft]=useState(blankContractTerms),[saved,setSaved]=useState(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const [jobTemplates,setJobTemplates]=useState([]);
 // Se consulta la referencia ordinaria GENERAL vigente en Chile; no se infiere
 // ni declara que el trabajador esté afecto a ese régimen ni se guarda una fecha.
 const [jornadaAssessment,setJornadaAssessment]=useState(null);
 const [jornadaAssessmentError,setJornadaAssessmentError]=useState('');
 const previousTemplate=useRef('');
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
 useEffect(()=>{
  let active=true;
  setJornadaAssessment(null);setJornadaAssessmentError('');
  if(draft.weeklyHours===''||draft.weeklyHours===null)return ()=>{active=false;};
  const query=new URLSearchParams({on:todayInChile(),regime:'GENERAL',weeklyHours:String(draft.weeklyHours)});
  api('/contract-terms/jornada/assessment?'+query.toString())
   .then(result=>{if(active)setJornadaAssessment(result);})
   .catch(e=>{if(active)setJornadaAssessmentError(e.message);});
  return ()=>{active=false;};
 },[draft.weeklyHours]);
 const change=(key,value)=>setDraft(current=>({...current,[key]:value}));
 const template=jobTemplates.find(x=>Number(x.areaId)===Number(areaId)&&x.positionName===positionName);
 useEffect(()=>{
  if(loading||saved===null||!template?.duties)return;
  const oldText=previousTemplate.current;
  setDraft(current=>(!current.jobDuties?.trim()||(oldText&&current.jobDuties===oldText))?{...current,jobDuties:template.duties}:current);
  previousTemplate.current=template.duties;
 },[loading,saved?.revision,template?.revision,areaId,positionName]);
 const changeShiftPlan=plan=>setDraft(current=>updateDraftShiftPlan(current,plan));
 const automaticShiftSummary=summarizeShiftPlan(draft.shiftPlan||[]);
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
    <PesoField value={draft.monthlyBaseSalary} onChange={digits=>change('monthlyBaseSalary',digits===''?'':Number(digits))}/></label>
   <label>Gratificación<select value={draft.gratification} onChange={e=>change('gratification',e.target.value)}>
    <option value="">Por definir</option><option value="ART_50">Artículo 50</option><option value="ART_47">Artículo 47</option><option value="OTHER">Otra modalidad (revisión)</option></select></label>
   <label>Horas semanales pactadas
    <input type="number" min="0" max="45" step=".5" value={draft.weeklyHours} onChange={e=>change('weeklyHours',e.target.value===''?'':Number(e.target.value))}/></label>
   {jornadaAssessmentError&&<p className="ef-note ef-field-wide" role="alert">No se pudo consultar el límite ordinario general: {jornadaAssessmentError}</p>}
   {jornadaAssessment&&<p className="ef-note ef-field-wide" role={jornadaAssessment.warning?'alert':'status'}>
    Referencia informativa para jornada ordinaria general al día de hoy: {jornadaAssessment.maxWeeklyHours} horas semanales.
    {jornadaAssessment.warning&&' '+jornadaAssessment.warning}
    {' '}No determina el régimen de este trabajador ni reemplaza la revisión de jornadas excepcionales, excluidas, contratos o sus vigencias.
   </p>}
   <label>Colación (minutos)
    <input type="number" min="0" max="240" step="1" value={draft.breakMinutes} onChange={e=>change('breakMinutes',e.target.value===''?'':Number(e.target.value))}/></label>
   <label>Lugar habitual de prestación
    <input autoComplete="off" name="sagva-workplace" value={draft.workplace} maxLength={500} onChange={e=>change('workplace',e.target.value.toLocaleUpperCase('es-CL'))} placeholder={suggestedWorkplace||'Por definir'}/></label>
   {suggestedWorkplace&&<div className="ef-field-wide">
    <button type="button" disabled={draft.workplace===suggestedWorkplace} onClick={()=>change('workplace',suggestedWorkplace)}>Usar sucursal sugerida: {suggestedWorkplace}</button>
    <p className="ef-note">Sugerencia opcional; no modifica el lugar histórico sin confirmación.</p>
   </div>}
   <ContractShiftSelector value={draft.shiftPlan||[]} disabled={busy||loading} onChange={changeShiftPlan}/>
   <div className="ef-field-wide csp-summary-review">
    <strong>Resumen de jornada agrupado por días (automático)</strong>
    {automaticShiftSummary?
      <p className="csp-summary-text">{automaticShiftSummary}</p>:
      <p className="ef-note">Sin turnos seleccionados. Selecciona primero los días y horarios.</p>}
    <small>Evita repetir los mismos turnos por cada día. Es una vista de revisión, no un contrato ni prueba de que se trabajen todos los turnos a la vez. El detalle completo permanece guardado en la selección estructurada.</small>
    {automaticShiftSummary!==draft.shiftDistribution&&<button type="button" className="la-small"
      disabled={!automaticShiftSummary} onClick={()=>change('shiftDistribution',automaticShiftSummary)}>
      Usar este resumen en el texto guardado
    </button>}
   </div>
   <label className="ef-field-wide">Texto de jornada para revisión jurídica (editable)
    <textarea rows={4} maxLength={2000} value={draft.shiftDistribution||''}
     onChange={e=>change('shiftDistribution',e.target.value)}/></label>
   <label className="ef-field-wide">Funciones del cargo
    <textarea rows={4} maxLength={5000} value={draft.jobDuties}
     onChange={e=>change('jobDuties',e.target.value.toLocaleUpperCase('es-CL'))}/></label>
   {template?.duties&&<div className="ef-field-wide"><button type="button" className="la-small" onClick={()=>change('jobDuties',template.duties)}>Usar funciones aprobadas: {template.areaName} · {positionName}</button>
     <p className="ef-note">Puedes personalizar el texto de esta ficha sin modificar el catálogo ni contratos históricos.</p></div>}
   {!template?.duties&&position?.description&&<div className="ef-field-wide">
     <button type="button" onClick={()=>change('jobDuties',position.description)}>Usar descripción del cargo {position.name}</button>
   </div>}
   <label className="ef-field-wide">Condiciones adicionales para revisión jurídica
    <textarea rows={3} maxLength={2000} value={draft.additionalTerms}
     onChange={e=>change('additionalTerms',e.target.value.toLocaleUpperCase('es-CL'))}/></label>
   <p className="ef-note ef-field-wide" aria-live="polite">{dirty ? 'Cambios pendientes: usa Guardar ficha (botón general).' : saved?.revision ? 'Condiciones guardadas con historial.' : 'Sin condiciones registradas.'}</p>
  </div>}
 </fieldset>;
});
export default ContractTerms;
