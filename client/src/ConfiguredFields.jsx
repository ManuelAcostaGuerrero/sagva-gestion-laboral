import React,{forwardRef,useEffect,useImperativeHandle,useMemo,useState} from 'react';
import {api} from './services/api.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ConfiguredFields=forwardRef(function ConfiguredFields({employeeId,target,onDirtyChange},ref){
 const [fields,setFields]=useState([]),[saved,setSaved]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const changed=useMemo(()=>fields.filter(f=>{
  const before=saved.find(x=>x.id===f.id);
  return before&&!same(f.value,before.value);
 }),[fields,saved]);
 const dirty=changed.length>0;
 useEffect(()=>{onDirtyChange?.(dirty);},[dirty,onDirtyChange]);
 async function load(){
  if(!employeeId){setFields([]);setSaved([]);return;}
  const data=await api('/labor-fields/workers/'+employeeId+'?target='+target);
  setFields(data.fields||[]);setSaved(structuredClone(data.fields||[]));
 }
 useEffect(()=>{let active=true;setError('');if(!employeeId){setFields([]);setSaved([]);return()=>{active=false;};}
  api('/labor-fields/workers/'+employeeId+'?target='+target).then(x=>{
   if(active){setFields(x.fields||[]);setSaved(structuredClone(x.fields||[]));}
  }).catch(e=>{if(active)setError(e.message);});
  return()=>{active=false;};
 },[employeeId,target]);
 async function saveChanges(){
  if(!dirty||!employeeId)return;
  if(busy)throw new Error('Campos en proceso de guardado.');
  if(changed.some(f=>f.required&&(f.value===null||f.value===''||f.value===undefined)))
   throw new Error('Completa los campos configurados obligatorios antes de guardarlos.');
  setBusy(true);setError('');
  try{
   await api('/labor-fields/workers/'+employeeId,{method:'PUT',body:JSON.stringify({
    target,values:changed.map(f=>({fieldId:f.id,value:f.value===undefined?null:f.value,revision:f.valueRevision}))
   })});
   await load();
  }catch(e){setError(e.message);throw e;}finally{setBusy(false);}
 }
 useImperativeHandle(ref,()=>({saveChanges,isDirty:()=>dirty}),[dirty,changed,employeeId,target,busy]);
 const set=(id,value)=>setFields(x=>x.map(f=>f.id===id?{...f,value}:f));
 if(!employeeId)return <p className="ef-note">Guarda primero la ficha provisional para completar los campos configurados.</p>;
 if(!fields.length&&!error)return null;
 return <fieldset className="ef-section ef-field-wide" disabled={busy}>
  <legend>{target==='CONTRATO'?'Campos contractuales configurados':'Campos complementarios de la ficha'}</legend>
  <p className="ef-note">Las definiciones, tipos y opciones solo se administran en Gestión → Contabilidad Laboral. Aquí se registran los datos particulares del trabajador.</p>
  {error&&<p className="ef-note" role="alert">{error}</p>}
  <div className="ef-grid">
   {fields.map(f=><label key={f.id} className={f.canWrite?'':'ef-field-readonly'}>
    {f.label}{f.required?' *':''}{!f.active?' (histórico, solo lectura)':''}
    {f.type==='TEXT'&&<input type="text" maxLength={400} disabled={!f.canWrite} value={f.value??''} onChange={e=>set(f.id,e.target.value)}/>}
    {f.type==='NUMBER'&&<input type="number" step="any" disabled={!f.canWrite} value={f.value??''} onChange={e=>set(f.id,e.target.value===''?null:Number(e.target.value))}/>}
    {f.type==='DATE'&&<input type="date" disabled={!f.canWrite} value={f.value??''} onChange={e=>set(f.id,e.target.value)}/>}
    {f.type==='BOOLEAN'&&<select disabled={!f.canWrite} value={f.value===null||f.value===undefined?'':String(f.value)} onChange={e=>set(f.id,e.target.value===''?null:e.target.value==='true')}>
      <option value="">Sin informar</option><option value="true">Sí</option><option value="false">No</option></select>}
    {f.type==='SELECT'&&<select disabled={!f.canWrite} value={f.value??''} onChange={e=>set(f.id,e.target.value)}>
      <option value="">Sin informar</option>{f.options.map(x=><option value={x} key={x}>{x}</option>)}
      {f.value&&!f.options.includes(f.value)&&<option value={f.value}>{f.value} (histórico)</option>}</select>}
   </label>)}
  </div>
  {dirty&&<p className="ef-note" role="status">Cambios en campos configurados. Usa el botón general «Guardar ficha».</p>}
 </fieldset>;
});
export default ConfiguredFields;
