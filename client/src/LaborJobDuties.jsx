import React,{useEffect,useState} from 'react';
import {api} from './services/api.js';
export default function LaborJobDuties(){
 const [templates,setTemplates]=useState([]),[areas,setAreas]=useState([]),[positions,setPositions]=useState([]),[canManage,setCanManage]=useState(false);
 const [areaId,setAreaId]=useState(''),[positionName,setPositionName]=useState('');
 const [duties,setDuties]=useState(''),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const chosen=templates.find(t=>t.areaId===Number(areaId)&&t.positionName===positionName);
 async function load(){
  const [t,a,p]=await Promise.all([api('/labor-job-duties'),api('/areas'),api('/positions?includeInactive=1')]);
  setTemplates(t.templates||[]);setCanManage(!!t.canManage);setAreas(a.areas||[]);setPositions(p.positions||[]);
 }
 useEffect(()=>{load().catch(e=>setError(e.message));},[]);
 useEffect(()=>{setDuties(chosen?.duties||'');setReason('');},[areaId,positionName,chosen?.revision]);
 async function save(e){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   const result=await api('/labor-job-duties',{method:'PUT',body:JSON.stringify({areaId:Number(areaId),positionName,duties,revision:chosen?.revision||0,reason})});
   await load();setNotice(result.message||'Plantilla guardada.');setReason('');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <section className="ef-section"><h3>Funciones del cargo por área</h3>
  <p>Transcribe aquí el documento correspondiente a cada área y cargo. Se guarda como texto editable con historial. La ficha autocompletará estas funciones y permitirá adaptarlas para cada trabajador.</p>
  {error&&<p className="ef-note" role="alert">{error}</p>}{notice&&<p className="ef-note" role="status">{notice}</p>}
  <form onSubmit={save}><fieldset className="ef-section" disabled={!canManage||busy}>
   <div className="ef-grid">
    <label>Área<select value={areaId} required onChange={e=>setAreaId(e.target.value)}><option value="">Seleccionar área</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <label>Cargo<select value={positionName} required onChange={e=>setPositionName(e.target.value)}><option value="">Seleccionar cargo</option>{positions.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}</select></label>
    <label className="ef-field-wide">Funciones textuales aprobadas<textarea rows={10} maxLength={5000} value={duties} onChange={e=>setDuties(e.target.value)} placeholder="Incorporar funciones transcritas del documento fuente."/></label>
    <label className="ef-field-wide">Motivo de la actualización<textarea required minLength={10} maxLength={500} rows={2} value={reason} onChange={e=>setReason(e.target.value)}/></label>
   </div>
   <div className="la-inline-actions"><button type="submit" className="primary la-small" disabled={!areaId||!positionName||!canManage||busy}>Guardar funciones</button><span>Versión: {chosen?.revision||'Nueva'}</span></div>
  </fieldset></form>
  {!canManage&&<p className="ef-note">Solo lectura. Para editar funciones se requiere permiso de configuración de campos laborales.</p>}
 </section>;
}
