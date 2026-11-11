import React,{useEffect,useState} from 'react';
import {api} from '../../services/api.js';

// Gestión guiada sobre servicios versionados: no consulta ni modifica SQLite desde React.
const emptyBranch={companyId:'',code:'',name:'',address:''};
const emptyHire={companyId:'',startedOn:'',evidenceRef:''};
const emptyAssignment={validFrom:'',branchId:'',areaId:'',positionId:'',evidenceRef:''};
const emptyConditions={effectiveFrom:'',monthlyBaseSalaryClp:'',weeklyHours:'',breakMinutes:'0',
 contractType:'INDEFINIDO',description:'',evidenceRef:''};
const emptyPrevision={validFrom:'',afpEntityId:'',healthEntityId:'',planAmountHundredths:'',
 planUnit:'',evidenceRef:''};
const emptyFinish={endedOn:'',reason:'',evidenceRef:''};
const emptyLink={fileId:'',kind:'CONTRACT',evidenceRef:''};
const n=x=>x===''||x===null?null:Number(x);
const choice=(id,text)=><option key={id} value={id}>{text}</option>;
const displayDate=x=>x||'Vigente';

export default function LaborStructure({onGoEmployeeFile,onGoCompanies}){
 const [catalog,setCatalog]=useState(null),[workerId,setWorkerId]=useState(''),[worker,setWorker]=useState(null),
 [relationId,setRelationId]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState(''),
 [message,setMessage]=useState(''),[branch,setBranch]=useState(emptyBranch),
 [editedBranch,setEditedBranch]=useState(null),[hire,setHire]=useState(emptyHire),
 [assignment,setAssignment]=useState(emptyAssignment),[conditions,setConditions]=useState(emptyConditions),
 [prevision,setPrevision]=useState(emptyPrevision),[finish,setFinish]=useState(emptyFinish),
 [link,setLink]=useState(emptyLink),[asOf,setAsOf]=useState(''),[asOfResult,setAsOfResult]=useState(null);
 const employment=worker?.relations.find(x=>String(x.id)===String(relationId));
 async function reloadCatalog(){setCatalog(await api('/labor-structure/catalog'));}
 async function reloadWorker(id=workerId){
  if(!id){setWorker(null);setRelationId('');return;}
  const next=await api('/labor-structure/workers/'+id);
  setWorker(next);
  setRelationId(old=>next.relations.some(x=>String(x.id)===String(old))?old:(next.relations[0]?.id?String(next.relations[0].id):''));
 }
 useEffect(()=>{let live=true;api('/labor-structure/catalog').then(x=>{if(live)setCatalog(x);})
  .catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[]);
 useEffect(()=>{let live=true;setWorker(null);setRelationId('');setAsOfResult(null);
  if(workerId)api('/labor-structure/workers/'+workerId).then(x=>{if(live){setWorker(x);setRelationId(x.relations[0]?.id?String(x.relations[0].id):'');}})
   .catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[workerId]);
 async function execute(url,body,{method='POST',refreshCatalog=false,clear}={}){
  setLoading(true);setError('');setMessage('');
  try{
   const result=await api('/labor-structure'+url,{method,body:JSON.stringify(body)});
   if(refreshCatalog)await reloadCatalog();
   if(workerId)await reloadWorker();
   if(clear)clear();
   setMessage('Operación guardada y auditada. Los antecedentes anteriores se conservan.');
   return result;
  }catch(e){setError(e.message);return null;}finally{setLoading(false);}
 }
 async function queryAsOf(e){
  e.preventDefault();setError('');setAsOfResult(null);
  try{setAsOfResult(await api('/labor-structure/workers/'+workerId+'/as-of?on='+encodeURIComponent(asOf)));}
  catch(err){setError(err.message);}
 }
 const companies=catalog?.companies||[],branches=catalog?.branches||[];
 const companyForHire=companies.find(x=>String(x.id)===String(hire.companyId));
 return <section className="module-content" aria-label="Ciclo laboral versionado">
  <div className="form-panel">
   <h2>Modelo laboral por vigencias</h2>
   <p>Trabajador único → relaciones por empresa → traslados, condiciones, previsión y documentos. Sólo perfil Root en esta primera entrega.</p>
   <p><strong>No hay conciliación automática:</strong> los datos históricos anteriores no se convierten en relaciones laborales sin evidencia y revisión humana.</p>
   <div className="row-actions">
    <button type="button" onClick={onGoEmployeeFile}>Crear o editar persona en Ficha del trabajador</button>
    <button type="button" onClick={onGoCompanies}>Crear o editar empresa</button>
    <button type="button" onClick={()=>reloadCatalog().catch(e=>setError(e.message))}>Actualizar catálogos</button>
   </div>
   {error&&<p role="alert" className="ef-note">{error}</p>}
   {message&&<p role="status" className="ef-note">{message}</p>}
   {!catalog&&<p>Consultando la estructura laboral…</p>}
  </div>

  {catalog&&<>
  <details open className="form-panel">
   <summary><strong>1A. Locales y sucursales por empresa</strong></summary>
   <form onSubmit={async e=>{e.preventDefault();await execute('/branches',{
    ...branch,companyId:Number(branch.companyId)},
    {refreshCatalog:true,clear:()=>setBranch(emptyBranch)});}}>
    <div className="ef-grid">
     <label>Empresa
      <select value={branch.companyId} required onChange={e=>setBranch({...branch,companyId:e.target.value})}>
       <option value="">Selecciona empresa</option>
       {companies.filter(c=>c.isActive).map(c=>choice(c.id,c.legalName))}
      </select></label>
     <label>Código de local<input required minLength={2} maxLength={40} value={branch.code}
      onChange={e=>setBranch({...branch,code:e.target.value})}/></label>
     <label>Nombre del local<input required maxLength={150} value={branch.name}
      onChange={e=>setBranch({...branch,name:e.target.value})}/></label>
     <label>Dirección<input maxLength={300} value={branch.address}
      onChange={e=>setBranch({...branch,address:e.target.value})}/></label>
    </div>
    <button type="submit" disabled={loading||!branch.companyId}>Registrar local</button>
   </form>
   <label>Modificar local existente
    <select value={editedBranch?.id||''} onChange={e=>setEditedBranch(branches.find(b=>String(b.id)===e.target.value)||null)}>
     <option value="">Seleccionar local</option>
     {branches.map(b=>choice(b.id,(companies.find(c=>c.id===b.companyId)?.legalName||'Empresa')+' · '+b.code+' · '+b.name+(b.active?'':' (inactivo)')))}
    </select></label>
   {editedBranch&&<form onSubmit={e=>{e.preventDefault();execute('/branches/'+editedBranch.id,{
    name:editedBranch.name,address:editedBranch.address||'',active:Boolean(editedBranch.active),
    revision:editedBranch.revision},{method:'PUT',refreshCatalog:true,clear:()=>setEditedBranch(null)});}}>
    <div className="ef-grid">
     <label>Nombre<input value={editedBranch.name} onChange={e=>setEditedBranch({...editedBranch,name:e.target.value})} required/></label>
     <label>Dirección<input value={editedBranch.address||''} onChange={e=>setEditedBranch({...editedBranch,address:e.target.value})}/></label>
     <label>Estado<select value={String(editedBranch.active?1:0)}
      onChange={e=>setEditedBranch({...editedBranch,active:Number(e.target.value)})}>
      <option value="1">Activo</option><option value="0">Desactivado</option></select></label>
    </div>
    <button disabled={loading}>Guardar cambios del local</button>
   </form>}
  </details>

  <div className="form-panel">
   <h3>Seleccionar trabajador</h3>
   <label>Persona con identidad única
    <select value={workerId} onChange={e=>setWorkerId(e.target.value)}>
     <option value="">Seleccionar trabajador</option>
     {catalog.workers.map(w=>choice(w.id,w.fullName+' · '+w.documentId+(w.isActive?'':' (inactivo)')))}
    </select></label>
   {!workerId&&<p>Registra primero la persona desde la ficha y luego crea su relación laboral.</p>}
  </div>
  {worker&&<>
  <details className="form-panel" open>
   <summary><strong>1B. Contratación y recontratación</strong></summary>
   <form onSubmit={async e=>{e.preventDefault();const result=await execute('/employments',{
    employeeId:Number(workerId),companyId:Number(hire.companyId),
    startedOn:hire.startedOn,evidenceRef:hire.evidenceRef},
    {clear:()=>setHire(emptyHire)});if(result?.result?.id)setRelationId(String(result.result.id));}}>
    <div className="ef-grid">
     <label>Empresa
      <select value={hire.companyId} required onChange={e=>setHire({...hire,companyId:e.target.value})}>
       <option value="">Seleccionar empresa</option>
       {companies.filter(c=>c.isActive).map(c=>choice(c.id,c.legalName))}
      </select></label>
     <label>Fecha de ingreso<input type="date" required value={hire.startedOn}
      onChange={e=>setHire({...hire,startedOn:e.target.value})}/></label>
     <label className="ef-field-wide">Documento o evidencia de contratación<input required minLength={8} maxLength={500}
      value={hire.evidenceRef} onChange={e=>setHire({...hire,evidenceRef:e.target.value})}
      placeholder="Referencia al contrato o documento verificable"/></label>
    </div>
    {companyForHire&&<p>Empresa seleccionada: {companyForHire.legalName}. La fecha y la fuente deben ser verificadas.</p>}
    <button disabled={loading}>Registrar relación confirmada</button>
   </form>
   <h3>Relaciones laborales</h3>
   <label>Relación seleccionada
    <select value={relationId} onChange={e=>setRelationId(e.target.value)}>
     <option value="">Selecciona relación</option>
     {worker.relations.map(r=>choice(r.id,r.companyName+' · '+r.startedOn+' a '+displayDate(r.endedOn)+' · '+r.status))}
    </select></label>
   {employment&&<p><strong>Estado:</strong> {employment.status} · {employment.companyName} · ingreso {employment.startedOn} · término {displayDate(employment.endedOn)}</p>}
   {employment?.status==='ACTIVE'&&<form onSubmit={e=>{e.preventDefault();execute('/employments/'+relationId+'/finish',finish,
     {clear:()=>setFinish(emptyFinish)});}}>
    <h4>Registrar término laboral</h4>
    <div className="ef-grid">
     <label>Fecha de término<input required type="date" value={finish.endedOn}
      onChange={e=>setFinish({...finish,endedOn:e.target.value})}/></label>
     <label>Motivo respaldado<input minLength={8} maxLength={500} required value={finish.reason}
      onChange={e=>setFinish({...finish,reason:e.target.value})}/></label>
     <label className="ef-field-wide">Documento de término<input required minLength={8} value={finish.evidenceRef}
      onChange={e=>setFinish({...finish,evidenceRef:e.target.value})}/></label>
    </div>
    <button disabled={loading}>Finalizar esta relación, conservando historial</button>
   </form>}
   <p>El término de una relación no elimina la persona ni desactiva automáticamente su cuenta de asistencia.</p>
  </details>

  {employment?.status==='ACTIVE'&&<>
  <details className="form-panel">
   <summary><strong>1C. Movimientos de local, área y cargo</strong></summary>
   <form onSubmit={e=>{e.preventDefault();execute('/employments/'+relationId+'/assignments',{
    validFrom:assignment.validFrom,branchId:n(assignment.branchId),
    areaId:n(assignment.areaId),positionId:n(assignment.positionId),evidenceRef:assignment.evidenceRef},
    {clear:()=>setAssignment(emptyAssignment)});}}>
    <div className="ef-grid">
     <label>Desde<input required type="date" value={assignment.validFrom}
      onChange={e=>setAssignment({...assignment,validFrom:e.target.value})}/></label>
     <label>Local de la empresa<select value={assignment.branchId}
      onChange={e=>setAssignment({...assignment,branchId:e.target.value})}>
      <option value="">Sin local específico</option>
      {branches.filter(b=>b.active&&b.companyId===employment.companyId).map(b=>choice(b.id,b.name))}
     </select></label>
     <label>Área<select value={assignment.areaId} onChange={e=>setAssignment({...assignment,areaId:e.target.value})}>
      <option value="">Sin asignar</option>{catalog.areas.filter(a=>a.isActive).map(a=>choice(a.id,a.name))}
     </select></label>
     <label>Cargo<select value={assignment.positionId} onChange={e=>setAssignment({...assignment,positionId:e.target.value})}>
      <option value="">Sin asignar</option>{catalog.positions.filter(p=>p.isActive).map(p=>choice(p.id,p.name))}
     </select></label>
     <label className="ef-field-wide">Referencia del traslado o asignación<input minLength={8} required value={assignment.evidenceRef}
      onChange={e=>setAssignment({...assignment,evidenceRef:e.target.value})}/></label>
    </div>
    <button disabled={loading}>Guardar nueva vigencia del cargo/local</button>
   </form>
  </details>

  <details className="form-panel">
   <summary><strong>1C–1D. Condiciones, sueldo y jornada pactada</strong></summary>
   <p>Registrar sólo condiciones documentadas. Esto no genera ni firma un contrato y no autoriza horas extraordinarias.</p>
   <form onSubmit={e=>{e.preventDefault();execute('/employments/'+relationId+'/conditions',{
    ...conditions,monthlyBaseSalaryClp:Number(conditions.monthlyBaseSalaryClp),
    weeklyHours:Number(conditions.weeklyHours),breakMinutes:Number(conditions.breakMinutes)},
    {clear:()=>setConditions(emptyConditions)});}}>
    <div className="ef-grid">
     <label>Desde<input type="date" required value={conditions.effectiveFrom}
      onChange={e=>setConditions({...conditions,effectiveFrom:e.target.value})}/></label>
     <label>Tipo de contrato<select value={conditions.contractType}
      onChange={e=>setConditions({...conditions,contractType:e.target.value})}>
      <option value="INDEFINIDO">Indefinido</option><option value="PLAZO_FIJO">Plazo fijo</option>
      <option value="OTRO">Otro / revisión</option></select></label>
     <label>Sueldo base (CLP)<input type="number" min="0" step="1" required value={conditions.monthlyBaseSalaryClp}
      onChange={e=>setConditions({...conditions,monthlyBaseSalaryClp:e.target.value})}/></label>
     <label>Horas semanales pactadas<input type="number" min="0" max="48" step=".5" required value={conditions.weeklyHours}
      onChange={e=>setConditions({...conditions,weeklyHours:e.target.value})}/></label>
     <label>Colación (minutos)<input type="number" min="0" max="240" step="1" required value={conditions.breakMinutes}
      onChange={e=>setConditions({...conditions,breakMinutes:e.target.value})}/></label>
     <label>Observación contractual<input maxLength={500} value={conditions.description}
      onChange={e=>setConditions({...conditions,description:e.target.value})}/></label>
     <label className="ef-field-wide">Documento/anexo que respalda las condiciones<input required minLength={8} value={conditions.evidenceRef}
      onChange={e=>setConditions({...conditions,evidenceRef:e.target.value})}/></label>
    </div>
    <button disabled={loading}>Registrar nueva versión contractual</button>
   </form>
  </details>
  </>}

  <details className="form-panel">
   <summary><strong>1D. Previsión por vigencia</strong></summary>
   <form onSubmit={e=>{e.preventDefault();execute('/workers/'+workerId+'/prevision',{
    ...prevision,afpEntityId:n(prevision.afpEntityId),healthEntityId:n(prevision.healthEntityId),
    planAmountHundredths:n(prevision.planAmountHundredths),
    planUnit:prevision.planAmountHundredths===''?null:prevision.planUnit},
    {clear:()=>setPrevision(emptyPrevision)});}}>
    <div className="ef-grid">
     <label>Desde<input required type="date" value={prevision.validFrom}
      onChange={e=>setPrevision({...prevision,validFrom:e.target.value})}/></label>
     <label>AFP<select value={prevision.afpEntityId} onChange={e=>setPrevision({...prevision,afpEntityId:e.target.value})}>
      <option value="">Sin informar</option>
      {catalog.entities.filter(e=>e.kind==='AFP').map(e=>choice(e.id,e.name))}
     </select></label>
     <label>Salud<select value={prevision.healthEntityId} onChange={e=>setPrevision({...prevision,healthEntityId:e.target.value,planAmountHundredths:'',planUnit:''})}>
      <option value="">Sin informar</option>
      {catalog.entities.filter(e=>['ISAPRE','FONASA'].includes(e.kind)).map(e=>choice(e.id,e.name))}
     </select></label>
     <label>Valor del plan en centésimas (si aplica)<input type="number" min="0" step="1" value={prevision.planAmountHundredths}
      onChange={e=>setPrevision({...prevision,planAmountHundredths:e.target.value})}/></label>
     <label>Unidad<select value={prevision.planUnit}
      onChange={e=>setPrevision({...prevision,planUnit:e.target.value})}>
      <option value="">Sin monto</option><option value="UF">UF</option><option value="CLP">CLP</option></select></label>
     <label className="ef-field-wide">Documento previsional o certificado<input required minLength={8} value={prevision.evidenceRef}
      onChange={e=>setPrevision({...prevision,evidenceRef:e.target.value})}/></label>
    </div>
    <button disabled={loading}>Guardar nueva versión previsional</button>
   </form>
  </details>

  {employment&&<details className="form-panel">
   <summary><strong>1C. Asociar PDFs contractuales ya existentes</strong></summary>
   <p>Los PDFs se adjuntan primero en la Ficha del trabajador. Esta acción solamente vincula el archivo existente a la relación correcta.</p>
   <form onSubmit={e=>{e.preventDefault();execute('/employments/'+relationId+'/documents',{
    fileId:Number(link.fileId),kind:link.kind,evidenceRef:link.evidenceRef},
    {clear:()=>setLink(emptyLink)});}}>
    <div className="ef-grid">
     <label>PDF existente<select required value={link.fileId}
      onChange={e=>setLink({...link,fileId:e.target.value})}>
      <option value="">Seleccionar documento</option>
      {worker.availableDocuments.map(d=>choice(d.id,d.filename+' · #'+d.id))}
     </select></label>
     <label>Tipo<select value={link.kind} onChange={e=>setLink({...link,kind:e.target.value})}>
      <option value="CONTRACT">Contrato</option><option value="ANNEX">Anexo</option>
      <option value="OTHER">Otro respaldo</option></select></label>
     <label className="ef-field-wide">Evidencia de asociación<input required minLength={8} value={link.evidenceRef}
      onChange={e=>setLink({...link,evidenceRef:e.target.value})}/></label>
    </div>
    <button disabled={loading||!link.fileId}>Vincular PDF sin reemplazarlo</button>
   </form>
  </details>}

  <details open className="form-panel">
   <summary><strong>1E. Historial y consulta a una fecha</strong></summary>
   <form onSubmit={queryAsOf}>
    <label>Fecha de consulta<input required type="date" value={asOf}
     onChange={e=>setAsOf(e.target.value)}/></label>
    <button disabled={!asOf||loading}>Consultar datos vigentes</button>
   </form>
   {asOfResult&&<div role="status">
    <h4>Situación al {asOfResult.asOf}</h4>
    {asOfResult.relationships.length?asOfResult.relationships.map(r=><p key={r.employmentId}>
     Empresa #{r.companyId} · Relación #{r.employmentId} · local #{r.branchId||'sin asignar'} ·
     cargo #{r.positionId||'sin asignar'} · sueldo base {r.monthlyBaseSalaryClp??'sin informar'} CLP ·
     jornada {r.weeklyHours??'sin informar'} horas
    </p>):<p>Sin relación laboral confirmada para la fecha.</p>}
    <p>Previsión: {asOfResult.prevision?'versión #'+asOfResult.prevision.versionId:'sin versión documentada para la fecha'}</p>
   </div>}
   {[
    ['Relaciones',worker.relations,x=>x.companyName+' · '+x.startedOn+' → '+displayDate(x.endedOn)+' · '+x.status],
    ['Local / cargo',worker.assignments,x=>x.validFrom+' → '+displayDate(x.validUntil)+' · '+(x.branchName||'Sin local')+' · '+(x.positionName||'Sin cargo')],
    ['Condiciones',worker.terms,x=>x.effectiveFrom+' → '+displayDate(x.effectiveUntil)+' · '+x.monthlyBaseSalaryClp+' CLP · '+x.weeklyHours+' h/sem'],
    ['Previsión',worker.prevision,x=>x.validFrom+' → '+displayDate(x.validUntil)+' · '+(x.afpName||'Sin AFP')+' / '+(x.healthName||'Sin salud')],
    ['PDF vinculados',worker.documents,x=>x.filename+' · '+x.kind+' · SHA256 '+x.sha256.slice(0,12)+'…'],
    ['Eventos inmutables',worker.events,x=>x.effectiveOn+' · '+x.kind+' · '+x.evidenceRef]
   ].map(([heading,items,summary])=><div key={heading}><h4>{heading} ({items.length})</h4>
    {items.length?<ul>{items.map(x=><li key={x.id}>{summary(x)}</li>)}</ul>:<p>Sin antecedentes versionados todavía.</p>}
   </div>)}
  </details>
  </>}
  </>}
 </section>;
}
