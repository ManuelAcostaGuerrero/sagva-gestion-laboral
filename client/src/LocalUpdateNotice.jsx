import {useEffect,useState} from 'react';

export default function LocalUpdateNotice(){
  const [pending,setPending]=useState(false);
  useEffect(()=>{
    let active=true;
    const check=async()=>{
      try{
        const response=await fetch('/local-version.json',{cache:'no-store',signal:AbortSignal.timeout(5000)});
        if(!response.ok)return;
        const version=await response.json();
        if(active&&/^[a-f0-9]{40}$/.test(version.commit))setPending(version.commit!==__SAGVA_BUILD_COMMIT__);
      }catch{/* La falta de red no descarta formularios ni fuerza recargas. */}
    };
    void check();
    const visible=()=>{if(!document.hidden)void check();};
    document.addEventListener('visibilitychange',visible);
    const timer=setInterval(check,60000);
    return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
  },[]);
  return <aside aria-label="Instalación de Gestión Laboral" data-installed-commit={__SAGVA_BUILD_COMMIT__}
    style={{position:'fixed',bottom:8,right:8,zIndex:1000,maxWidth:340,padding:'8px 12px',background:'#fff',color:'#163d45',border:'1px solid #9bb9ba',borderRadius:8,fontSize:12}}>
    <span>SAGVA Gestión Laboral · INT-001 · {__SAGVA_BUILD_COMMIT__.slice(0,7)}</span>
    {pending&&<div role="status">Hay una actualización. Guarda tus cambios y recarga esta misma pestaña.
      <button type="button" onClick={()=>{if(window.confirm('¿Guardaste todos los cambios? Se recargará esta misma pestaña.'))window.location.reload();}}>Recargar esta pestaña</button>
    </div>}
  </aside>;
}
