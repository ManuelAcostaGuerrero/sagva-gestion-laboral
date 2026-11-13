import PesoField from './PesoField.jsx';
import React,{useEffect,useState} from 'react';
import {api} from './services/api.js';

const blank=()=>({name:'',amountClp:0,taxable:true,conditions:''});
const money=value=>Number(value||0).toLocaleString('es-CL');

// Asistencia guarda los antecedentes del bono, no devenga ni paga remuneraciones.
export default function LaborBonuses(){
 const [data,setData]=useState({bonuses:[],canManage:false}),[draft,setDraft]=useState(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>setData(await api('/labor-bonuses/catalog'));
 useEffect(()=>{load().catch(e=>setError(e.message));},[]);
 const change=(key,value)=>setDraft(s=>({...s,[key]:value}));

 async function save(e){
  e.preventDefault();
  if(!draft)return;
  setBusy(true);setError('');setNotice('');
  try{
   const {id,revision,name,amountClp,taxable,conditions}=draft;
   await api('/labor-bonuses/catalog'+(id?'/'+id:''),{
    method:id?'PUT':'POST',
    body:JSON.stringify({name,amountClp,taxable,conditions,...(id?{revision}:{})})
   });
   await load();setDraft(null);
   setNotice('Bono registrado con historial y auditoría.');
  }catch(err){setError(err.message);}
  finally{setBusy(false);}
 }

 return <section className="ef-section" aria-label="Catálogo de bonos">
  <h3>Bonos</h3>
  <p className="ef-note">Registra el nombre, monto de referencia, si es imponible y las condiciones de cumplimiento.
   La evaluación y el pago corresponderán al sistema contable. La clasificación está sujeta a revisión legal.</p>
  {error&&<p role="alert" className="ef-note">{error}</p>}
  {notice&&<p role="status" className="ef-note">{notice}</p>}
  <div className="la-scroll"><table>
   <thead><tr><th>Nombre</th><th>Monto de referencia</th><th>Imponibilidad</th><th>Condiciones y métricas</th><th>Acción</th></tr></thead>
   <tbody>{data.bonuses.map(b=><tr key={b.id}>
    <td><strong>{b.name}</strong>{!b.active&&<small style={{display:'block'}}>Inactivo</small>}</td>
    <td>{money(b.amountClp)} CLP</td>
    <td>{b.taxable?'Imponible':'No imponible'}</td>
    <td style={{whiteSpace:'pre-wrap'}}>{b.conditions||'Sin condiciones documentadas; revisar antes de asignar.'}</td>
    <td>{data.canManage&&(b.assignedCount>0
     ? <span title="Las modificaciones con efecto contractual requieren anexo">Vinculado: cambios mediante anexo</span>
     : <button type="button" className="la-small" onClick={()=>{
        setDraft({id:b.id,revision:b.revision,name:b.name,amountClp:b.amountClp,
         taxable:b.taxable,conditions:b.conditions||''});
        setError('');setNotice('');
       }}>Editar</button>)}</td>
   </tr>)}
   {!data.bonuses.length&&<tr><td colSpan={5}>No hay bonos creados.</td></tr>}
   </tbody>
  </table></div>
  {data.canManage&&<button type="button" className="la-small" onClick={()=>{setDraft(blank());setError('');setNotice('');}}>+ Agregar bono</button>}
  {draft&&<form onSubmit={save}>
   <fieldset className="ef-section" disabled={busy}>
    <legend>{draft.id?'Editar bono sin asignaciones':'Nuevo bono'}</legend>
    <div className="ef-grid">
     <label>Nombre del bono
      <input required maxLength={120} value={draft.name} onChange={e=>change('name',e.target.value.toLocaleUpperCase('es-CL'))}
       placeholder="Bono de cierre de caja"/></label>
     <label>Monto de referencia (CLP)
      <PesoField required min={0} max={100000000} value={draft.amountClp} onChange={digits=>change('amountClp',Number(digits||0))}/></label>
     <label>¿Es imponible?
      <select value={draft.taxable?'SI':'NO'} onChange={e=>change('taxable',e.target.value==='SI')}>
       <option value="SI">Sí, imponible</option><option value="NO">No imponible</option>
      </select></label>
     <label className="ef-field-wide">Condiciones del bono y métricas de cumplimiento
      <textarea required rows={6} minLength={10} maxLength={5000} value={draft.conditions}
       onChange={e=>change('conditions',e.target.value.toLocaleUpperCase('es-CL'))}
       placeholder={'Ejemplo: se revisan los cierres de caja del mes. Si el 90 % o más son correctos, corresponde el 100 % del bono; con 80 % a 89 %, el 80 %. Estas condiciones requieren revisión y respaldo contractual.'}/></label>
    </div>
    <p className="ef-note">El código interno se genera automáticamente. Para modificar condiciones de un bono ya asignado se requerirá un anexo contractual; ese flujo se implementará posteriormente. Aquí no se calculan montos pagables ni descuentos.</p>
    <div className="la-inline-actions">
     <button type="submit" className="primary la-small" disabled={busy}>Guardar bono</button>
     <button type="button" className="la-small" disabled={busy} onClick={()=>setDraft(null)}>Cancelar</button>
    </div>
   </fieldset>
  </form>}
 </section>;
}
