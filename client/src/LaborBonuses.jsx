import React,{useEffect,useState} from 'react';
import {api} from './services/api.js';

const blank=()=>({code:'',name:'',kind:'BONO',amountClp:0,taxable:true,overtimeBase:false,withClause:false,clauseText:'',evaluationRules:'',legalReviewed:false,active:true,reason:''});
const money=value=>Number(value||0).toLocaleString('es-CL');
export default function LaborBonuses(){
 const [data,setData]=useState({bonuses:[],canManage:false}),[draft,setDraft]=useState(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>setData(await api('/labor-bonuses/catalog'));
 useEffect(()=>{load().catch(e=>setError(e.message));},[]);
 const change=(key,value)=>setDraft(s=>({...s,[key]:value}));
 async function save(e){
  e.preventDefault();if(!draft)return;
  setBusy(true);setError('');setNotice('');
  try{
   await api('/labor-bonuses/catalog'+(draft.id?'/'+draft.id:''),{method:draft.id?'PUT':'POST',body:JSON.stringify(draft)});
   await load();setDraft(null);setNotice('Concepto guardado con historial y auditoría.');
  }catch(err){setError(err.message);}finally{setBusy(false);}
 }
 return <section className="ef-section">
  <h3>Catálogo de bonos y otros conceptos</h3>
  <p className="ef-note">Cada trabajador puede tener varios conceptos. «Imponible» y «Base de horas extraordinarias» son decisiones distintas: requieren validación legal. Las evaluaciones no modifican remuneraciones.</p>
  {error&&<p role="alert" className="ef-note">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <div className="la-scroll"><table><thead><tr><th>Concepto</th><th>Monto CLP</th><th>Imponible</th><th>Horas extras</th><th>Cláusula</th><th>Revisión</th><th></th></tr></thead>
   <tbody>{data.bonuses.map(b=><tr key={b.id}><td><strong>{b.name}</strong><small style={{display:'block'}}>{b.code} · {b.kind}{b.active?'':' · Inactivo'}</small></td><td>{money(b.amountClp)}</td><td>{b.taxable?'Sí':'No'}</td><td>{b.overtimeBase?'Sí':'No'}</td><td>{b.withClause?'Sí':'No'}</td><td>{b.legalReviewed?'Verificada':'Pendiente'}</td>
    <td>{data.canManage&&<button type="button" className="la-small" onClick={()=>{setDraft({...b,reason:''});setError('');}}>Editar</button>}</td></tr>)}
   {!data.bonuses.length&&<tr><td colSpan={7}>Aún no hay conceptos creados.</td></tr>}</tbody></table></div>
  {data.canManage&&<button type="button" className="la-small" onClick={()=>setDraft(blank())}>Agregar concepto</button>}
  {draft&&<form onSubmit={save}><fieldset className="ef-section" disabled={busy}>
   <legend>{draft.id?'Editar concepto':'Nuevo concepto'}</legend>
   <div className="ef-grid">
    <label>Código<input required maxLength={40} value={draft.code} onChange={e=>change('code',e.target.value.toLocaleUpperCase('es-CL').replace(/[^A-Z0-9_]/g,''))}/></label>
    <label>Nombre<input required maxLength={120} value={draft.name} onChange={e=>change('name',e.target.value)}/></label>
    <label>Tipo<select value={draft.kind} onChange={e=>change('kind',e.target.value)}>
     <option value="BONO">Bono</option><option value="VIATICO">Viático</option><option value="OTRO">Otro concepto</option></select></label>
    <label>Monto máximo o de referencia (CLP)<input type="number" min="0" max="100000000" step="1" value={draft.amountClp} onChange={e=>change('amountClp',Number(e.target.value))}/></label>
    <label className="la-check"><input type="checkbox" checked={draft.taxable} onChange={e=>change('taxable',e.target.checked)}/> Imponible</label>
    <label className="la-check"><input type="checkbox" checked={draft.overtimeBase} onChange={e=>change('overtimeBase',e.target.checked)}/> Integra base de horas extraordinarias (revisión jurídica)</label>
    <label className="la-check"><input type="checkbox" checked={draft.withClause} onChange={e=>change('withClause',e.target.checked)}/> Con cláusula contractual</label>
    <label className="la-check"><input type="checkbox" checked={draft.legalReviewed} onChange={e=>change('legalReviewed',e.target.checked)}/> Clasificación revisada jurídicamente</label>
    <label className="la-check"><input type="checkbox" checked={draft.active} onChange={e=>change('active',e.target.checked)}/> Activo</label>
    {draft.withClause&&<label className="ef-field-wide">Cláusula o condiciones contractuales<textarea rows={4} maxLength={5000} value={draft.clauseText} onChange={e=>change('clauseText',e.target.value)}/></label>}
    <label className="ef-field-wide">Criterios de evaluación (documentación, no cálculo)<textarea rows={4} maxLength={5000} value={draft.evaluationRules} onChange={e=>change('evaluationRules',e.target.value)} placeholder="Ej.: cantidad de cierres de caja correctos por mes y registros verificados"/></label>
    <label className="ef-field-wide">Motivo del cambio<textarea required minLength={10} maxLength={500} rows={2} value={draft.reason||''} onChange={e=>change('reason',e.target.value)}/></label>
   </div><div className="la-inline-actions"><button type="submit" className="primary la-small" disabled={busy}>Guardar concepto</button><button type="button" className="la-small" onClick={()=>setDraft(null)}>Cancelar</button></div>
  </fieldset></form>}
 </section>;
