import DateField from './DateField.jsx';
import React,{useEffect,useState} from 'react';
import {api} from './services/api.js';
import './medicalLeaves.css';

const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);};
const fresh=()=>({folio:'',issuedOn:today(),receivedOn:today(),startOn:'',endOn:'',status:'RECIBIDA',notes:''});
const statuses={RECIBIDA:'Recibida',EN_TRAMITACION:'En tramitación',APROBADA:'Aprobada',RECHAZADA:'Rechazada',ANULADA:'Anulada'};
const date=value=>value?value.split('-').reverse().join('/'):'—';
export default function MedicalLeaves({employeeId,onMessage,hasUnsavedChanges=false}){
  const [leaves,setLeaves]=useState([]);
  const [editing,setEditing]=useState(null),[draft,setDraft]=useState(fresh);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [files,setFiles]=useState({}),[uploads,setUploads]=useState({});
  async function reload(){
    const result=await api('/medical-leaves/workers/'+employeeId);
    setLeaves(result.leaves);
  }
  useEffect(()=>{
    if(!employeeId)return;
    let alive=true;
    api('/medical-leaves/workers/'+employeeId).then(result=>{if(alive){setLeaves(result.leaves);setError('');}})
      .catch(e=>{if(alive)setError(e.message);});
    setEditing(null);setDraft(fresh());setFiles({});setUploads({});
    return()=>{alive=false;};
  },[employeeId]);
  function change(key,value){setDraft(old=>({...old,[key]:value}));}
  function reset(){setEditing(null);setDraft(fresh());}
  function startEdit(leave){
    setEditing(leave.id);
    setDraft(Object.fromEntries(Object.keys(fresh()).map(key=>[key,leave[key]||''])));
    setError('');
  }
  async function save(){
    if(hasUnsavedChanges)return setError('Guarda primero los cambios de la ficha general.');
    setBusy(true);setError('');
    try{
      const result=await api(editing?'/medical-leaves/'+editing:'/medical-leaves/workers/'+employeeId,{
        method:editing?'PUT':'POST',body:JSON.stringify(draft)
      });
      await reload();reset();
      window.dispatchEvent(new Event('attendance:medical-leaves-changed'));
      onMessage?.(result.message);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function upload(id){
    const file=uploads[id];
    if(!file||file.size>8*1024*1024||!file.name.toLowerCase().endsWith('.pdf'))
      return setError('Selecciona un PDF de hasta 8 MB.');
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/medical-leaves/'+id+'/pdf',{
        method:'POST',headers:{Authorization:'Bearer '+(localStorage.getItem('token')||''),'Content-Type':'application/pdf'},
        body:file
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.message||'No se pudo guardar el PDF.');
      await reload();
      setUploads(old=>{const next={...old};delete next[id];return next;});
      onMessage?.(result.message);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function loadFiles(id){
    try{const result=await api('/medical-leaves/'+id+'/files');setFiles(old=>({...old,[id]:result.files}));}
    catch(e){setError(e.message);}
  }
  async function download(id){
    try{
      const response=await fetch('/api/medical-leaves/files/'+id+'/pdf',{
        headers:{Authorization:'Bearer '+(localStorage.getItem('token')||'')}
      });
      if(!response.ok)throw new Error('No fue posible descargar el PDF.');
      const url=URL.createObjectURL(await response.blob());
      const anchor=document.createElement('a');
      anchor.href=url;anchor.download='licencia-medica-'+id+'.pdf';
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
    }catch(e){setError(e.message);}
  }
  const days= draft.startOn&&draft.endOn && draft.endOn>=draft.startOn ?
    Math.round((Date.parse(draft.endOn+'T00:00Z')-Date.parse(draft.startOn+'T00:00Z'))/86400000)+1:0;
  return <section className="ml-module" aria-label="Licencias médicas" onKeyDown={e=>{if(e.key==='Enter')e.preventDefault();}}>
    <div className="ml-heading"><h3>Licencias médicas</h3><span>Registro reservado al personal autorizado</span></div>
    {error&&<p className="ef-note" role="alert">{error}</p>}
    {hasUnsavedChanges&&<p className="ef-note">Guarda primero los cambios de la ficha general.</p>}
    <div className="ml-panel">
      <h4>{editing?'Corregir licencia registrada':'Registrar nueva licencia'}</h4>
      <div className="ef-grid">
        <label>Folio<input value={draft.folio} maxLength={100} onChange={e=>change('folio',e.target.value)}/></label>
        <label>Fecha de emisión<DateField  value={draft.issuedOn||''} onChange={e=>change('issuedOn',e.target.value)}/></label>
        <label>Fecha de recepción<DateField  value={draft.receivedOn||''} onChange={e=>change('receivedOn',e.target.value)}/></label>
        <label>Inicio de licencia<DateField  value={draft.startOn} onChange={e=>change('startOn',e.target.value)}/></label>
        <label>Término de licencia<DateField  value={draft.endOn} min={draft.startOn||undefined} onChange={e=>change('endOn',e.target.value)}/></label>
        <label>Días corridos<input value={days||''} disabled readOnly aria-label="Total de días de licencia"/></label>
        <label>Estado<select value={draft.status} onChange={e=>change('status',e.target.value)}>
          {Object.entries(statuses).map(([id,label])=><option key={id} value={id}>{label}</option>)}
        </select></label>
        <label className="ef-field-wide">Observaciones administrativas (sin diagnóstico)<textarea rows={2} maxLength={1000}
          value={draft.notes||''} onChange={e=>change('notes',e.target.value)}/></label>
      </div>
      <div className="ml-actions">
        <button type="button" className="primary" disabled={busy||hasUnsavedChanges||!days} onClick={save}>
          {editing?'Guardar corrección':'Registrar licencia'}
        </button>
        {editing&&<button type="button" disabled={busy} onClick={reset}>Cancelar corrección</button>}
      </div>
      <p>Si esta licencia coincide con un turno ya creado, sus horas se conservan y la casilla aparece con fondo rojo. No se borran horarios publicados ni borradores.</p>
    </div>
    <div className="ml-history">
      <h4>Historial de licencias ({leaves.length})</h4>
      {leaves.map(leave=><article key={leave.id} className="ml-item">
        <div className="ml-item-head">
          <strong>{date(leave.startOn)} – {date(leave.endOn)} · {leave.days} días</strong>
          <span className="ef-badge">{statuses[leave.status]}</span>
        </div>
        <p>Folio: {leave.folio||'Sin informar'} · Entregada: {date(leave.receivedOn)}
          {leave.pdfCount?' · PDF respaldado':' · SIN DOCUMENTO ADJUNTO'}</p>
        <div className="ml-actions">
          <button type="button" disabled={busy} onClick={()=>startEdit(leave)}>Corregir / cambiar estado</button>
          <button type="button" disabled={busy} onClick={()=>loadFiles(leave.id)}>Ver respaldos ({leave.pdfCount})</button>
        </div>
        {Array.isArray(files[leave.id])&&<div className="ml-files">
          {files[leave.id].map(file=><button type="button" key={file.id} onClick={()=>download(file.id)}>
            Descargar PDF · {file.uploadedAt}
          </button>)}
          {!files[leave.id].length&&<p>No existen archivos PDF.</p>}
        </div>}
        <div className="ml-upload">
          <label>Adjuntar PDF (hasta 8 MB)
            <input type="file" accept="application/pdf,.pdf" disabled={busy||hasUnsavedChanges}
              onChange={e=>setUploads(old=>({...old,[leave.id]:e.target.files?.[0]||null}))}/>
          </label>
          <button type="button" disabled={busy||hasUnsavedChanges||!uploads[leave.id]} onClick={()=>upload(leave.id)}>Guardar PDF</button>
        </div>
      </article>)}
      {!leaves.length&&<p>No hay licencias médicas registradas.</p>}
    </div>
  </section>;
}
