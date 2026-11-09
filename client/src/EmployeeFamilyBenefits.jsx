
import React,{forwardRef,useEffect,useImperativeHandle,useState} from 'react';
import {api} from './services/api.js';

const blank=()=>({fullName:'',relationship:'HIJO',recognitionStatus:'PENDING',institution:'',recognitionDate:'',validFrom:'',validUntil:'',referenceCode:''});
const empty=()=>({revision:0,status:'NONE',dependents:[]});
const EmployeeFamilyBenefits=forwardRef(function EmployeeFamilyBenefits({employeeId,role,onDirtyChange},ref){
 const [data,setData]=useState(empty),[saved,setSaved]=useState(JSON.stringify(empty()));
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const permitted=['admin','supervisor'].includes(role);
 const editable=role==='admin';
 const dirty=JSON.stringify(data)!==saved;
 useEffect(()=>{let valid=true;setData(empty());setSaved(JSON.stringify(empty()));setError('');
  if(!employeeId||!permitted)return()=>{valid=false;};
  api('/employee-benefits/'+employeeId+'/family').then(v=>{
   if(valid){setData(v);setSaved(JSON.stringify(v));}
  }).catch(e=>{if(valid)setError(e.message);});return()=>{valid=false;};
 },[employeeId,permitted]);
 useEffect(()=>{onDirtyChange?.(dirty);},[dirty,onDirtyChange]);
 const update=(i,k,value)=>setData(prev=>({...prev,dependents:prev.dependents.map((row,index)=>i===index?{...row,[k]:value}:row)}));
 const save=async()=>{
  if(!employeeId||!editable||busy)return;
  setBusy(true);setError('');
  try{
   await api('/employee-benefits/'+employeeId+'/family',{method:'PUT',body:JSON.stringify(data)});
   const result=await api('/employee-benefits/'+employeeId+'/family');
   setData(result);setSaved(JSON.stringify(result));
  }catch(e){setError(e.message);throw e;}finally{setBusy(false);}
 };
 useImperativeHandle(ref,()=>({isDirty:()=>dirty,saveChanges:save}),[dirty,data,employeeId,role,busy]);
 if(!employeeId)return <p className="ef-note">Guarda primero la ficha para registrar cargas familiares individualmente.</p>;
 if(!permitted)return <p className="ef-note">No tienes permiso para consultar antecedentes familiares.</p>;
 return <fieldset className="ef-section"><legend>Cargas familiares y acreditación</legend>
  <p>Registrar cada causante por separado. La declaración no equivale a reconocimiento ni activa pagos.</p>
  {error&&<p role="alert" className="ef-note">{error}</p>}
  <div className="ef-grid">
   <label>¿Tiene cargas familiares?
    <select disabled={!editable} value={data.status} onChange={e=>setData(prev=>({...prev,status:e.target.value}))}>
     <option value="NONE">No</option><option value="PENDING">Sí, pendientes de reconocimiento</option>
     <option value="RECOGNIZED">Sí, reconocidas oficialmente</option>
    </select>
   </label>
  </div>
  {data.status!=='NONE'&&<>
   {data.dependents.map((row,i)=><fieldset className="ef-section" key={row.id||'new-'+i}>
    <legend>Carga {i+1}{row.recognitionStatus==='ENDED'?' · histórica':''}</legend>
    <div className="ef-grid">
     <label>Nombre del causante<input disabled={!editable} value={row.fullName||''} maxLength={160} onChange={e=>update(i,'fullName',e.target.value)}/></label>
     <label>Vínculo<select disabled={!editable} value={row.relationship} onChange={e=>update(i,'relationship',e.target.value)}>
      {['HIJO','HIJA','CONYUGE','CONVIVIENTE','ASCENDIENTE','OTRO'].map(s=><option key={s} value={s}>{s}</option>)}
     </select></label>
     <label>Estado del reconocimiento<select disabled={!editable} value={row.recognitionStatus} onChange={e=>update(i,'recognitionStatus',e.target.value)}>
      <option value="PENDING">Pendiente</option><option value="RECOGNIZED">Reconocida</option><option value="ENDED">Finalizada (conservar histórico)</option>
     </select></label>
     <label>Institución acreditadora<input disabled={!editable} value={row.institution||''} onChange={e=>update(i,'institution',e.target.value)}/></label>
     <label>Fecha reconocimiento<input type="date" disabled={!editable} value={row.recognitionDate||''} onChange={e=>update(i,'recognitionDate',e.target.value)}/></label>
     <label>Inicio vigencia<input type="date" disabled={!editable} value={row.validFrom||''} onChange={e=>update(i,'validFrom',e.target.value)}/></label>
     <label>Término vigencia<input type="date" disabled={!editable} value={row.validUntil||''} onChange={e=>update(i,'validUntil',e.target.value)}/></label>
     <label>Referencia de resolución<input disabled={!editable} value={row.referenceCode||''} maxLength={120} onChange={e=>update(i,'referenceCode',e.target.value)}/></label>
    </div>
    {!row.id&&editable&&<button type="button" onClick={()=>setData(prev=>({...prev,dependents:prev.dependents.filter((_,j)=>j!==i)}))}>Descartar carga sin guardar</button>}
   </fieldset>)}
   {editable&&<button type="button" onClick={()=>setData(prev=>({...prev,dependents:[...prev.dependents,blank()]}))}>Agregar otra carga</button>}
  </>}
  {data.status==='NONE'&&data.dependents.length>0&&<p className="ef-note">Hay cargas históricas. Para indicar «No», finaliza cada reconocimiento conservando sus antecedentes.</p>}
  <p className="ef-note">Los montos por tramo se administran únicamente desde Gestión → Contabilidad Laboral. El sistema no genera asignaciones ni pagos.</p>
  {dirty&&<p className="ef-note">Cambios pendientes: usa «Guardar ficha» para conservar también esta sección.</p>}
 </fieldset>;
});
export default EmployeeFamilyBenefits;
