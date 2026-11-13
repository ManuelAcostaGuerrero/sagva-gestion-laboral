import React,{useEffect,useRef,useState} from 'react';
import {api} from './services/api.js';
import './tokens.css';
import CameraIdentityPreview from './CameraIdentityPreview.jsx';
import TabletAttendanceKiosk from './TabletAttendanceKiosk.jsx';
import TerminalActivationScanner from './TerminalActivationScanner.jsx';
import {requestId} from './requestId.js';
import {printAttendanceReceipt} from './printAttendanceReceipt.js';

const deliveryLabels={
  ACCEPTED_BY_PROVIDER:'El servicio de correo aceptó el envío; recepción aún no confirmada.',
  DELIVERED_TO_MAIL_SERVER:'El proveedor confirmó entrega al servidor de correo; lectura no acreditada.',
  BOUNCED:'El correo fue rechazado o devuelto. Administración debe revisar el destinatario.',
  DELIVERY_DELAYED:'El proveedor informa retraso de entrega. No se acredita recepción.',
  CONFIG_PENDING:'Envío pendiente: falta configurar el servicio de correo.',
  EMAIL_MISSING:'No se envió: falta un correo válido del trabajador.',
  EMAIL_DUPLICATED:'Envío retenido: correo duplicado entre trabajadores.',
  FAILED:'No se pudo enviar el correo. Administración puede reintentar.',
  DELIVERY_LOG_ERROR:'No se pudo confirmar el registro del envío.',
  NOT_ATTEMPTED:'Comprobante generado. Envío aún no intentado.'
};

const actions=[
  ['entrada','Entrada turno'],
  ['salida_colacion','Salida a colación'],
  ['entrada_colacion','Regreso de colación'],
  ['salida','Salida turno']
];

export default function TokenKiosk({setMessage}){
  const [terminal,setTerminal]=useState(()=>{
    try{return JSON.parse(localStorage.getItem('attendanceTerminal')||'null');}
    catch{return null;}
  });
  const [alternativesOpen,setAlternativesOpen]=useState(false);
  const [tabletMode,setTabletMode]=useState(()=>localStorage.getItem('attendanceTabletMode')==='1');
  const [recordCamera,setRecordCamera]=useState(false);
  const [activation,setActivation]=useState(''),[mode,setMode]=useState('QR'),[action,setAction]=useState('entrada');
  const [credential,setCredential]=useState(''),[employeeId,setEmployeeId]=useState(''),
    [workers,setWorkers]=useState([]),[busy,setBusy]=useState(false),[last,setLast]=useState(null);
  const attempt=useRef(null),credentialInput=useRef(null),activeRequest=useRef(false);

  function handleTerminalError(error){
    if(error.status===401 && /terminal (?:no autorizada|revocada)|activa esta terminal/i.test(error.message)){
      // El servidor ha rechazado la credencial. No existe botón para desvincular desde el celular.
      localStorage.removeItem('attendanceTerminal');
      setTerminal(null);
      setAlternativesOpen(false);
      setRecordCamera(false);
      setWorkers([]);
      setMessage('Terminal sin autorización. Solicita al administrador un nuevo código de activación.');
      return true;
    }
    return false;
  }

  useEffect(()=>{
    if(!terminal?.token)return undefined;
    let active=true;
    const token=terminal.token;
    // Al abrir la terminal únicamente consultamos su estado, NO la nómina de PIN.
    api('/tokens/terminal-workers?includeWorkers=0',{headers:{'X-Terminal-Token':token}})
      .then(r=>{
        if(!active)return;
        setTerminal(old=>old?.token===token?{...old,...r.terminal}:old);
        if(!r.terminal.cameraMarkEnabled)setRecordCamera(false);
      }).catch(error=>{
        if(active && !handleTerminalError(error))setMessage(error.message);
      });
    return ()=>{active=false;};
  },[terminal?.token]);

  useEffect(()=>{
    if(!terminal?.token||!alternativesOpen||mode!=='PIN')return undefined;
    let active=true;
    api('/tokens/terminal-workers?includeWorkers=1',{
      headers:{'X-Terminal-Token':terminal.token}
    }).then(r=>{
      if(active)setWorkers(r.workers||[]);
    }).catch(error=>{
      if(active && !handleTerminalError(error))setMessage(error.message);
    });
    return ()=>{active=false;};
  },[terminal?.token,alternativesOpen,mode]);

  useEffect(()=>{
    if(!last)return undefined;
    // Terminal compartida: no mantener a la vista información personal indefinidamente.
    const timeout=setTimeout(()=>setLast(null),30000);
    return ()=>clearTimeout(timeout);
  },[last]);

  async function activate(e){
    e.preventDefault();setBusy(true);
    try{
      const result=await api('/tokens/activate',{
        method:'POST',body:JSON.stringify({activationCode:activation.trim()})
      });
      const value={token:result.terminalToken,name:result.terminal.name,
        companyName:result.terminal.companyName,cameraMarkEnabled:result.terminal.cameraMarkEnabled};
      localStorage.setItem('attendanceTerminal',JSON.stringify(value));
      setTerminal(value);setActivation('');
      setMessage('Terminal autorizada.');
    }catch(e){setMessage(e.message);}
    finally{setBusy(false);}
  }

  async function mark(e){
    e.preventDefault();
    if(activeRequest.current)return;
    activeRequest.current=true;setBusy(true);
    try{
      const key=`${action}:${mode}:${employeeId}:${credential}`;
      if(attempt.current?.key!==key)attempt.current={key,id:requestId()};
      const body={type:action,requestId:attempt.current.id,...(mode==='QR'
        ?{token:credential.trim()}:{employeeId:Number(employeeId),pin:credential})};
      const result=await api('/tokens/mark',{method:'POST',
        headers:{'X-Terminal-Token':terminal.token},body:JSON.stringify(body)});
      setLast(result);
      setMessage(`${actions.find(a=>a[0]===action)[1]} registrada para ${result.employee.displayName}.`);
      setCredential('');attempt.current=null;
      credentialInput.current?.focus();
    }catch(error){
      if(!handleTerminalError(error))setMessage(error.message);
    }finally{activeRequest.current=false;setBusy(false);}
  }

  async function cameraRead(token){
    if(activeRequest.current)throw new Error('Espera la lectura anterior.');
    activeRequest.current=true;setBusy(true);setLast(null);
    try{
      const result=await api('/tokens/identify',{method:'POST',
        headers:{'X-Terminal-Token':terminal.token},body:JSON.stringify({token})});
      if(!recordCamera)return {name:result.employee.displayName,registered:false,action:'Trabajador identificado'};
      if(!result.cameraMarkEnabled)throw new Error('El administrador todavía no ha habilitado las marcaciones con cámara.');
      const key=`CAMERA:${action}:${token}`;
      if(attempt.current?.key!==key)attempt.current={key,id:requestId()};
      const marked=await api('/tokens/mark',{method:'POST',
        headers:{'X-Terminal-Token':terminal.token},
        body:JSON.stringify({token,type:action,requestId:attempt.current.id,source:'CAMERA'})});
      setLast(marked);attempt.current=null;
      return {name:marked.employee.displayName,registered:true,
        action:actions.find(a=>a[0]===action)[1],time:marked.record.registeredAt};
    }catch(error){
      handleTerminalError(error);
      throw error;
    }finally{activeRequest.current=false;setBusy(false);}
  }

  if(!terminal)return <form className="tk-kiosk" onSubmit={activate}>
    <h2>Activar terminal de asistencia</h2>
    <p>Solicita al administrador un código o QR de activación. Ambos son de un solo uso y vencen en 10 minutos.</p>
    <label>Código de activación
      <input value={activation} onChange={e=>setActivation(e.target.value)} autoComplete="off"
        autoCapitalize="none" autoCorrect="off" spellCheck={false}
        placeholder="Escribe el código o escanea su QR"/>
    </label>
    <TerminalActivationScanner onCode={setActivation}/>
    <button className="primary" disabled={busy||!activation.trim()}>
      {busy?'Activando…':'Activar este equipo'}
    </button>
  </form>;

  if(tabletMode)return <TabletAttendanceKiosk terminal={terminal}
   onExit={()=>{localStorage.removeItem('attendanceTabletMode');setTabletMode(false);}}
   onRevoked={()=>{localStorage.removeItem('attendanceTerminal');setTerminal(null);}}/>;
  return <section className="tk-kiosk tk-kiosk-minimal">
    <header className="tk-terminal-head">
      <span className="tk-badge"><strong>{terminal.name}</strong>
        {terminal.companyName&&<span> · {terminal.companyName}</span>}
      </span>
    </header>

    <button type="button" onClick={()=>{localStorage.setItem('attendanceTabletMode','1');setTabletMode(true);}}>Activar pantalla tablet</button>
    <h2>Registrar asistencia</h2>
    <div className="tk-actions" role="group" aria-label="Tipo de marcación">
      {actions.map(([value,label])=><button type="button" key={value}
        aria-pressed={action===value} className={action===value?'selected':''}
        disabled={busy} onClick={()=>{
          setAction(value);setLast(null);attempt.current=null;credentialInput.current?.focus();
        }}>{label}</button>)}
    </div>

    {!alternativesOpen&&<div className="tk-camera-primary">
      <div className="tk-camera-mode" role="group" aria-label="Modo de lectura">
        <button type="button" aria-pressed={!recordCamera} disabled={busy}
          onClick={()=>setRecordCamera(false)}>Solo identificar</button>
        <button type="button" aria-pressed={recordCamera}
          disabled={busy||!terminal.cameraMarkEnabled}
          onClick={()=>setRecordCamera(true)}>Registrar asistencia</button>
      </div>
      {!terminal.cameraMarkEnabled&&
        <small className="tk-camera-info-text">La marcación por cámara debe habilitarla el administrador. Puedes probar la identificación.</small>}
      <CameraIdentityPreview terminalToken={terminal.token}
        actionLabel={actions.find(a=>a[0]===action)[1]}
        onRead={cameraRead} busy={busy}/>
    </div>}

    <div className="tk-alternatives">
      <button type="button" className="tk-alternatives-toggle"
        aria-expanded={alternativesOpen}
        onClick={()=>{
          setAlternativesOpen(current=>!current);
          setCredential('');setLast(null);
        }}>
        {alternativesOpen?'Volver al lector con cámara':'Métodos alternativos: lector externo o PIN'}
      </button>
      {alternativesOpen&&<div className="tk-alternatives-content">
        <div className="tk-modes" role="group" aria-label="Método manual">
          <button type="button" aria-pressed={mode==='QR'}
            onClick={()=>{setMode('QR');setCredential('');}}>
            QR con lector externo
          </button>
          <button type="button" aria-pressed={mode==='PIN'}
            onClick={()=>{setMode('PIN');setCredential('');}}>
            PIN de respaldo
          </button>
        </div>
        <form onSubmit={mark}>
          {mode==='PIN'&&<label>Trabajador
            <select value={employeeId} onChange={e=>setEmployeeId(e.target.value)}>
              <option value="">Selecciona tu nombre</option>
              {workers.map(w=><option key={w.id} value={w.id}>{w.displayName}</option>)}
            </select>
          </label>}
          <label>{mode==='QR'?'Leer tarjeta con escáner externo':'PIN personal'}
            <input ref={credentialInput} type="password" autoComplete="off"
              inputMode={mode==='PIN'?'numeric':undefined}
              value={credential} onChange={e=>setCredential(e.target.value)}
              placeholder={mode==='QR'?'Escanear QR o introducir código':'Introduce tu PIN'}/>
          </label>
          <button className="primary tk-submit"
            disabled={busy||!credential||(mode==='PIN'&&!employeeId)}>
            {busy?'Registrando…':`Registrar ${actions.find(a=>a[0]===action)[1].toLowerCase()}`}
          </button>
        </form>

      </div>}
    </div>
    {last?.record?.receipt&&<aside className="tk-last tk-receipt" aria-live="polite">
      <strong>Comprobante #{last.record.id} · {last.employee.displayName}</strong>
      <p>{actions.find(a=>a[0]===last.record.type)?.[1]} · {last.record.registeredAt}</p>
      <p>{deliveryLabels[last.record.receipt.deliveryStatus]||'Estado del envío no disponible.'}</p>
      {last.record.receipt.authenticityStatus!=='SIGNED'&&
        <p>Firma de autenticidad pendiente de configuración; integridad SHA-256 conservada.</p>}
      <button type="button" onClick={()=>{
        if(!printAttendanceReceipt(last.record.receipt))setMessage('El navegador bloqueó la ventana de impresión.');
      }}>Ver e imprimir comprobante</button>
    </aside>}
  </section>;
}
