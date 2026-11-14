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
  const [issuedVisible,setIssuedVisible]=useState(false),[issuedWorkers,setIssuedWorkers]=useState([]),
    [issuedOffset,setIssuedOffset]=useState(0),[issuedMore,setIssuedMore]=useState(false),[issuedBusy,setIssuedBusy]=useState(false);
  const [reprintSelected,setReprintSelected]=useState({}),[reprintCards,setReprintCards]=useState([]);
  const [scannedQr,setScannedQr]=useState('');
  const [restoreFor,setRestoreFor]=useState(null),[restoreValue,setRestoreValue]=useState('');
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
      if(refreshWorkers){setSearchVersion(n=>n+1);setIssuedVisible(false);setReprintSelected({});setReprintCards([]);}
      if(refreshTerminals){
        const [t,c]=await Promise.all([api('/tokens/terminals'),api('/companies')]);
        setTerminals(t.terminals);setCompanies(c.companies.filter(company=>company.isActive));
      }
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  }
  async function loadIssued(offset=0){
    setIssuedBusy(true);setError('');
    try{
      const data=await api('/tokens/workers/issued?offset='+offset);
      setIssuedWorkers(old=>offset===0?data.workers:[...old,...data.workers]);
      setIssuedOffset(data.nextOffset);setIssuedMore(data.hasMore);setIssuedVisible(true);
    }catch(e){setError(e.message);}
    finally{setIssuedBusy(false);}
  }
  const printableIssued=issuedWorkers.filter(w=>w.isActive&&w.reprintable);
  function selectAllIssued(){
    setReprintCards([]);
    setReprintSelected(Object.fromEntries(printableIssued.slice(0,20).map(w=>[w.id,{id:w.id,name:w.displayName}])));
  }
  async function restoreIssued(w){
    const value=restoreValue.trim();
    await perform(async()=>{
      await api('/tokens/workers/'+w.id+'/restore-print',{method:'POST',body:JSON.stringify({scannedQr:value})});
      setIssuedWorkers(list=>list.map(row=>row.id===w.id?{...row,reprintable:true}:row));
      setRestoreFor(null);setRestoreValue('');
      onMessage?.('QR original recuperado para '+w.displayName+'. Ya puedes seleccionarlo para reimpresión.');
    });
  }
  function prepareReprint(ids){
    return perform(async()=>{
      const data=await api('/tokens/workers/batch-reprint',{method:'POST',body:JSON.stringify({employeeIds:ids})});
      setReprintCards(data.cards);
      onMessage?.(data.cards.length+' credencial(es) cargada(s). Sus QR siguen siendo los originales.');
    });
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
        setSection('workers');setActivation(null);setError('');
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
          onChange={e=>{setSearch(e.target.value);setEmployee('');setCard(null);setConfirm(null);setScannedQr('');setReprintCards([]);}}/>
      </label>
      {searchBusy&&<small>Buscando…</small>}
      {search.trim().length>=2&&!searchBusy&&workers.length===0&&<p>Sin resultados.</p>}
      {workers.length>0&&<>
        <label>Trabajador encontrado
          <select value={employee} onChange={e=>{
            setEmployee(e.target.value);setPin('');setCard(null);setConfirm(null);setScannedQr('');setReprintCards([]);
          }}>
            <option value="">Seleccionar trabajador</option>
            {workers.map(w=><option key={w.id} value={w.id}>{w.displayName}{w.isActive?'':' (inactivo)'}</option>)}
          </select>
        </label>
        <small>Máximo 30 resultados por búsqueda. Especifica más el nombre si hace falta.</small>
      </>}
      {selected&&<div className="tk-note">
        <strong>{selected.displayName}</strong>
        <p>QR: {selected.issuedAt?(selected.reprintable?'guardado y reimprimible':'emitido antes del respaldo cifrado'):'pendiente'} · PIN: {selected.pinEnabled?'habilitado':'pendiente'}</p>
        <div className="tk-buttons">
          <button type="button" disabled={busy||!selected.isActive} onClick={()=>setConfirm({type:'issue'})}>
            {selected.issuedAt?'Regenerar QR':'Emitir QR'}
          </button>
          <button type="button" disabled={busy||!selected.issuedAt} onClick={()=>setConfirm({type:'revoke'})}>Revocar QR</button>
          {selected.issuedAt&&selected.reprintable&&selected.isActive&&
            <button type="button" disabled={busy} onClick={()=>prepareReprint([selected.id])}>
              Cargar carnet existente para reimprimir
            </button>}
        </div>
        {confirm&&<div className="tk-note" role="dialog" aria-label="Confirmar credencial">
          <p>{confirm.type==='issue'?'Emitir un QR nuevo invalidará cualquier tarjeta anterior.':'La tarjeta dejará de funcionar.'}</p>
          <button type="button" onClick={()=>setConfirm(null)}>Cancelar</button>
          <button type="button" disabled={busy} onClick={()=>confirm.type==='issue'?issue():perform(async()=>{
            await api('/tokens/workers/'+employee+'/revoke',{method:'POST'});
            setCard(null);onMessage?.('QR revocado.');
          },{refreshWorkers:true})}>Confirmar</button>
        </div>}
        {selected.issuedAt&&!selected.reprintable&&selected.isActive&&<form className="tk-restore" onSubmit={e=>{
          e.preventDefault();
          perform(async()=>{
            await api('/tokens/workers/'+selected.id+'/restore-print',{method:'POST',
              body:JSON.stringify({scannedQr:scannedQr.trim()})});
            setScannedQr('');
            onMessage?.('QR original recuperado sin invalidar la tarjeta existente.');
          },{refreshWorkers:true});
        }}>
          <strong>Recuperar una tarjeta QR ya impresa</strong>
          <p>Este QR es antiguo: SAGVA guardó solo su huella. Lee con el teléfono la tarjeta original y pega aquí el contenido completo. No se emitirá un código nuevo.</p>
          <label>Texto leído del QR original
            <input type="password" value={scannedQr} autoComplete="off"
              onChange={e=>setScannedQr(e.target.value)} placeholder="asistencia:at_…"/>
          </label>
          <button disabled={busy||!/^((asistencia:)?at_[A-Za-z0-9_-]{43})$/.test(scannedQr.trim())}>Vincular QR original para reimprimir</button>
        </form>}
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
        <p>El QR queda guardado cifrado en la ficha. Podrás reimprimir este mismo código más adelante, desde otra sesión autorizada.</p>
        <a href={card.qrDataUrl} download="tarjeta-asistencia.png">Guardar QR</a>
        <button type="button" onClick={()=>printQrCard(card).catch(e=>setError(e.message))}>Imprimir credencial RED TAURUS · carta</button>
        <button type="button" onClick={()=>setCard(null)}>Cerrar tarjeta</button>
      </div>}

      <section className="tk-bulk" aria-label="Credenciales ya emitidas y reimpresión">
        <h3>Reimprimir carnets existentes</h3>
        <p>Selecciona los trabajadores que ya tienen QR. Se imprime el mismo código, sin emitir ni revocar credenciales.
          Una sola plantilla general RED TAURUS para todos.</p>
        <div className="tk-buttons">
          <button type="button" disabled={busy||issuedBusy} onClick={()=>{
            if(issuedVisible){setIssuedVisible(false);setReprintSelected({});setReprintCards([]);}
            else void loadIssued(0);
          }}>{issuedVisible?'Ocultar credenciales':'Ver credenciales creadas'}</button>
        </div>
        {issuedBusy&&<small>Cargando credenciales…</small>}
        {issuedVisible&&<>
          {issuedWorkers.length===0&&<p>Aún no hay QR activos para listar.</p>}
          {issuedWorkers.length>0&&<div className="tk-buttons">
            <button type="button" disabled={busy||!printableIssued.length} onClick={selectAllIssued}>Seleccionar todos los recuperables (máximo 20)</button>
            <button type="button" disabled={busy||issuedBusy} onClick={()=>loadIssued(0)}>Actualizar listado</button>
          </div>}
          <div className="tk-bulk-choices" role="group" aria-label="Seleccionar QR para reimprimir">
            {issuedWorkers.map(w=><label key={w.id}>
              <input type="checkbox" disabled={busy||!w.isActive||!w.reprintable||(!reprintSelected[w.id]&&Object.keys(reprintSelected).length>=20)}
                checked={!!reprintSelected[w.id]}
                onChange={e=>{
                  setReprintCards([]);
                  setReprintSelected(old=>{
                    const next={...old};if(e.target.checked)next[w.id]={id:w.id,name:w.displayName};
                    else delete next[w.id];return next;
                  });
                }}/>
              <span className="tk-issued-info"><strong>{w.displayName}</strong><small>{w.isActive?(w.reprintable?'QR guardado, listo para imprimir':'QR antiguo: pendiente de vincular desde la tarjeta'):'Trabajador inactivo'}</small>
                {w.isActive&&!w.reprintable&&<button type="button" className="tk-restore-trigger" disabled={busy} onClick={e=>{e.preventDefault();setRestoreFor(w.id);setRestoreValue('');}}>Recuperar QR original</button>}
              </span>
            </label>)}
          </div>
          {restoreFor!==null&&<form className="tk-restore tk-restore-inline" onSubmit={e=>{e.preventDefault();const w=issuedWorkers.find(x=>x.id===restoreFor);if(w)void restoreIssued(w);}}>
            <strong>Recuperar QR de {issuedWorkers.find(w=>w.id===restoreFor)?.displayName}</strong>
            <p>Escanea la tarjeta original y pega aquí su contenido completo. Solo se vincula al trabajador seleccionado: no se genera ni revoca ningún código.</p>
            <input type="password" autoComplete="off" aria-label="Contenido del QR original" value={restoreValue} onChange={e=>setRestoreValue(e.target.value)} placeholder="asistencia:at_…" />
            <div className="tk-buttons"><button disabled={busy||!/^((asistencia:)?at_[A-Za-z0-9_-]{43})$/.test(restoreValue.trim())}>Vincular QR sin regenerar</button><button type="button" onClick={()=>{setRestoreFor(null);setRestoreValue('');}}>Cancelar</button></div>
          </form>}
          {issuedMore&&<button type="button" disabled={issuedBusy||busy} onClick={()=>loadIssued(issuedOffset)}>Mostrar más trabajadores</button>}
          <p>Seleccionados: {Object.keys(reprintSelected).length} / 20. Máximo 4 carnets plegables por hoja carta. Los QR antiguos solo se vinculan una vez; luego quedan guardados para futuras impresiones.</p>
          <div className="tk-buttons">
            <button type="button" disabled={busy||!Object.keys(reprintSelected).length}
              onClick={()=>prepareReprint(Object.keys(reprintSelected).map(Number))}>Cargar selección para imprimir</button>
            <button type="button" disabled={busy} onClick={()=>{setReprintSelected({});setReprintCards([]);}}>Limpiar selección</button>
          </div>
        </>}
      </section>
      {reprintCards.length>0&&<div className="tk-note" role="region" aria-label="Imprimir carnets guardados">
        <strong>{reprintCards.length} credencial(es) originales listas para impresión</strong>
        <p>{reprintCards.map(c=>c.name).join(', ')} · {Math.ceil(reprintCards.length/4)} hoja(s).
          Reimprimir no cambia el QR del trabajador.</p>
        <button type="button" onClick={()=>printQrCards(reprintCards).catch(e=>setError(e.message))}>Imprimir selección / Guardar PDF</button>
        <button type="button" onClick={()=>setReprintCards([])}>Cerrar vista segura</button>
      </div>}
      {canBulk&&<section className="tk-bulk">
        <h3>Credenciales plegables RED TAURUS · hoja carta</h3>
        <p>Esta sección es para emitir QR nuevos. Para imprimir los existentes utiliza «Reimprimir carnets existentes».
          Emitir un QR nuevo para reemplazar otro exige confirmación específica.</p>
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
        <p>Seleccionados: {count} / 20 · {count ? Math.ceil(count / 4) : 0} hoja(s) carta. Máximo 4 credenciales por hoja, cada una con dos caras idénticas de 54 × 85 mm y QR de 28 × 28 mm.</p>
        {count>0&&<div className="tk-buttons">
          <button type="button" disabled={busy} onClick={()=>setBatchConfirm(true)}>Emitir {count} QR nuevos</button>
          <button type="button" disabled={busy} onClick={()=>{setBatchSelected({});setBatchConfirm(false);}}>Limpiar selección</button>
        </div>}
        {batchConfirm&&<div className="tk-note" role="dialog" aria-label="Confirmar impresión múltiple">
          <p>Se generarán {count} credenciales nuevas y se guardarán sus códigos cifrados, asociados a cada trabajador.
            Podrás volver a imprimirlas sin regenerarlas.</p>
          <button type="button" disabled={busy} onClick={()=>setBatchConfirm(false)}>Cancelar</button>
          <button type="button" disabled={busy||count===0} onClick={issueBatch}>Confirmar emisión</button>
        </div>}
        {batchCards.length>0&&<div className="tk-note">
          <strong>{batchCards.length} tarjetas nuevas generadas</strong>
          <p>Formato RED TAURUS: 54 × 85 mm por cara, plegable de 108 × 85 mm. {Math.ceil(batchCards.length / 4)} hoja(s) carta. Estos QR quedaron guardados cifrados y podrán reimprimirse después. Imprimir a tamaño real (100 %, sin ajustar).</p>
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
        setActivation({code:r.activationCode,qrDataUrl:r.activationQrDataUrl});setName('');
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
      {activation&&<div className="tk-note tk-activation-secret" role="region" aria-label="Código y QR de activación">
        <strong>Activar equipo con código o QR</strong>
        <p>Ambos permiten activar el mismo equipo, una sola vez. Vencen en 10 minutos. No compartas este QR públicamente.</p>
        {activation.qrDataUrl&&<img className="tk-activation-qr" src={activation.qrDataUrl} alt="QR temporal para activar este equipo"/>}
        <label>Código para ingresar manualmente
          <code className="tk-secret">{activation.code}</code>
        </label>
        <button type="button" onClick={()=>setActivation(null)}>Ocultar código y QR</button>
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
                if(result.activationCode)setActivation({code:result.activationCode,qrDataUrl:result.activationQrDataUrl});
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
