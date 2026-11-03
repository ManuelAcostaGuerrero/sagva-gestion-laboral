import React,{useEffect,useState} from 'react';
import {api} from './services/api.js';
import './tokens.css';
import {printQrCard} from './printQrCard.js';
import {printQrCards} from './printQrCards.js';

export default function TokenCredentials({onMessage,canBulk=false,canRevokeTerminal=false}){
  const [section,setSection]=useState('workers');
  const [search,setSearch]=useState(''),[workers,setWorkers]=useState([]),[searchBusy,setSearchBusy]=useState(false),[searchVersion,setSearchVersion]=useState(0);
  const [employee,setEmployee]=useState(''),[pin,setPin]=useState(''),[card,setCard]=useState(null);
  const [batchSelected,setBatchSelected]=useState({}),[batchCards,setBatchCards]=useState([]),[batchConfirm,setBatchConfirm]=useState(false);
  const [companies,setCompanies]=useState([]),[companyId,setCompanyId]=useState(''),[terminalDrafts,setTerminalDrafts]=useState({});
  const [terminals,setTerminals]=useState([]),[name,setName]=useState(''),[activation,setActivation]=useState(null);
  const [terminalToRevoke,setTerminalToRevoke]=useState(null);
  const [busy,setBusy]=useState(false),[confirm,setConfirm]=useState(null),[error,setError]=useState('');

  useEffect(()=>{
    if(section!=='workers')return undefined;
    const q=search.trim();
    if(q.length<2){setWorkers([]);setSearchBusy(false);return undefined;}
    let active=true;setSearchBusy(true);
    const timer=setTimeout(()=>{
      api('/tokens/workers?q='+encodeURIComponent(q)).then(result=>{
        if(active)setWorkers(result.workers);
      }).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setSearchBusy(false);});
    },300);
    return ()=>{active=false;clearTimeout(timer);};
  },[search,searchVersion,section]);

  useEffect(()=>{
    if(section!=='terminals')return undefined;
    let active=true;
    Promise.all([api('/tokens/terminals'),api('/companies')]).then(([t,c])=>{
      if(active){setTerminals(t.terminals);setCompanies(c.companies.filter(company=>company.isActive));}
    }).catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[section]);

  const selected=workers.find(w=>w.id===Number(employee));
  const count=Object.keys(batchSelected).length;
  async function perform(action,{refreshWorkers=false,refreshTerminals=false}={}){
    setBusy(true);setError('');
    try{
      await action();setConfirm(null);
      if(refreshWorkers)setSearchVersion(n=>n+1);
      if(refreshTerminals){
        const [t,c]=await Promise.all([api('/tokens/terminals'),api('/companies')]);
        setTerminals(t.terminals);setCompanies(c.companies.filter(company=>company.isActive));
      }
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  }
  const issue=()=>perform(async()=>{
    const result=await api('/tokens/workers/'+employee+'/issue',{method:'POST'});
    setCard({...result,name:selected.displayName});
    setBatchSelected(old=>{const next={...old};delete next[employee];return next;});
    onMessage?.(result.message);
  },{refreshWorkers:true});

  async function issueBatch(){
    const ids=Object.keys(batchSelected).map(Number);
    await perform(async()=>{
      const result=await api('/tokens/workers/batch-issue',{
        method:'POST',body:JSON.stringify({employeeIds:ids})
      });
      setBatchCards(result.cards);setBatchSelected({});setBatchConfirm(false);
      onMessage?.(result.message);
    },{refreshWorkers:true});
  }

  return <section className="tk-management">
    <h2>Credenciales y terminales</h2>
    <div className="tk-admin-tabs" role="group" aria-label="Seleccionar configuración">
      <button type="button" aria-pressed={section==='workers'} onClick={()=>{
        setSection('workers');setError('');
      }}>QR y PIN del personal</button>
      <button type="button" aria-pressed={section==='terminals'} onClick={()=>{
        setSection('terminals');setError('');
      }}>Configurar terminales</button>
    </div>
    {error&&<p className="tk-note" role="alert">{error}</p>}

    {section==='workers' && <>
      <p>Busca al trabajador por nombre o documento. No se carga el listado completo.</p>
      <label>Buscar trabajador
        <input type="search" value={search} placeholder="Escribe al menos 2 caracteres"
          onChange={e=>{setSearch(e.target.value);setEmployee('');setCard(null);setConfirm(null);}}/>
      </label>
      {searchBusy&&<small>Buscando…</small>}
      {search.trim().length>=2&&!searchBusy&&workers.length===0&&<p>Sin resultados.</p>}
      {workers.length>0&&<>
        <label>Trabajador encontrado
          <select value={employee} onChange={e=>{
            setEmployee(e.target.value);setPin('');setCard(null);setConfirm(null);
          }}>
            <option value="">Seleccionar trabajador</option>
            {workers.map(w=><option key={w.id} value={w.id}>{w.displayName}{w.isActive?'':' (inactivo)'}</option>)}
          </select>
        </label>
        <small>Máximo 30 resultados por búsqueda. Especifica más el nombre si hace falta.</small>
      </>}
      {selected&&<div className="tk-note">
        <strong>{selected.displayName}</strong>
        <p>QR: {selected.issuedAt?'emitido':'pendiente'} · PIN: {selected.pinEnabled?'habilitado':'pendiente'}</p>
        <div className="tk-buttons">
          <button type="button" disabled={busy||!selected.isActive} onClick={()=>setConfirm({type:'issue'})}>
            {selected.issuedAt?'Regenerar QR':'Emitir QR'}
          </button>
          <button type="button" disabled={busy||!selected.issuedAt} onClick={()=>setConfirm({type:'revoke'})}>Revocar QR</button>
        </div>
        {confirm&&<div className="tk-note" role="dialog" aria-label="Confirmar credencial">
          <p>{confirm.type==='issue'?'Emitir un QR nuevo invalidará cualquier tarjeta anterior.':'La tarjeta dejará de funcionar.'}</p>
          <button type="button" onClick={()=>setConfirm(null)}>Cancelar</button>
          <button type="button" disabled={busy} onClick={()=>confirm.type==='issue'?issue():perform(async()=>{
            await api('/tokens/workers/'+employee+'/revoke',{method:'POST'});
            setCard(null);onMessage?.('QR revocado.');
          },{refreshWorkers:true})}>Confirmar</button>
        </div>}
        <form onSubmit={e=>{e.preventDefault();perform(async()=>{
          await api('/tokens/workers/'+employee+'/pin',{method:'PUT',body:JSON.stringify({enabled:true,pin})});
          setPin('');onMessage?.('PIN guardado.');
        },{refreshWorkers:true});}}>
          <label>Nuevo PIN personal (4–8 dígitos)
            <input type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={e=>setPin(e.target.value)}/>
          </label>
          <div className="tk-buttons">
            <button disabled={busy||!selected.isActive||!/^[0-9]{4,8}$/.test(pin)}>Guardar PIN</button>
            <button type="button" disabled={busy||!selected.pinEnabled} onClick={()=>perform(async()=>{
              await api('/tokens/workers/'+employee+'/pin',{method:'PUT',body:JSON.stringify({enabled:false})});
              onMessage?.('PIN deshabilitado.');
            },{refreshWorkers:true})}>Deshabilitar PIN</button>
          </div>
        </form>
      </div>}
      {card&&<div className="tk-card">
        <strong>{card.name}</strong><img src={card.qrDataUrl} alt="Tarjeta QR personal"/>
        <p>Guarda o imprime ahora. El QR privado no puede recuperarse del servidor.</p>
        <a href={card.qrDataUrl} download="tarjeta-asistencia.png">Guardar QR</a>
        <button type="button" onClick={()=>printQrCard(card).catch(e=>setError(e.message))}>Imprimir tarjeta</button>
        <button type="button" onClick={()=>setCard(null)}>Cerrar tarjeta</button>
      </div>}

      {canBulk&&<section className="tk-bulk">
        <h3>Impresión múltiple · tamaño tarjeta personal</h3>
        <p>Solo se pueden emitir en lote tarjetas de trabajadores que todavía no tienen QR.
          Los QR ya emitidos no se regeneran ni se invalidan.</p>
        {workers.filter(w=>w.isActive&&!w.issuedAt).length>0&&<div className="tk-bulk-choices">
          {workers.filter(w=>w.isActive&&!w.issuedAt).map(w=><label key={w.id}>
            <input type="checkbox" disabled={busy||(!batchSelected[w.id]&&count>=20)}
              checked={!!batchSelected[w.id]} onChange={e=>setBatchSelected(old=>{
                const next={...old};if(e.target.checked)next[w.id]={id:w.id,name:w.displayName};
                else delete next[w.id];return next;
              })}/>
            {w.displayName}
          </label>)}
        </div>}
        <p>Seleccionados: {count} / 20</p>
        {count>0&&<div className="tk-buttons">
          <button type="button" disabled={busy} onClick={()=>setBatchConfirm(true)}>Emitir {count} QR nuevos</button>
          <button type="button" disabled={busy} onClick={()=>{setBatchSelected({});setBatchConfirm(false);}}>Limpiar selección</button>
        </div>}
        {batchConfirm&&<div className="tk-note" role="dialog" aria-label="Confirmar impresión múltiple">
          <p>Se generarán {count} credenciales nuevas. Imprime o guarda inmediatamente las tarjetas:
            el servidor conservará solo sus hashes, no las imágenes.</p>
          <button type="button" disabled={busy} onClick={()=>setBatchConfirm(false)}>Cancelar</button>
          <button type="button" disabled={busy||count===0} onClick={issueBatch}>Confirmar emisión</button>
        </div>}
        {batchCards.length>0&&<div className="tk-note">
          <strong>{batchCards.length} tarjetas nuevas generadas</strong>
          <p>Formato ISO ID-1 (85,6 × 54 mm), varias tarjetas por hoja A4. No cierres esta pantalla antes de imprimir o guardar en PDF.</p>
          <button type="button" onClick={()=>printQrCards(batchCards).catch(e=>setError(e.message))}>Imprimir todas / Guardar PDF</button>
          <button type="button" onClick={()=>setBatchCards([])}>Cerrar tarjetas</button>
        </div>}
      </section>}
    </>}

    {section==='terminals'&&<>
      <p>Administración exclusiva de terminales: empresa, activación y permisos de cámara.
        No modifica las tarjetas QR del personal.</p>
      <form onSubmit={e=>{e.preventDefault();perform(async()=>{
        const r=await api('/tokens/terminals',{method:'POST',body:JSON.stringify({name,companyId:Number(companyId)})});
        setActivation(r.activationCode);setName('');
      },{refreshTerminals:true});}}>
        <label>Empresa
          <select value={companyId} onChange={e=>setCompanyId(e.target.value)}>
            <option value="">Seleccionar empresa</option>
            {companies.map(c=><option key={c.id} value={c.id}>{c.legalName}</option>)}
          </select>
        </label>
        <label>Nombre del equipo
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej. Celular recepción"/>
        </label>
        <button disabled={busy||!name.trim()||!companyId}>Crear terminal</button>
      </form>
      {activation&&<div className="tk-note">
        <p>Código de activación de un solo uso, vence en 10 minutos.</p>
        <code className="tk-secret">{activation}</code>
        <button type="button" onClick={()=>setActivation(null)}>Ocultar código</button>
      </div>}
      <h3>Terminales registradas</h3>
      {terminals.map(t=>{
        const draft=terminalDrafts[t.id]||{companyId:t.companyId||'',cameraMarkEnabled:!!t.cameraMarkEnabled};
        return <div className="tk-terminal" key={t.id}>
          <strong>{t.name}</strong>
          <small>{t.companyName||'Empresa pendiente'} · {t.isActive?(t.activatedAt?'Activa':'Pendiente de activación'):'Revocada'}</small>
          <label>Empresa
            <select disabled={busy||!t.isActive} value={draft.companyId}
              onChange={e=>setTerminalDrafts(old=>({...old,[t.id]:{...draft,companyId:e.target.value,cameraMarkEnabled:false}}))}>
              <option value="">Seleccionar empresa</option>
              {companies.map(c=><option key={c.id} value={c.id}>{c.legalName}</option>)}
            </select>
          </label>
          <label className="tk-check">
            <input type="checkbox" disabled={busy||!t.isActive} checked={draft.cameraMarkEnabled}
              onChange={e=>setTerminalDrafts(old=>({...old,[t.id]:{...draft,cameraMarkEnabled:e.target.checked}}))}/>
            Habilitar marcación por cámara después de probar
          </label>
          <div className="tk-buttons">
            <button type="button" disabled={busy||!t.isActive||!draft.companyId}
              onClick={()=>perform(async()=>{
                const result=await api('/tokens/terminals/'+t.id+'/config',{
                  method:'POST',body:JSON.stringify({...draft,companyId:Number(draft.companyId)})
                });
                if(result.activationCode)setActivation(result.activationCode);
                setTerminalDrafts(old=>{const next={...old};delete next[t.id];return next;});
                onMessage?.(result.message);
              },{refreshTerminals:true})}>Guardar configuración</button>
            {canRevokeTerminal&&<button type="button" className="danger" disabled={busy||!t.isActive}
              onClick={()=>setTerminalToRevoke({id:t.id,name:t.name})}>
              Desvincular terminal
            </button>}
          </div>
        </div>;
      })}
      {canRevokeTerminal&&terminalToRevoke&&<div className="tk-note tk-revoke-confirm" role="dialog"
        aria-label="Confirmar desvinculación de terminal">
        <strong>Desvincular {terminalToRevoke.name}</strong>
        <p>Se revocará el acceso de este equipo inmediatamente y dejará de registrar asistencia.
          Para volver a utilizarlo tendrás que crear una nueva activación de terminal desde Administración.
          No se eliminan las marcaciones históricas.</p>
        <div className="tk-buttons">
          <button type="button" disabled={busy} onClick={()=>setTerminalToRevoke(null)}>Cancelar</button>
          <button type="button" className="danger" disabled={busy} onClick={()=>perform(async()=>{
            await api('/tokens/terminals/'+terminalToRevoke.id+'/revoke',{method:'POST'});
            setTerminalToRevoke(null);
            onMessage?.('Terminal desvinculada y acceso revocado. Las marcaciones históricas se conservan.');
          },{refreshTerminals:true})}>Confirmar desvinculación</button>
        </div>
      </div>}
    </>}
  </section>;
}
