import React,{useEffect,useMemo,useState} from 'react';
import {api} from './services/api.js';
import {laborMetrics,laborMetric,laborValuesAt,laborValue} from '../../shared/laborAccounting.js';
import './employeeFile.css';
import './laborAccounting.css';
import LaborBenefits from './LaborBenefits.jsx';
import LaborBonuses from './LaborBonuses.jsx';
const today=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);};
const format=v=>v?laborValue(v.valueHundredths).toLocaleString('es-CL',{maximumFractionDigits:2})+' '+(v.unit==='PERCENT'?'%':v.unit):'Sin configurar';
export default function LaborAccounting({role='admin',onMessage}){
 const [data,setData]=useState({entities:[],versions:[],entityHistory:[]});
 const [section,setSection]=useState('rates'),[date,setDate]=useState(today);
 const [rate,setRate]=useState({metric:'AFP_OBLIGATORIA',entityId:null,value:'10',effectiveFrom:today(),reason:'',sourceUrl:''});
 const [entity,setEntity]=useState(null);
 const [newEntity,setNewEntity]=useState({kind:'AFP',code:'',name:'',reason:''});
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const isAdmin=role==='admin';
 const current=useMemo(()=>laborValuesAt(data.versions,date),[data.versions,date]);
 const metric=laborMetric(rate.metric);
 const afps=data.entities.filter(e=>e.kind==='AFP');
 const get=(code,id)=>current[code+':'+(id??'GLOBAL')];
 async function load(){setData(await api('/labor-accounting'));}
 useEffect(()=>{load().catch(e=>setError(e.message));},[]);
 async function save(event,url,method,payload,done){
  event.preventDefault();setBusy(true);setError('');setMessage('');
  try{const res=await api(url,{method,body:JSON.stringify(payload)});
   await load();setMessage(res.message);onMessage?.(res.message);done?.();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 function chooseMetric(code){
  const m=laborMetric(code),id=m?.entityKind?afps.find(e=>e.active)?.id||null:null;
  const v=get(code,id);
  setRate({metric:code,entityId:id,value:v?String(laborValue(v.valueHundredths)):'',
   effectiveFrom:today(),reason:'',sourceUrl:v?.sourceUrl||''});
 }
 return <section className="ef module-content labor-accounting">
  <div className="ef-toolbar"><div><strong>Contabilidad Laboral · Parámetros Previsionales</strong>
   <p>Instituciones precargadas; tasas editables con fecha, motivo e historial.</p></div>
   <button type="button" disabled={busy} onClick={()=>load().catch(e=>setError(e.message))}>Actualizar</button></div>
  {error&&<p role="alert" className="ef-note">{error}</p>}
  {message&&<p role="status" className="ef-note">{message}</p>}
  <nav className="la-tabs" aria-label="Secciones previsionales">
   {[['rates','Valores y vigencias'],['entities','AFP e Isapres'],['banks','Bancos'],['family','Asignación familiar'],['bonuses','Bonos y asignaciones'],['history','Historial']].map(([key,label])=>
    <button type="button" key={key} className={section===key?'selected':''} onClick={()=>setSection(key)}>{label}</button>)}
  </nav>
  {section==='rates'&&<>
   <fieldset className="ef-section"><legend>Tasas vigentes</legend>
    <label>Fecha de consulta <input type="date" value={date} onChange={e=>setDate(e.target.value||today())}/></label>
    <p className="ef-note">El aporte total del empleador ya incluye los componentes detallados. No se suman dos veces. El valor de un plan Isapre corresponde al trabajador.</p>
    {['TRABAJADOR','AFP','TOPES','EMPLEADOR'].map(group=><div key={group} className="la-group">
     <h3>{({TRABAJADOR:'Descuentos del trabajador',AFP:'Comisiones AFP',TOPES:'Topes imponibles',EMPLEADOR:'Aportes del empleador'})[group]}</h3>
     <div className="la-scroll"><table><thead><tr><th>Parámetro</th><th>Institución</th><th>Valor</th><th>Vigente desde</th><th>Fuente</th></tr></thead>
      <tbody>{laborMetrics.filter(m=>m.group===group).flatMap(m=>
       (m.entityKind?data.entities.filter(e=>e.kind===m.entityKind&&e.active):[null]).map(e=>{
        const v=get(m.code,e?.id);
        return <tr key={m.code+'-'+(e?.id||'global')}><td>{m.label}</td><td>{e?.name||'General'}</td>
         <td><strong>{format(v)}</strong></td><td>{v?.effectiveFrom||'Pendiente'}</td>
         <td>{v?.sourceUrl?<a href={v.sourceUrl} target="_blank" rel="noreferrer">Oficial / respaldo</a>:'Manual'}</td></tr>;
       })
      )}</tbody>
     </table></div>
    </div>)}
   </fieldset>
   {isAdmin&&<form className="ef-section" onSubmit={e=>save(e,'/labor-accounting/parameters','POST',
    {...rate,value:Number(rate.value),entityId:metric?.entityKind?Number(rate.entityId):null},
    ()=>setRate(x=>({...x,reason:''})))}>
    <fieldset disabled={busy}><legend>Crear versión del parámetro</legend>
     <div className="ef-grid">
      <label>Parámetro<select value={rate.metric} onChange={e=>chooseMetric(e.target.value)}>
       {laborMetrics.map(m=><option key={m.code} value={m.code}>{m.label}</option>)}</select></label>
      {metric?.entityKind&&<label>AFP<select value={rate.entityId||''} onChange={e=>{
       const id=Number(e.target.value),v=get(rate.metric,id);
       setRate(x=>({...x,entityId:id,value:v?String(laborValue(v.valueHundredths)):'',sourceUrl:v?.sourceUrl||''}));
      }}><option value="">Seleccionar</option>{afps.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>}
      <label>Nuevo valor ({metric?.unit==='PERCENT'?'%':metric?.unit})
       <input type="number" min="0" step="0.01" required value={rate.value} onChange={e=>setRate(x=>({...x,value:e.target.value}))}/>
       <small>Anterior: {format(get(rate.metric,rate.entityId))}</small></label>
      <label>Vigente desde<input type="date" required value={rate.effectiveFrom} onChange={e=>setRate(x=>({...x,effectiveFrom:e.target.value}))}/></label>
      <label className="ef-field-wide">Motivo obligatorio<textarea required minLength={10} maxLength={500} rows={2} value={rate.reason} onChange={e=>setRate(x=>({...x,reason:e.target.value}))}/></label>
      <label className="ef-field-wide">Enlace normativo o respaldo (opcional)<input type="url" maxLength={500} value={rate.sourceUrl} onChange={e=>setRate(x=>({...x,sourceUrl:e.target.value}))}/></label>
     </div>
     <button type="submit" className="primary" disabled={busy||rate.value===''||rate.reason.trim().length<10||(metric?.entityKind&&!rate.entityId)}>Guardar nueva versión</button>
    </fieldset>
   </form>}
  </>}
  {section==='entities'&&<>
   <fieldset className="ef-section"><legend>Instituciones previsionales</legend>
    <p>Las instituciones inactivas siguen registradas y no se borran de los historiales.</p>
    <div className="la-scroll"><table><thead><tr><th>Tipo</th><th>Nombre</th><th>Código</th><th>Estado</th><th></th></tr></thead>
     <tbody>{data.entities.map(e=><tr key={e.id}><td>{e.kind}</td><td>{e.name}</td><td>{e.code}</td><td>{e.active?'Activa':'Inactiva'}</td>
      <td>{isAdmin?<button type="button" onClick={()=>setEntity({...e,reason:''})}>Editar</button>:'Solo lectura'}</td></tr>)}</tbody>
    </table></div>
   </fieldset>
   {isAdmin&&<form className="ef-section" onSubmit={e=>save(e,
    entity?'/labor-accounting/entities/'+entity.id:'/labor-accounting/entities',entity?'PUT':'POST',
    entity?{name:entity.name,active:entity.active,revision:entity.revision,reason:entity.reason}:newEntity,
    ()=>{setEntity(null);setNewEntity({kind:'AFP',code:'',name:'',reason:''});})}>
    <fieldset disabled={busy}><legend>{entity?'Editar institución':'Agregar AFP o Isapre'}</legend><div className="ef-grid">
     {!entity&&<label>Tipo<select value={newEntity.kind} onChange={e=>setNewEntity(x=>({...x,kind:e.target.value}))}>
      <option value="AFP">AFP</option><option value="ISAPRE">Isapre</option></select></label>}
     {!entity&&<label>Código interno<input required minLength={2} maxLength={40} value={newEntity.code}
      onChange={e=>setNewEntity(x=>({...x,code:e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g,'')}))}/></label>}
     <label>Nombre<input required maxLength={120} value={entity?entity.name:newEntity.name}
      onChange={e=>entity?setEntity(x=>({...x,name:e.target.value})):setNewEntity(x=>({...x,name:e.target.value}))}/></label>
     {entity&&<label>Estado<select disabled={entity.kind==='FONASA'} value={entity.active?'SI':'NO'}
      onChange={e=>setEntity(x=>({...x,active:e.target.value==='SI'}))}>
      <option value="SI">Activa</option><option value="NO">Inactiva</option></select></label>}
     <label className="ef-field-wide">Motivo obligatorio<textarea required minLength={10} rows={2} maxLength={500}
      value={entity?entity.reason:newEntity.reason}
      onChange={e=>entity?setEntity(x=>({...x,reason:e.target.value})):setNewEntity(x=>({...x,reason:e.target.value}))}/></label>
    </div><button type="submit" className="primary" disabled={busy}>Guardar institución</button>
    {entity&&<button type="button" onClick={()=>setEntity(null)}>Cancelar edición</button>}
    </fieldset>
   </form>}
  </>}
  {section==='banks'&&<LaborBenefits mode="banks"/>}
  {section==='family'&&<LaborBenefits mode="family"/>}
   {section==='bonuses'&&<LaborBonuses/>}
  {section==='history'&&<>
   <fieldset className="ef-section"><legend>Historial de valores</legend><div className="la-scroll">
    <table><thead><tr><th>Vigencia</th><th>Parámetro</th><th>Institución</th><th>Valor</th><th>Motivo</th></tr></thead>
    <tbody>{data.versions.map(v=><tr key={v.id}><td>{v.effectiveFrom}</td><td>{laborMetric(v.metric)?.label||v.metric}</td>
     <td>{v.entityName||'General'}</td><td>{format(v)}</td><td>{v.reason}</td></tr>)}</tbody></table>
   </div></fieldset>
   <fieldset className="ef-section"><legend>Historial de instituciones</legend><div className="la-scroll">
    <table><thead><tr><th>Fecha</th><th>Institución</th><th>Motivo</th><th>Cambio</th></tr></thead>
    <tbody>{data.entityHistory.map(v=><tr key={v.id}><td>{v.changedAt}</td><td>{data.entities.find(e=>e.id===v.entityId)?.name||v.entityId}</td>
     <td>{v.reason}</td><td>{v.before?'Actualización':'Creación'}</td></tr>)}</tbody></table>
   </div></fieldset>
  </>}
  <p className="ef-note">Las nuevas secciones Bancos y Asignación Familiar requieren autorización individual adicional para modificar sus valores. Root y liquidaciones continúan pendientes.</p>
 </section>;
}
