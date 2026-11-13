
import React,{forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {normalizeRut,formatRut} from '../../server/src/rut.js';
import {api} from './services/api.js';
const initial=()=>({revision:0,bankId:0,accountType:'VISTA',accountNumber:'',holderName:'',holderRut:'',requestedOn:'',authorizationRef:''});
const EmployeeBankDetails=forwardRef(function EmployeeBankDetails({employeeId,workerName,workerRut,onDirtyChange},ref){
 const [cap,setCap]=useState(false),[canWrite,setCanWrite]=useState(false),[reason,setReason]=useState(''),[banks,setBanks]=useState([]);
 const [data,setData]=useState(initial),[saved,setSaved]=useState(JSON.stringify(initial()));
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[showNumber,setShowNumber]=useState(false);
 const [thirdParty,setThirdParty]=useState(false),[uploading,setUploading]=useState(false);
 const [holderRutFocused,setHolderRutFocused]=useState(false);
 const uploadInput=useRef(null);
 const dirty=JSON.stringify(data)!==saved;
 useEffect(()=>{onDirtyChange?.(cap&&canWrite&&dirty);},[cap,canWrite,dirty,onDirtyChange]);
 useEffect(()=>{let active=true;setCap(false);setCanWrite(false);setData(initial());setSaved(JSON.stringify(initial()));setError('');
  setThirdParty(false);
  api('/employee-benefits/bank-capability').then(async capability=>{
   if(!active)return;
   setCap(!!capability.canAccess);setCanWrite(!!capability.canWrite);setReason(capability.reason||'');
   if(!capability.canAccess||!employeeId)return;
   const [catalog,bank]=await Promise.all([
    api('/labor-benefits/banks'),api('/employee-benefits/'+employeeId+'/bank')
   ]);
   if(!active)return;
   setBanks(catalog.banks||[]);
   const value={...initial(),...bank.account,revision:bank.revision};
   setData(value);setSaved(JSON.stringify(value));
   setThirdParty(!!value.holderRut&&!!workerRut&&normalizeRut(value.holderRut)!==normalizeRut(workerRut));
  }).catch(e=>{if(active)setError(e.message);});
  return()=>{active=false;};
 },[employeeId]);
 async function save(){
  if(!employeeId||!cap||!canWrite||busy)return;
  setBusy(true);setError('');
  try{
   const payload={...data,bankId:Number(data.bankId),holderName:data.holderName||workerName,holderRut:data.holderRut||workerRut};
   await api('/employee-benefits/'+employeeId+'/bank',{method:'PUT',body:JSON.stringify(payload)});
   const response=await api('/employee-benefits/'+employeeId+'/bank');
   const value={...initial(),...response.account,revision:response.revision};
   setData(value);setSaved(JSON.stringify(value));
  }catch(e){setError(e.message);throw e;}finally{setBusy(false);}
 }
 useImperativeHandle(ref,()=>({isDirty:()=>cap&&canWrite&&dirty,saveChanges:save}),[cap,dirty,data,employeeId,busy,workerName,workerRut]);
 if(!employeeId)return <p className="ef-note">Guarda primero al trabajador. Después podrás registrar su solicitud de transferencia, si corresponde.</p>;
 if(!cap)return <div className="ef-note" role="status"><strong>Registro bancario temporalmente no disponible.</strong>
  <p>{reason==='NOT_AUTHORIZED'
   ? 'Tu usuario no tiene autorización individual para ver o registrar cuentas bancarias. Solicita habilitación al responsable de permisos.'
   : reason==='KEY_NOT_CONFIGURED'
   ? 'Tu usuario está autorizado, pero falta configurar la clave privada de cifrado bancario en este servidor. Contacta al responsable técnico.'
   : 'No se pudo comprobar el acceso bancario. Contacta al responsable técnico.'}</p>
  <p>La cuenta no se puede registrar desde aquí hasta resolver el requisito de seguridad. No publiques claves ni números de cuenta en GitHub.</p>
 </div>;
 const set=(key,value)=>{if(canWrite)setData(p=>({...p,[key]:value}));};
 const changeHolder=checked=>{
  if(!canWrite)return;
  setThirdParty(checked);
  if(!checked)setData(prev=>({...prev,holderName:workerName||'',holderRut:workerRut||'',authorizationRef:''}));
  else setData(prev=>({...prev,holderName:'',holderRut:'',authorizationRef:''}));
 };
 async function uploadAuthorization(file){
  if(!file)return;
  if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')){setError('Selecciona un PDF.');return;}
  if(file.size<1||file.size>8*1024*1024){setError('El respaldo PDF debe tener hasta 8 MB.');return;}
  setUploading(true);setError('');
  try{
   const response=await fetch('/api/employee-benefits/'+employeeId+'/bank-authorization',{
    method:'POST',headers:{Authorization:'Bearer '+(localStorage.getItem('token')||''),'Content-Type':'application/pdf'},body:file
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(result.message||'No se pudo cargar el PDF de autorización.');
   set('authorizationRef',result.authorizationRef);
  }catch(e){setError(e.message);}finally{setUploading(false);if(uploadInput.current)uploadInput.current.value='';}
 }
 return <fieldset className="ef-section"><legend>Medio de pago y cuenta bancaria</legend>
  <p>Datos financieros confidenciales. Si el titular es un tercero se exige autorización bancaria en PDF, cifrada y vinculada a esta ficha.</p>
  {!canWrite&&<p className="ef-note" role="status">Solo lectura: puedes consultar estos datos pero no modificarlos sin el permiso individual de edición.</p>}
  {error&&<p role="alert" className="ef-note">{error}</p>}
  <div className="ef-grid">
   <label>Banco<select disabled={!canWrite} value={data.bankId||''} onChange={e=>set('bankId',Number(e.target.value))}>
    <option value="">Seleccionar banco</option>
    {banks.filter(b=>b.active||b.id===Number(data.bankId)).map(b=><option key={b.id} value={b.id}>{b.name}{b.active?'':' (histórico)'}</option>)}
   </select></label>
   <label>Tipo de cuenta<select disabled={!canWrite} value={data.accountType} onChange={e=>set('accountType',e.target.value)}>
    <option value="CORRIENTE">Corriente</option><option value="VISTA">Vista</option>
    <option value="CUENTARUT">CuentaRUT</option><option value="AHORRO">Ahorro</option><option value="OTRA">Otra</option>
   </select></label>
   <label>Número de cuenta<input disabled={!canWrite} type={showNumber?'text':'password'} value={data.accountNumber} autoComplete="off" onChange={e=>set('accountNumber',e.target.value)}/></label>
   <label>Mostrar número de cuenta<button type="button" onPointerDown={()=>setShowNumber(true)} onPointerUp={()=>setShowNumber(false)} onPointerLeave={()=>setShowNumber(false)} onBlur={()=>setShowNumber(false)} onKeyDown={e=>{if(e.key===' '||e.key==='Enter')setShowNumber(true);}} onKeyUp={()=>setShowNumber(false)}>Mantener pulsado para ver</button></label>
   <label className="la-check"><input type="checkbox" disabled={!canWrite} checked={thirdParty} onChange={e=>changeHolder(e.target.checked)}/> Titular distinto del trabajador</label>
   <label>Titular de la cuenta<input disabled={!canWrite||!thirdParty} value={thirdParty?data.holderName:(workerName||data.holderName)} placeholder={workerName||''} onChange={e=>set('holderName',e.target.value)}/></label>
   <label>RUT del titular<input disabled={!canWrite||!thirdParty} value={holderRutFocused?(thirdParty?data.holderRut:(workerRut||data.holderRut)):formatRut(thirdParty?data.holderRut:(workerRut||data.holderRut))} onFocus={()=>setHolderRutFocused(true)} onBlur={()=>setHolderRutFocused(false)} placeholder={workerRut||''} onChange={e=>set('holderRut',e.target.value)}/></label>
   <label>Fecha de solicitud<input disabled={!canWrite} type="date" value={data.requestedOn} onChange={e=>set('requestedOn',e.target.value)}/></label>
   {thirdParty&&<div className="ef-field-wide la-inline-actions">
    <input ref={uploadInput} aria-label="Seleccionar PDF de autorización de cuenta de tercero" type="file" accept=".pdf,application/pdf" hidden disabled={!canWrite||uploading} onChange={e=>uploadAuthorization(e.target.files?.[0])}/>
    <button type="button" className="la-small" disabled={!canWrite||uploading} onClick={()=>uploadInput.current?.click()}>{uploading?'Cargando…':'Cargar autorización (PDF)'}</button>
    <span role="status">{data.authorizationRef?'Respaldo asociado: '+data.authorizationRef:'Sin autorización cargada'}</span>
   </div>}
  </div>
  <p className="ef-note">La cuenta será cifrada. El sistema no transfiere dinero. Al editar esta información se registra el cambio, sin exponer el número en la bitácora.</p>
  {dirty&&<p className="ef-note">Cambios pendientes. Guardar mediante «Guardar ficha».</p>}
 </fieldset>;
});
export default EmployeeBankDetails;
