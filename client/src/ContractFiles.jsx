import React,{useState,useEffect} from 'react';
import {api} from './services/api.js';
import {contractPreparation} from '../../server/src/contractFiles.js';

export default function ContractFiles({file,dirty,target='contract',onMessage}) {
  const [attachments,setAttachments]=useState([]),[chosen,setChosen]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const annexOrder=target==='contract'?null:Number(target);
  const title=annexOrder?`Documento del Anexo ${annexOrder}`:'Documento del contrato';
  const saved=!!file.id && (!annexOrder || !!file.annexes?.[annexOrder-1]);
  const preparation=contractPreparation(file);
  async function reload() {
    const result=await api('/contract-files/workers/'+file.id);
    setAttachments(result.attachments.filter(a=>a.annexOrder===annexOrder));
  }
  useEffect(()=>{
    let active=true;setChosen(null);setError('');setAttachments([]);
    if(file.id)api('/contract-files/workers/'+file.id).then(result=>{if(active)setAttachments(result.attachments.filter(a=>a.annexOrder===annexOrder));}).catch(err=>{if(active)setError(err.message);});
    return ()=>{active=false;};
  },[file.id,file.revision,target]);
  async function upload() {
    setBusy(true);setError('');
    try {
      const response=await fetch(`/api/contract-files/workers/${file.id}/${target}/pdf`,{method:'POST',headers:{Authorization:'Bearer '+localStorage.getItem('token'),'Content-Type':'application/pdf','X-Ficha-Revision':String(file.revision)},body:chosen});
      const result=await response.json();if(!response.ok)throw new Error(result.message||'No se pudo cargar el PDF.');
      await reload();setChosen(null);onMessage?.(result.message);
    } catch(err){setError(err.message);}finally{setBusy(false);}
  }
  async function download(attachment) {
    setError('');
    try {
      const response=await fetch(`/api/contract-files/${attachment.id}/pdf`,{headers:{Authorization:'Bearer '+localStorage.getItem('token')}});
      if(!response.ok)throw new Error('No se pudo descargar el PDF.');
      const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download=attachment.filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    }catch(err){setError(err.message);}
  }
  return <div className="ef-note ef-field-wide">
    <strong>{title}</strong>
    {(!saved || dirty)&&<p>Guarda primero la ficha y el anexo antes de cargar su PDF.</p>}
    <label>Cargar PDF (máximo 8 MB)<input type="file" accept=".pdf,application/pdf" disabled={!saved||dirty||busy} onChange={e=>{
      const pdf=e.target.files?.[0];setError('');
      if(pdf && (!pdf.name.toLowerCase().endsWith('.pdf') || pdf.size>8*1024*1024)){setChosen(null);setError('Selecciona un PDF de hasta 8 MB.');return;}setChosen(pdf||null);
    }}/></label>
    <button type="button" disabled={!saved||dirty||busy||!chosen} onClick={upload}>Guardar PDF {annexOrder?'del anexo':'del contrato'}</button>
    {error&&<p role="alert">{error}</p>}
    {!attachments.length&&<p>Sin PDF adjunto.</p>}
    {attachments.map(a=><p key={a.id}>{a.filename} · {a.uploadedAt} · {a.uploadedByName} <button type="button" onClick={()=>download(a)}>Descargar PDF</button></p>)}
    {!annexOrder&&<>
      <button type="button" disabled title="La generación automática se incorporará en una próxima actualización">Generar contrato (próximamente)</button>
      {!!preparation.missing.length&&<p>Datos de la ficha pendientes: {preparation.missing.join(', ')}.</p>}
      {!preparation.missing.length&&<p>Datos actuales de la ficha completos{dirty?' · guarda los cambios pendientes':''}. La generación se habilitará cuando estén disponibles la plantilla y todos sus datos requeridos.</p>}
      <p>La futura generación requerirá también los datos del empleador, remuneración y condiciones de jornada definidos por la plantilla. Los PDFs cargados ahora se conservarán.</p>
    </>}
  </div>;
}
