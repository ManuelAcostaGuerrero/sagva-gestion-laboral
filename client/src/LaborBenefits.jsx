
import React,{useEffect,useState} from 'react';
import {api} from './services/api.js';
const today=()=>new Date().toISOString().slice(0,10);
export default function LaborBenefits({mode='banks'}){
 const [banks,setBanks]=useState([]),[bands,setBands]=useState([]),[canManage,setCanManage]=useState(false);
 const [edit,setEdit]=useState(null),[reason,setReason]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [effective,setEffective]=useState(today),[reference,setReference]=useState('enero a junio del año correspondiente'),[source,setSource]=useState('https://www.suseso.gob.cl/606/w3-article-498133.html');
 async function load(){
  const result=mode==='banks'?await api('/labor-benefits/banks'):await api('/labor-benefits/family-brackets?on='+today());
  setCanManage(!!result.canManage);
  if(mode==='banks')setBanks(result.banks||[]);
  else setBands(result.current||[]);
 }
 useEffect(()=>{setError('');setNotice('');setEdit(null);load().catch(e=>setError(e.message));},[mode]);
 async function post(url,method,body){
  setBusy(true);setError('');setNotice('');
  try{
   await api(url,{method,body:JSON.stringify(body)});
   await load();setEdit(null);setReason('');setNotice('Registro actualizado y auditado.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 if(mode==='banks')return <section className="ef-section"><h3>Catálogo de bancos de Chile</h3>
  <p>Lista inicial referenciada en la CMF. Desactivar conserva cuentas vinculadas e historial. Solo personal expresamente autorizado puede administrarla.</p>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <div className="la-scroll"><table><thead><tr><th>Código</th><th>Banco</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
  {banks.map(b=><tr key={b.id}><td>{b.code}</td><td>{b.name}</td><td>{b.active?'Activo':'Inactivo'}</td><td>{canManage&&<button type="button" onClick={()=>{setEdit({...b});setReason('');}}>Editar</button>}</td></tr>)}
  </tbody></table></div>
  {canManage&&<>
   <button type="button" onClick={()=>{setEdit({code:'',name:'',sourceUrl:'',active:true});setReason('');}}>Agregar banco</button>
   {edit&&<form onSubmit={e=>{e.preventDefault();post(edit.id?'/labor-benefits/banks/'+edit.id:'/labor-benefits/banks',edit.id?'PUT':'POST',edit.id?{name:edit.name,active:!!edit.active,revision:edit.revision,reason}:{code:edit.code,name:edit.name,sourceUrl:edit.sourceUrl||undefined,reason});}}>
    <fieldset disabled={busy}><legend>{edit.id?'Modificar banco':'Nuevo banco'}</legend>
    <div className="ef-grid">
     {!edit.id&&<label>Código<input required value={edit.code} onChange={e=>setEdit(x=>({...x,code:e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g,'')}))}/></label>}
     <label>Nombre<input required minLength={2} value={edit.name} onChange={e=>setEdit(x=>({...x,name:e.target.value}))}/></label>
     {edit.id?<label>Estado<select value={edit.active?'active':'inactive'} onChange={e=>setEdit(x=>({...x,active:e.target.value==='active'}))}><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label>:
      <label>Fuente normativa<input type="url" value={edit.sourceUrl||''} onChange={e=>setEdit(x=>({...x,sourceUrl:e.target.value}))}/></label>}
     <label className="ef-field-wide">Motivo<textarea required minLength={10} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    </div><button type="submit">Guardar banco</button><button type="button" onClick={()=>setEdit(null)}>Cancelar</button></fieldset>
   </form>}
  </>}
 </section>;
 const draft=edit?.tiers||bands.map(b=>({tier:b.tier,incomeFrom:b.incomeFrom,incomeTo:b.incomeTo,amountClp:b.amountClp}));
 const updateTier=(i,key,v)=>setEdit(previous=>{
  const items=[...(previous?.tiers||draft)].map(x=>({...x}));
  items[i][key]=v;for(let j=1;j<items.length;j++)items[j].incomeFrom=Number(items[j-1].incomeTo)+1;
  return {tiers:items};
 });
 return <section className="ef-section"><h3>Tramos de asignación familiar</h3>
  <p>Valores por ingreso promedio y fecha. No calculan ni pagan beneficios. Verificar el semestre aplicable de la resolución correspondiente.</p>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <div className="la-scroll"><table><thead><tr><th>Tramo</th><th>Ingresos desde</th><th>Ingresos hasta</th><th>Valor por carga</th></tr></thead><tbody>
   {bands.map(b=><tr key={b.tier}><td>{b.tier}</td><td>{b.incomeFrom.toLocaleString('es-CL')}</td><td>{b.incomeTo==null?'Sin límite':b.incomeTo.toLocaleString('es-CL')}</td><td>{b.amountClp.toLocaleString('es-CL')} CLP</td></tr>)}
  </tbody></table></div>
  {bands[0]&&<p className="ef-note">Versión desde {bands[0].effectiveFrom}. Período de ingresos: {bands[0].incomeReference}. Fuente: <a href={bands[0].sourceUrl} target="_blank" rel="noreferrer">SUSESO</a>.</p>}
  {canManage&&<>
   <button type="button" onClick={()=>{setEdit({tiers:bands.map(b=>({tier:b.tier,incomeFrom:b.incomeFrom,incomeTo:b.incomeTo,amountClp:b.amountClp}))});setReason('');}}>Crear versión de tramos</button>
   {edit&&<form onSubmit={e=>{e.preventDefault();post('/labor-benefits/family-brackets','POST',{effectiveFrom:effective,incomeReference:reference,sourceUrl:source,reason,tiers:edit.tiers});}}>
    <fieldset disabled={busy}><legend>Nueva versión (no reemplaza histórica)</legend>
    <div className="ef-grid">
     <label>Vigente desde<input type="date" required value={effective} onChange={e=>setEffective(e.target.value)}/></label>
     <label>Semestre de ingresos de referencia<input required value={reference} onChange={e=>setReference(e.target.value)}/></label>
     <label className="ef-field-wide">Fuente oficial<input type="url" required value={source} onChange={e=>setSource(e.target.value)}/></label>
     {edit.tiers.map((t,i)=><React.Fragment key={i}>
      {i<3&&<label>Tramo {i+1}: ingreso máximo<input type="number" min={t.incomeFrom} required value={t.incomeTo} onChange={e=>updateTier(i,'incomeTo',Number(e.target.value))}/></label>}
      <label>Tramo {i+1}: monto CLP<input type="number" min="0" required value={t.amountClp} onChange={e=>updateTier(i,'amountClp',Number(e.target.value))}/></label>
     </React.Fragment>)}
     <label className="ef-field-wide">Motivo<textarea required minLength={10} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    </div><button type="submit">Guardar nueva versión</button><button type="button" onClick={()=>setEdit(null)}>Cancelar</button></fieldset>
   </form>}
  </>}
 </section>;
}
