import React,{useEffect,useRef,useState} from 'react';

// Una lectura por apertura: se libera la cámara antes de mostrar el resultado.
export default function CameraIdentityPreview({terminalToken,actionLabel,onRead,busy=false,autoStart=false,facingMode='environment'}){
  const videoRef=useRef(null),readRef=useRef(onRead),runRef=useRef(0);
  readRef.current=onRead;
  const [enabled,setEnabled]=useState(autoStart),[result,setResult]=useState(null);
  const [status,setStatus]=useState({kind:'info',text:'Pulsa «Escanear QR» para utilizar la cámara.'});

  useEffect(()=>{
    if(!enabled||!terminalToken)return undefined;
    const run=++runRef.current;
    let stream=null,frame=null,reading=false;
    const valid=()=>runRef.current===run;
    async function scan(detector){
      if(!valid()||reading)return;
      try{
        const video=videoRef.current;
        if(video?.readyState>=2){
          const codes=await detector.detect(video);
          if(!valid())return;
          const qr=codes.map(x=>String(x.rawValue||'').trim())
            .find(value=>/^asistencia:at_[A-Za-z0-9_-]{43}$/.test(value));
          if(qr){
            reading=true;
            setStatus({kind:'info',text:'Verificando QR…'});
            try{
              const info=await readRef.current(qr);
              if(!valid())return;
              setResult(info);
              setStatus({kind:'success',text:'Lectura completada.'});
              setEnabled(false);
            }catch(error){
              if(!valid())return;
              setStatus({kind:'error',text:error.message||'No se pudo reconocer el QR.'});
              setEnabled(false);
            }
            return;
          }
        }
        if(valid())frame=requestAnimationFrame(()=>{void scan(detector);});
      }catch(error){
        if(!valid())return;
        setStatus({kind:'error',text:'Error de lectura: '+(error.message||'Cámara no disponible.')});
        setEnabled(false);
      }
    }
    async function start(){
      try{
        if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)
          throw new Error('La cámara requiere HTTPS con certificado confiable.');
        if(typeof window.BarcodeDetector!=='function')
          throw new Error('Este navegador no admite lector QR nativo. Usa Chrome Android actualizado.');
        const formats=await window.BarcodeDetector.getSupportedFormats();
        if(!formats.includes('qr_code'))throw new Error('El navegador no admite códigos QR.');
        const detector=new window.BarcodeDetector({formats:['qr_code']});
        const acquired=await navigator.mediaDevices.getUserMedia({
          video:{facingMode:{ideal:facingMode}},audio:false
        });
        if(!valid()){acquired.getTracks().forEach(track=>track.stop());return;}
        stream=acquired;
        if(!videoRef.current)return;
        videoRef.current.srcObject=stream;
        await videoRef.current.play();
        if(!valid())return;
        setStatus({kind:'info',text:'Enfoca el QR personal.'});
        void scan(detector);
      }catch(error){
        if(!valid())return;
        let message=error.message||'No se pudo abrir la cámara.';
        if(error.name==='NotAllowedError')message='Autoriza el permiso de cámara.';
        if(error.name==='NotFoundError')message='No se encontró una cámara.';
        setStatus({kind:'error',text:message});setEnabled(false);
      }
    }
    const onHidden=()=>{if(document.hidden)setEnabled(false);};
    document.addEventListener('visibilitychange',onHidden);
    void start();
    return ()=>{
      ++runRef.current;
      document.removeEventListener('visibilitychange',onHidden);
      if(frame!==null)cancelAnimationFrame(frame);
      if(stream)stream.getTracks().forEach(track=>track.stop());
      if(videoRef.current){videoRef.current.pause();videoRef.current.srcObject=null;}
    };
  },[enabled,terminalToken,facingMode]);

  const next=()=>{setResult(null);setStatus({kind:'info',text:'Abriendo cámara…'});setEnabled(true);};
  return <section className="tk-camera-preview" aria-label="Lector QR con cámara">
    {result&&!enabled?<div className={'tk-scan-result '+(result.registered?'tk-scan-registered':'tk-scan-identified')}
        role="status" aria-live="assertive">
      <div className="tk-scan-kind">{result.registered?'MARCACIÓN REGISTRADA':'IDENTIFICACIÓN CORRECTA'}</div>
      <strong className="tk-scan-name">{result.name}</strong>
      <div className="tk-scan-action">{result.action||actionLabel}</div>
      {result.time&&<time className="tk-scan-time">{result.time}</time>}
      {!result.registered&&<p>Prueba: no se registró asistencia.</p>}
    </div>:null}
    {enabled&&<div className="tk-camera-area">
      <video ref={videoRef} muted playsInline autoPlay aria-label="Vista de cámara QR"/>
    </div>}
    {!enabled&&!result&&<div className={'tk-camera-status tk-camera-'+status.kind} role="status">{status.text}</div>}
    {enabled&&<p className="tk-camera-hint">Enfoca el QR del trabajador.</p>}
    <button type="button" className="primary tk-next-scan" disabled={busy}
      onClick={()=>enabled?setEnabled(false):next()}>
      {enabled?'Detener cámara':result?'Escanear otro QR':'Escanear QR'}
    </button>
    {enabled&&<small>Se cerrará la cámara automáticamente después de identificar un QR.</small>}
  </section>;
}
