import React,{useEffect,useRef,useState} from 'react';
import CameraIdentityPreview from './CameraIdentityPreview.jsx';
import {api} from './services/api.js';
import {requestId} from './requestId.js';
import './tabletKiosk.css';
const types=[['entrada','ENTRADA DE TURNO'],['salida_colacion','INICIAR COLACIÓN'],['entrada_colacion','TERMINAR COLACIÓN'],['salida','SALIDA DE TURNO']];
const label=t=>types.find(x=>x[0]===t)?.[1]||t;
const dateFmt={timeZone:'America/Santiago',day:'numeric',month:'long',year:'numeric',weekday:'long'};
const timeFmt={timeZone:'America/Santiago',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false};
export default function TabletAttendanceKiosk({terminal,onExit,onRevoked}){
 const [stage,setStage]=useState('idle'),[worker,setWorker]=useState(null),[token,setToken]=useState('');
 const [info,setInfo]=useState(null),[result,setResult]=useState(null),[error,setError]=useState('');
 const [front,setFront]=useState(true),[busy,setBusy]=useState(false);
 const [clock,setClock]=useState({offset:0,ok:false}),[now,setNow]=useState(Date.now());
 const pending=useRef(null);
 function reset(){pending.current=null;setStage('idle');setWorker(null);setToken('');setInfo(null);setResult(null);setError('');setBusy(false);}
 useEffect(()=>{const h=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(h);},[]);
 useEffect(()=>{
  let live=true;
  async function sync(){
   const start=Date.now();
   try{
    const res=await api('/tokens/terminal-clock',{headers:{'X-Terminal-Token':terminal.token}});
    if(live)setClock({offset:res.serverEpochMs-(start+Date.now())/2,ok:true});
   }catch(e){if(live)setClock(old=>({...old,ok:false}));}
  }
  void sync();const h=setInterval(()=>void sync(),30000);
  return()=>{live=false;clearInterval(h);};
 },[terminal.token]);
 useEffect(()=>{
  if(stage!=='success')return undefined;
  const h=setTimeout(reset,10000);return()=>clearTimeout(h);
 },[stage]);
 async function onRead(qr){
  const data=await api('/tokens/identify',{method:'POST',headers:{'X-Terminal-Token':terminal.token},body:JSON.stringify({token:qr})});
  if(!data.cameraMarkEnabled)throw new Error('Habilita las marcaciones por cámara en Administración.');
  setToken(qr);setWorker(data.employee);setInfo(data);setError('');setStage('choose');
  return {name:data.employee.displayName,registered:false,action:'Trabajador identificado'};
 }
 async function confirm(type){
  if(busy)return;
  if(pending.current?.type!==type)pending.current={type,id:requestId()};
  setBusy(true);setError('');
  try{
   const data=await api('/tokens/mark',{method:'POST',headers:{'X-Terminal-Token':terminal.token},
    body:JSON.stringify({token,type,source:'CAMERA',requestId:pending.current.id})});
   pending.current=null;setResult(data);setStage('success');
  }catch(e){
   if(e.status===401&&/terminal.*(revocada|autorizada)|activa esta terminal/i.test(e.message)){onRevoked();return;}
   setError(e.message);
  }finally{setBusy(false);}
 }
 const epoch=now+clock.offset;
 const big=info?.recommendedType,alternates=types.filter(x=>x[0]!==big);
 return <section className="sagva-tablet" aria-label="Reloj de asistencia SAGVA">
   <header className="sagva-tablet-header">
     <div><b>RED TAURUS · ASISTENCIA</b><small>{terminal.companyName||terminal.name}</small></div>
     <div><span className={clock.ok?'sagva-ok':'sagva-warn'}>{clock.ok?'● Hora sincronizada':'⚠ Hora sin verificar'}</span>
       <button type="button" onClick={onExit}>Salir del modo tablet</button></div>
   </header>
   <div className="sagva-tablet-body">
   {stage==='idle'&&<div className="sagva-idle">
     <div className="sagva-date">{new Intl.DateTimeFormat('es-CL',dateFmt).format(new Date(epoch))}</div>
     <div className="sagva-clock">{new Intl.DateTimeFormat('es-CL',timeFmt).format(new Date(epoch))}</div>
     <button type="button" className="sagva-big" onClick={()=>setStage('scan')}>▣ ESCANEAR QR</button>
     <p>Acerca tu credencial cuando se abra la cámara.</p>
   </div>}
   {stage==='scan'&&<div className="sagva-kiosk-card">
     <h2>Escanear credencial</h2><p>La cámara se cerrará automáticamente después de leer el QR.</p>
     <CameraIdentityPreview key={front?'front':'rear'} autoStart facingMode={front?'user':'environment'} terminalToken={terminal.token} onRead={onRead} actionLabel="Identificando"/>
     <div className="sagva-alts"><button type="button" onClick={()=>setFront(v=>!v)}>Cambiar a cámara {front?'trasera':'frontal'}</button><button type="button" onClick={reset}>Cancelar</button></div>
   </div>}
   {stage==='choose'&&<div className="sagva-kiosk-card">
     <h2>{worker?.displayName}</h2><p>Escaneo a las {info?.scannedAt?.slice(11)} · Día operativo {info?.operatingDay}</p>
     <p>Selecciona la marcación. La hora oficial se registra al confirmar.</p>
     {info?.completed&&<p className="sagva-warn">Jornada finalizada. Solo marca otra opción si corresponde.</p>}
     {big&&<><p>OPCIÓN RECOMENDADA</p><button type="button" className="sagva-big" disabled={busy} onClick={()=>confirm(big)}>{label(big)}</button></>}
     <p>OTRAS MARCACIONES</p><div className="sagva-alts">{alternates.map(([id,title])=><button key={id} type="button" disabled={busy} onClick={()=>confirm(id)}>{title}</button>)}</div>
     {error&&<p role="alert" className="sagva-warn">{error}</p>}
     <button type="button" className="sagva-subtle" onClick={reset}>Cancelar y volver al reloj</button>
   </div>}
   {stage==='success'&&<div className="sagva-kiosk-card sagva-success" role="status">
     <h2>✓ MARCACIÓN REGISTRADA</h2><h2>{result?.employee?.displayName}</h2>
     <strong className="sagva-result-hour">{result?.record?.registeredAt?.slice(11)}</strong>
     <p>{label(result?.record?.type)} · {result?.record?.registeredAt?.slice(0,10)}</p>
     <p>Comprobante Nº {result?.record?.id} · {terminal.companyName||terminal.name}</p>
     <p>Regreso automático al reloj: 10 segundos</p>
     <button type="button" className="sagva-big" onClick={reset}>SIGUIENTE TRABAJADOR</button>
   </div>}
   </div>
   <footer>Hora referida al servidor SAGVA · La identificación QR no registra asistencia hasta confirmar.</footer>
 </section>;
}
