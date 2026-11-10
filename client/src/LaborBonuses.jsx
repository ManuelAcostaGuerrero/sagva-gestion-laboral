import React,{useEffect,useState} from 'react';
import {api} from './services/api.js';
const blank=()=>({code:'',name:'',kind:'BONO_REMUNERACIONAL',reason:''});
export default function LaborBonuses(){
 const [types,setTypes]=useState([]),[manage,setManage]=useState(false),[form,setForm]=useState(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 async function load(){
  const x=await api('/labor-benefits/bonus-types');
  setTypes(x.types||[]);setManage(!!x.canManage);
 }
 useEffect(()=>{load().catch(e=>setError(e.message));},[]);
 async function save(e){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   const isEdit=!!form.id;
   const payload=isEdit?{name:form.name,active:form.active,revision:form.revision,reason:form.reason}:form;
   await api(isEdit?'/labor-benefits/bonus-types/'+form.id:'/labor-benefits/bonus-types',
     {method:isEdit?'PUT':'POST',body:JSON.stringify(payload)});
   await load();setForm(null);setNotice('Concepto guardado con historial.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <section className="ef-section">
  <h3>Catálogo de bonos y asignaciones</h3>
  <p className="ef-note">Aquí se definen los conceptos, no los montos individuales. La ficha del trabajador guarda importes y la casilla de cláusulas, sin calcular descuentos.</p>
  {error&&<p role="alert" className="ef-note">{error}</p>}
  {notice&&<p role="status" className="ef-note">{notice}</p>}
  <div className="la-scroll"><table><thead><tr><th>Concepto</th><th>Clase</th><th>Estado</th><th></th></tr></thead><tbody>
   {types.map(t=><tr key={t.id}><td>{t.name}</td><td>{t.kind==='ASIGNACION_PERDIDA_CAJA'?'Asignación de pérdida de caja':'Bono remuneracional'}</td><td>{t.active?'Activo':'Inactivo'}</td>
    <td>{manage&&<button type="button" onClick={()=>setForm({...t,reason:''})}>Editar</button>}</td></tr>)}
  </tbody></table></div>
  {manage&&<><button type="button" onClick={()=>setForm(blank())}>Agregar tipo de bono</button>
   {form&&<form className="ef-grid" onSubmit={save}>
    {!form.id&&<label>Código interno<input required minLength={2} maxLength={40} value={form.code}
      onChange={e=>setForm(x=>({...x,code:e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g,'')}))}/></label>}
    <label>Nombre<input required minLength={2} maxLength={120} value={form.name} onChange={e=>setForm(x=>({...x,name:e.target.value}))}/></label>
    {!form.id&&<label>Clase<select value={form.kind} onChange={e=>setForm(x=>({...x,kind:e.target.value}))}>
     <option value="BONO_REMUNERACIONAL">Bono remuneracional</option>
     <option value="ASIGNACION_PERDIDA_CAJA">Asignación por pérdida de caja</option>
    </select></label>}
    {!!form.id&&<label>Estado<select value={form.active?'1':'0'} onChange={e=>setForm(x=>({...x,active:e.target.value==='1'}))}>
     <option value="1">Activo</option><option value="0">Inactivo</option>
    </select></label>}
    <label className="ef-field-wide">Motivo de la modificación<textarea required minLength={10} maxLength={500} rows={2} value={form.reason} onChange={e=>setForm(x=>({...x,reason:e.target.value}))}/></label>
    <div className="ef-field-wide"><button type="submit" disabled={busy}>Guardar concepto</button> <button type="button" onClick={()=>setForm(null)}>Cancelar</button></div>
   </form>}
  </>}
  <p className="ef-note">Asignación por pérdida de caja y bono de producción son figuras distintas. Los requisitos pactados deberán revisarse antes de diseñar evaluaciones, pagos o descuentos.</p>
 </section>;
}
