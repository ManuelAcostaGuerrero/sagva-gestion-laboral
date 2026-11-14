import {sortEquipmentItems} from './equipmentSorting.js';
import React,{useEffect,useState} from 'react';
import {api} from './services/api.js';
import './documentCatalog.css';
const fresh=()=>({items:[],name:'',expiryMode:'NONE',periodValue:3,periodUnit:'MONTHS',applicability:'ALL',employeeIds:[]});
const modes=[['NONE','Sin vencimiento'],['PERIOD','Vencimiento automático'],['MANUAL','Fecha manual'],['EVENT','Por cambio de versión']];
const units=[['DAYS','Días'],['WEEKS','Semanas'],['MONTHS','Meses'],['YEARS','Años']];
const description=t=>(modes.find(v=>v[0]===t.expiryMode)?.[1]||t.expiryMode)+
  (t.expiryMode==='PERIOD'?' · '+t.periodValue+' '+(units.find(u=>u[0]===t.periodUnit)?.[1]||'').toLowerCase():'');
export default function DocumentCatalog({employees=[],onMessage,onOpenWorker}){
  const [types,setTypes]=useState([]),[draft,setDraft]=useState(fresh);
  const [editing,setEditing]=useState(null),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[linked,setLinked]=useState(null);
  const [newEquipmentItem,setNewEquipmentItem]=useState('');
  async function load(){const result=await api('/document-catalog');setTypes(result.types);}
  useEffect(()=>{load().catch(e=>setError(e.message));},[]);
  const change=(name,value)=>setDraft(d=>({...d,[name]:value}));
  function reset(){setDraft(fresh());setEditing(null);setError('');}
  function begin(type){
    setDraft({items:[...(type.items||[])],name:type.name,expiryMode:type.expiryMode,periodValue:type.periodValue||3,
      periodUnit:type.periodUnit||'MONTHS',applicability:type.applicability||'ALL',
      employeeIds:[...(type.employeeIds||[])]});
    setEditing(type.id);setError('');setLinked(null);
  }
  const notify=()=>window.dispatchEvent(new Event('attendance:document-catalog-changed'));
  async function save(e){
    e.preventDefault();setBusy(true);setError('');
    try{
      const response=await api(editing?'/document-catalog/'+editing:'/document-catalog',
        {method:editing?'PUT':'POST',body:JSON.stringify(draft)});
      await load();reset();notify();onMessage?.(response.message);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function toggle(type){
    const reason=type.isActive?window.prompt('Motivo para desactivar '+type.name):null;
    if(type.isActive&&(!reason||reason.trim().length<5))return;
    setBusy(true);setError('');
    try{
      const response=await api('/document-catalog/'+type.id+'/'+(type.isActive?'deactivate':'reactivate'),
        {method:'POST',body:JSON.stringify(type.isActive?{reason:reason.trim()}:{})});
      await load();notify();onMessage?.(response.message);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function viewLinked(type){
    try{const result=await api('/document-catalog/'+type.id+'/workers');setLinked({type,workers:result.workers});}
    catch(e){setError(e.message);}
  }
  async function remove(type){
    if(!window.confirm('¿Eliminar definitivamente '+type.name+'? Se bloqueará si hay trabajadores vinculados o historial.'))return;
    setBusy(true);setError('');setLinked(null);
    try{
      const response=await api('/document-catalog/'+type.id+'/permanent',{method:'DELETE'});
      if(editing===type.id)reset();
      await load();notify();onMessage?.(response.message);
    }catch(e){setError(e.message);if(e.status===409)await viewLinked(type);}
    finally{setBusy(false);}
  }
  const ordered=[...employees].sort((a,b)=>a.fullName.localeCompare(b.fullName,'es'));
  return <div className="dc-module module-content">
    <form className="form-panel module-top-panel dc-form" onSubmit={save} autoComplete="off">
      <h2>{editing?'Editar documento laboral':'Crear documento laboral'}</h2>
      <p>Catálogo general. Cada documento activo aparece en las fichas a las que corresponda.</p>
      {error&&<p className="soft-alert" role="alert">{error}</p>}
      <div className="dc-grid">
        <label>Nombre<input required minLength={2} maxLength={120} disabled={!!editing&&draft.name==='ENTREGA DE IMPLEMENTOS DE TRABAJO'} value={draft.name}
          onChange={e=>change('name',e.target.value.toLocaleUpperCase('es-CL'))}/></label>
        <label>Vencimiento<select value={draft.expiryMode} onChange={e=>change('expiryMode',e.target.value)}>
          {modes.map(([id,label])=><option key={id} value={id}>{label}</option>)}
        </select></label>
        {draft.expiryMode==='PERIOD'&&<>
          <label>Duración<input type="number" min={1} max={1200} required value={draft.periodValue}
            onChange={e=>change('periodValue',Number(e.target.value))}/></label>
          <label>Unidad<select value={draft.periodUnit} onChange={e=>change('periodUnit',e.target.value)}>
            {units.map(([id,label])=><option key={id} value={id}>{label}</option>)}
          </select></label>
        </>}
        <label>Aplicable a<select value={draft.applicability} onChange={e=>change('applicability',e.target.value)}>
          <option value="ALL">Todos los trabajadores</option>
          <option value="SELECTED">Solo trabajadores seleccionados</option>
        </select></label>
      </div>
      {draft.name==='ENTREGA DE IMPLEMENTOS DE TRABAJO'&&<fieldset className="dc-select-people">
        <legend>Ítems de implementos para entregar</legend>
        <p>Marca y registra cada entrega desde la ficha del trabajador. Aquí solo se configura el catálogo.</p>
        <p className="dc-equipment-count">{draft.items.length} implemento(s) configurado(s) · orden alfabético.</p>
        <div className="dc-equipment-list">
          {sortEquipmentItems(draft.items).map(item=><div className="dc-equipment-row" key={item}>
            <span>{item}</span>
            <button type="button" aria-label={'Quitar '+item} onClick={()=>change('items',draft.items.filter(name=>name!==item))}>Quitar</button>
          </div>)}
        </div>
        <div className="dc-equipment-new">
          <input aria-label="Nuevo implemento" autoComplete="off" value={newEquipmentItem} maxLength={100} onChange={e=>setNewEquipmentItem(e.target.value.toLocaleUpperCase('es-CL'))} placeholder="Ej.: UNIFORME"/>
          <button type="button" disabled={!newEquipmentItem.trim()||draft.items.some(item=>item.toLocaleUpperCase('es-CL')===newEquipmentItem.trim().toLocaleUpperCase('es-CL'))} onClick={()=>{change('items',[...draft.items,newEquipmentItem.trim()]);setNewEquipmentItem('');}}>Agregar implemento</button>
        </div>
      </fieldset>}
      {draft.applicability==='SELECTED'&&<div className="dc-select-people">
        <strong>Trabajadores a los que corresponde</strong>
        <p>La selección no registra la entrega ni la firma del documento.</p>
        <div className="dc-people">
          {ordered.map(w=><label key={w.id} className="dc-person">
            <input type="checkbox" checked={draft.employeeIds.includes(w.id)}
              onChange={e=>change('employeeIds',e.target.checked?[...draft.employeeIds,w.id]:draft.employeeIds.filter(id=>id!==w.id))}/>
            {w.fullName} {!w.isActive&&'(inactivo)'}
          </label>)}
        </div>
        {!ordered.length&&<p>No hay trabajadores disponibles.</p>}
      </div>}
      <div className="row-actions">
        <button className="primary" type="submit" disabled={busy||!draft.name.trim()}>{busy?'Guardando…':editing?'Guardar cambios':'Crear documento'}</button>
        {editing&&<button type="button" onClick={reset} disabled={busy}>Cancelar edición</button>}
      </div>
      {editing&&<p>Los cambios solo se aplican a entregas futuras; el historial y los PDF anteriores se conservan.</p>}
    </form>
    <section className="table-panel dc-list">
      <div className="panel-heading"><h2>Documentos registrados</h2><button onClick={()=>load().catch(e=>setError(e.message))}>Actualizar</button></div>
      <div className="dc-cards">
        {types.map(type=><article className={'dc-card'+(type.isActive?'':' dc-inactive')} key={type.id}>
          <div className="dc-card-heading"><strong>{type.name}</strong><span className={'status-pill '+(type.isActive?'active':'inactive')}>{type.isActive?'Activo':'Desactivado'}</span></div>
          <p>{description(type)}{type.isEquipment?' · Lista de implementos':''}</p>
          <p>{type.applicability==='ALL'?'Para todos':'Asignado a '+type.selectedCount+' trabajador(es)'} · {type.historyCount} entrega(s) históricas</p>
          {type.deactivationReason&&<p>Motivo: {type.deactivationReason}</p>}
          <div className="row-actions dc-actions">
            <button onClick={()=>begin(type)} disabled={busy}>Editar</button>
            <button onClick={()=>viewLinked(type)} disabled={busy}>Ver vinculados</button>
            <button onClick={()=>toggle(type)} disabled={busy}>{type.isActive?'Desactivar':'Reactivar'}</button>
            <button className="danger" onClick={()=>remove(type)} disabled={busy}>Eliminar</button>
          </div>
        </article>)}
        {!types.length&&<p>Sin documentos configurados.</p>}
      </div>
    </section>
    {linked&&<section className="form-panel dc-linked" aria-label="Trabajadores vinculados">
      <div className="panel-heading"><h2>Vínculos: {linked.type.name}</h2><button onClick={()=>setLinked(null)}>Cerrar</button></div>
      {linked.type.applicability==='ALL'&&<p>Este tipo está disponible para todos los trabajadores.</p>}
      {!linked.workers.length&&<p>No hay entregas históricas ni asignaciones individuales.</p>}
      <div className="dc-linked-people">{linked.workers.map(w=><button type="button" key={w.id} onClick={()=>onOpenWorker?.(w)}>
        {w.fullName} · {w.documentId||'Sin RUT'} · {w.historyCount} entrega(s) {w.selected?'· Asignado':''} · {w.isActive?'Activo':'Inactivo'} — Abrir ficha
      </button>)}</div>
      <p>Si existe historial, puedes desactivar el documento pero no eliminarlo definitivamente.</p>
    </section>}
  </div>;
}
