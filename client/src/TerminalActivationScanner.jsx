import React,{useEffect,useRef,useState} from 'react';
import {parseTerminalActivationQr} from '../../server/src/terminalActivationQr.js';

// Lector específico de activación. Nunca registra asistencia ni activa sin confirmación.
export default function TerminalActivationScanner({onCode}){
 const videoRef=useRef(null),callback=useRef(onCode),runRef=useRef(0);
 callback.current=onCode;
 const [enabled,setEnabled]=useState(false);
 const [message,setMessage]=useState('');
 useEffect(()=>{
  if(!enabled)return undefined;
  const run=++runRef.current;
  let stream=null,frame=null,reading=false;
  const live=()=>run===runRef.current;
  async function scan(detector){
   if(!live()||reading)return;
   try{
    const video=videoRef.current;
    if(video?.readyState>=2){
     const codes=await detector.detect(video);
     if(!live())return;
     const code=codes.map(x=>parseTerminalActivationQr(x.rawValue)).find(Boolean);
     if(code){
      reading=true;
      callback.current(code);
      setMessage('Código QR reconocido. Confirma la activación de este equipo.');
      setEnabled(false);
      return;
     }
    }
    if(live())frame=requestAnimationFrame(()=>{void scan(detector);});
   }catch(e){
    if(!live())return;
    setMessage('No se pudo leer el QR: '+(e.message||'error de cámara.'));
    setEnabled(false);
   }
  }
  async function start(){
   try{
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)
     throw new Error('Para usar la cámara debes abrir SAGVA por HTTPS seguro.');
    if(typeof window.BarcodeDetector!=='function')
     throw new Error('Este navegador no admite lectura QR nativa. Puedes ingresar el código manualmente.');
    const formats=await window.BarcodeDetector.getSupportedFormats();
    if(!formats.includes('qr_code'))throw new Error('Lector QR no disponible. Ingresa el código manualmente.');
    const detector=new window.BarcodeDetector({formats:['qr_code']});
    const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    if(!live()){acquired.getTracks().forEach(t=>t.stop());return;}
    stream=acquired;
    if(!videoRef.current){setEnabled(false);return;}
    videoRef.current.srcObject=stream;
    await videoRef.current.play();
    if(!live())return;
    setMessage('Enfoca el QR de activación que aparece en Administración.');
    void scan(detector);
   }catch(e){
    if(!live())return;
    setMessage(e.name==='NotAllowedError'?'Autoriza el permiso de cámara.':e.message||'No se pudo abrir la cámara.');
    setEnabled(false);
   }
  }
  const hidden=()=>{if(document.hidden)setEnabled(false);};
  document.addEventListener('visibilitychange',hidden);
  void start();
  return ()=>{
   ++runRef.current;
   document.removeEventListener('visibilitychange',hidden);
   if(frame!==null)cancelAnimationFrame(frame);
   if(stream)stream.getTracks().forEach(t=>t.stop());
   if(videoRef.current){videoRef.current.pause();videoRef.current.srcObject=null;}
  };
 },[enabled]);
 return <div className="tk-activation-scan">
  {enabled&&<div className="tk-camera-area"><video ref={videoRef} muted playsInline autoPlay aria-label="Cámara para QR de activación"/></div>}
  <button type="button" className="tk-scan-toggle" onClick={()=>{
   if(enabled)setEnabled(false);
   else{setMessage('Abriendo cámara…');setEnabled(true);}
  }}>{enabled?'Detener cámara':'Escanear QR de activación'}</button>
  {message&&<p className="tk-camera-status tk-camera-info" role="status">{message}</p>}
  <small>El QR de activación no es el QR personal del trabajador. También puedes escribir el código.</small>
 </div>;
}
