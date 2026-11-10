
import React,{forwardRef,useEffect,useImperativeHandle,useState} from 'react';
import {api} from './services/api.js';
const initial=()=>({revision:0,bankId:0,accountType:'VISTA',accountNumber:'',holderName:'',holderRut:'',requestedOn:'',authorizationRef:''});
const EmployeeBankDetails=forwardRef(function EmployeeBankDetails({employeeId,workerName,workerRut,onDirtyChange},ref){
 const [cap,setCap]=useState(false),[reason,setReason]=useState(''),[banks,setBanks]=useState([]);
 const [data,setData]=useState(initial),[saved,setSaved]=useState(JSON.stringify(initial()));
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[showNumber,setShowNumber]=useState(false);
 const dirty=JSON.stringify(data)!==saved;
 useEffect(()=>{onDirtyChange?.(cap&&dirty);},[cap,dirty,onDirtyChange]);
 useEffect(()=>{let active=true;setCap(false);setData(initial());setSaved(JSON.stringify(initial()));setError('');
  api('/employee-benefits/bank-capability').then(async capability=>{
   if(!active)return;
   setCap(!!capability.canAccess);setReason(capability.reason||'');
   if(!capability.canAccess||!employeeId)return;
   const [catalog,bank]=await Promise.all([
    api('/labor-benefits/banks'),api('/employee-benefits/'+employeeId+'/bank')
   ]);
   if(!active)return;
   setBanks(catalog.banks||[]);
   const value={...initial(),...bank.account,revision:bank.revision};
   setData(value);setSaved(JSON.stringify(value));
  }).catch(e=>{if(active)setError(e.message);});
  return()=>{active=false;};
 },[employeeId]);
 async function save(){
  if(!employeeId||!cap||busy)return;
  setBusy(true);setError('');
  try{
   const payload={...data,bankId:Number(data.bankId),holderName:data.holderName||workerName,holderRut:data.holderRut||workerRut};
   await api('/employee-benefits/'+employeeId+'/bank',{method:'PUT',body:JSON.stringify(payload)});
   const response=await api('/employee-benefits/'+employeeId+'/bank');
   const value={...initial(),...response.account,revision:response.revision};
   setData(value);setSaved(JSON.stringify(value));
  }catch(e){setError(e.message);throw e;}finally{setBusy(false);}
 }
 useImperativeHandle(ref,()=>({isDirty:()=>cap&&dirty,saveChanges:save}),[cap,dirty,data,employeeId,busy,workerName,workerRut]);
 if(!employeeId)return <p className="ef-note">Guarda primero al trabajador. Después podrás registrar su solicitud de transferencia, si corresponde.</p>;
 if(!cap)return <div className="ef-note" role="status"><strong>Registro bancario temporalmente no disponible.</strong>
  <p>{reason==='NOT_AUTHORIZED'
   ? 'Tu usuario no tiene autorización individual para ver o registrar cuentas bancarias. Solicita habilitación al responsable de permisos.'
   : reason==='KEY_NOT_CONFIGURED'
   ? 'Tu usuario está autorizado, pero falta configurar la clave privada de cifrado bancario en este servidor. Contacta al responsable técnico.'
   : 'No se pudo comprobar el acceso bancario. Contacta al responsable técnico.'}</p>
  <p>La cuenta no se puede registrar desde aquí hasta resolver el requisito de seguridad. No publiques claves ni números de cuenta en GitHub.</p>
 </div>;
 const set=(key,value)=>setData(p=>({...p,[key]:value}));
 return <fieldset className="ef-section"><legend>Medio de pago y cuenta bancaria</legend>
  <p>Datos personales financieros. Solo registrar transferencia solicitada por el trabajador y respaldada por autorización.</p>
  {error&&<p role="alert" className="ef-note">{error}</p>}
  <div className="ef-grid">
   <label>Banco<select value={data.bankId||''} onChange={e=>set('bankId',Number(e.target.value))}>
    <option value="">Seleccionar banco</option>
    {banks.filter(b=>b.active||b.id===Number(data.bankId)).map(b=><option key={b.id} value={b.id}>{b.name}{b.active?'':' (histórico)'}</option>)}
   </select></label>
   <label>Tipo de cuenta<select value={data.accountType} onChange={e=>set('accountType',e.target.value)}>
    <option value="CORRIENTE">Corriente</option><option value="VISTA">Vista</option>
    <option value="CUENTARUT">CuentaRUT</option><option value="AHORRO">Ahorro</option><option value="OTRA">Otra</option>
   </select></label>
   <label>Número de cuenta<input type={showNumber?'text':'password'} value={data.accountNumber} autoComplete="off" onChange={e=>set('accountNumber',e.target.value)}/></label>
   <label>Mostrar número de cuenta<button type="button" onPointerDown={()=>setShowNumber(true)} onPointerUp={()=>setShowNumber(false)} onPointerLeave={()=>setShowNumber(false)} onBlur={()=>setShowNumber(false)} onKeyDown={e=>{if(e.key===' '||e.key==='Enter')setShowNumber(true);}} onKeyUp={()=>setShowNumber(false)}>Mantener pulsado para ver</button></label>
   <label>Titular de la cuenta<input value={data.holderName} placeholder={workerName||''} onChange={e=>set('holderName',e.target.value)}/></label>
   <label>RUT del titular<input value={data.holderRut} placeholder={workerRut||''} onChange={e=>set('holderRut',e.target.value)}/></label>
   <label>Fecha de solicitud<input type="date" value={data.requestedOn} onChange={e=>set('requestedOn',e.target.value)}/></label>
   <label>Referencia autorización<input value={data.authorizationRef} placeholder="Código o folio del documento privado" onChange={e=>set('authorizationRef',e.target.value)}/></label>
  </div>
  <p className="ef-note">La cuenta será cifrada. El sistema no transfiere dinero. Al editar esta información se registra el cambio, sin exponer el número en la bitácora.</p>
  {dirty&&<p className="ef-note">Cambios pendientes. Guardar mediante «Guardar ficha».</p>}
 </fieldset>;
});
export default EmployeeBankDetails;
