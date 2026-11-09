import DateField from './DateField.jsx';
import React, { useEffect, useState } from 'react';
import { api } from './services/api.js';
import './employeeDocuments.css';
import MonthField from './MonthField.jsx';
import {calculateApprovedSalary} from '../../shared/salaryAnnex.js';

const localDate = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const newEntry = () => {const today=localDate();return {deliveredOn:today,startOn:today,expiresOn:'',expiryMode:'DEFAULT',agreedAmount:'',amountMeaning:'',retroactive:false,retroactiveAmount:'',retroactiveMonths:[],retroactiveMonth:'',versionLabel:'',notes:''};};
const periodNames = { DAYS: 'días', WEEKS: 'semanas', MONTHS: 'meses', YEARS: 'años' };
const modes = {
  NONE: 'Sin vencimiento',
  PERIOD: 'Vencimiento automático',
  MANUAL: 'Vencimiento manual',
  EVENT: 'Nueva entrega al cambiar el documento'
};
const readable = date => date ? date.split('-').reverse().join('/') : '—';

function previewExpiry(start, count, unit) {
  if (!start || !Number.isInteger(Number(count)) || Number(count) < 1) return '';
  const [year, month, day] = start.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (unit === 'DAYS' || unit === 'WEEKS') date.setUTCDate(date.getUTCDate() + Number(count) * (unit === 'WEEKS' ? 7 : 1));
  else {
    const offset = Number(count) * (unit === 'YEARS' ? 12 : 1);
    const t = year * 12 + month - 1 + offset;
    const y = Math.floor(t / 12), m = t % 12;
    date.setTime(Date.UTC(y, m, Math.min(day, new Date(Date.UTC(y, m + 1, 0)).getUTCDate())));
  }
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}
function entryStatus(entry) {
  if (entry.expiresOn && entry.expiresOn < localDate()) return { text: 'Vencido', kind: 'danger' };
  if (!entry.attachments?.length) return { text: 'Sin documento adjunto', kind: 'danger' };
  if (!entry.attachments.some(a => a.signedPhysical)) return { text: 'Firma pendiente de confirmar', kind: 'warning' };
  return { text: 'Respaldo firmado registrado', kind: 'success' };
}

export default function EmployeeDocuments({ employeeId, hasUnsavedChanges = false, role, onMessage, onDirtyChange, onSalaryApplied }) {
  const [types, setTypes] = useState([]);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [entryDraft, setEntryDraft] = useState(newEntry);
  const [uploads, setUploads] = useState({});
  const [startEdited,setStartEdited]=useState(false);
  const [currentSalary,setCurrentSalary]=useState(null);
  const canApprove=['admin','supervisor'].includes(role);
  const hasLocalDraft=editing!==null||Object.values(uploads).some(upload=>Boolean(upload?.file));
  useEffect(()=>{onDirtyChange?.(hasLocalDraft);},[hasLocalDraft,onDirtyChange]);
  useEffect(()=>()=>onDirtyChange?.(false),[onDirtyChange]);
  async function reloadSalary(){
    if(!canApprove)return;
    const result=await api('/contract-terms/workers/'+employeeId);
    const value=result.terms?.monthlyBaseSalary;
    setCurrentSalary(Number.isSafeInteger(value)&&value>0?value:null);
  }
  useEffect(()=>{
    if(!employeeId||!canApprove){setCurrentSalary(null);return;}
    let active=true;
    api('/contract-terms/workers/'+employeeId).then(result=>{
      if(active){const value=result.terms?.monthlyBaseSalary;setCurrentSalary(Number.isSafeInteger(value)&&value>0?value:null);}
    }).catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[employeeId,role]);

  async function reload() {
    const [catalog, history] = await Promise.all([
      api('/employee-documents/types?workerId=' + employeeId),
      api('/employee-documents/workers/' + employeeId)
    ]);
    setTypes(catalog.types);
    setEntries(history.entries);
  }
  useEffect(() => {
    if (!employeeId) return;
    let active = true;
    Promise.all([
      api('/employee-documents/types?workerId=' + employeeId),
      api('/employee-documents/workers/' + employeeId)
    ]).then(([catalog, history]) => {
      if (!active) return;
      setTypes(catalog.types);
      setEntries(history.entries);
      setError('');
    }).catch(err => { if (active) setError(err.message); });
    setEditing(null);
    setUploads({});
    return () => { active = false; };
  }, [employeeId]);
  useEffect(() => {
    if (!employeeId) return;
    const onChanged = () => reload().catch(e => setError(e.message));
    window.addEventListener('attendance:document-catalog-changed', onChanged);
    return () => window.removeEventListener('attendance:document-catalog-changed', onChanged);
  }, [employeeId]);

  const changeEntry = (key, value) => {
    if(key==='startOn')setStartEdited(true);
    setEntryDraft(old => key==='deliveredOn'
      ? {...old,deliveredOn:value,...(!startEdited?{startOn:value}:{})}
      : {...old,[key]:value});
  };
  async function addEntry(type) {
    if (hasUnsavedChanges) return setError('Guarda primero los cambios de la ficha.');
    setBusy(true);
    setError('');
    try {
      await api('/employee-documents/workers/' + employeeId + '/entries', {
        method: 'POST',
        body: JSON.stringify({ ...entryDraft, typeId: type.id, agreedAmount:type.financialKind?Number(entryDraft.agreedAmount):null, amountMeaning:type.financialKind==='SALARY_INCREASE'?entryDraft.amountMeaning:type.financialKind==='BONUS'?'BONUS':null, versionLabel:type.financialKind==='SALARY_INCREASE'?null:entryDraft.versionLabel, retroactive:type.financialKind==='SALARY_INCREASE'&&entryDraft.retroactive, retroactiveAmount:type.financialKind==='SALARY_INCREASE'&&entryDraft.retroactive?Number(entryDraft.retroactiveAmount):null, retroactiveMonths:type.financialKind==='SALARY_INCREASE'&&entryDraft.retroactive?entryDraft.retroactiveMonths:[] })
      });
      await reload();
      setEditing(null);
      setEntryDraft(newEntry());
      setStartEdited(false);
      onMessage?.('Entrega o renovación registrada. Ahora puedes adjuntar el PDF.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function approveSalary(entry){
    if(hasUnsavedChanges||hasLocalDraft)return setError('Guarda o cancela los otros cambios pendientes antes de aprobar el sueldo.');
    setBusy(true);setError('');
    try{
      const result=await api('/employee-documents/entries/'+entry.id+'/approve-salary',{method:'POST'});
      try{await Promise.all([reload(),reloadSalary()]);}
      catch(refreshError){setError('Sueldo aplicado pero no se pudo refrescar la ficha: '+refreshError.message);}
      onSalaryApplied?.();
      onMessage?.(result.message);
    }catch(err){setError(err.message);}finally{setBusy(false);}
  }
  const uploadChange = (id, key, value) => setUploads(old => ({
    ...old, [id]: { ...old[id], [key]: value }
  }));
  async function uploadFile(entry) {
    if (hasUnsavedChanges) return setError('Guarda primero los cambios de la ficha.');
    const chosen = uploads[entry.id] || {};
    if (!chosen.file) return setError('Selecciona el PDF que deseas respaldar.');
    if (!chosen.file.name.toLowerCase().endsWith('.pdf') || chosen.file.size > 8 * 1024 * 1024)
      return setError('Selecciona un archivo PDF de hasta 8 MB.');
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/employee-documents/entries/' + entry.id + '/pdf', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + (localStorage.getItem('token') || ''),
          'Content-Type': 'application/pdf',
          'X-Documento-Firmado': chosen.signed ? 'si' : 'no',
          ...(chosen.signed ? { 'X-Fecha-Firma': chosen.signedOn || localDate() } : {})
        },
        body: chosen.file
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'No se pudo guardar el PDF.');
      await reload();
      setUploads(old => { const next = { ...old }; delete next[entry.id]; return next; });
      onMessage?.('PDF guardado en el historial del trabajador.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function downloadFile(id) {
    setError('');
    try {
      const response = await fetch('/api/employee-documents/attachments/' + id + '/pdf', {
        headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') }
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || 'No se pudo abrir el respaldo.');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'documento-laboral-' + id + '.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) {
      setError(err.message);
    }
  }
  if (!employeeId) return <fieldset className="ef-section"><legend>Documentos laborales</legend><p>Guarda primero la ficha para registrar sus documentos.</p></fieldset>;
  return (
    <fieldset className="ef-section ed-section">
      <legend>Documentos laborales</legend>
      <p>Los documentos se configuran en Administración → Documentos. Aquí se registran entregas y renovaciones sin borrar el historial. Cada entrega puede tener su propia fecha de vencimiento manual.</p>
      <p className="ef-note">Para prorrogar un contrato: Ficha general → Datos laborales → PLAZO FIJO → ¿Tiene anexos? Sí. Para respaldar otro anexo en PDF, crea su tipo en Administración → Documentos y registra aquí la entrega con sus fechas.</p>
      {hasUnsavedChanges && <p className="ef-note">Guarda los cambios pendientes de la ficha antes de registrar documentos o adjuntar archivos.</p>}
      {error && <p className="ef-note" role="alert">{error}</p>}
      {!types.length && <p>No hay documentos configurados.</p>}
      {types.map(type => {
        const history = entries.filter(entry => entry.typeId === type.id);
        const latest = history[0];
        const status = latest ? entryStatus(latest) : { text: 'Sin registro', kind: 'muted' };
        const canRecordAmount=!type.financialKind || ['admin','supervisor'].includes(role);
        const isEditing = editing === type.id;
        const expiryMode = entryDraft.expiryMode === 'MANUAL' ? 'MANUAL' : type.expiryMode;
        return (
          <details key={type.id} className="ed-document">
            <summary><strong>{type.name}</strong><span className={'ed-status ed-' + status.kind}>{status.text}</span></summary>
            <p>{modes[type.expiryMode]}{type.expiryMode === 'PERIOD' ? ' · cada ' + type.periodValue + ' ' + periodNames[type.periodUnit] : ''}</p>
            {!canRecordAmount && <p className="ed-footnote">Los montos de estos anexos se registran desde Administración o Supervisión.</p>}
            {!type.canRegister && <p className="ed-footnote">No se admiten nuevas entregas para este documento; su historial permanece disponible.</p>}
            <div className="ed-bar">
              <span>{history.length ? history.length + ' entrega(s) y renovación(es)' : '¿Tiene este documento? No registrado'}</span>
              <button type="button" disabled={busy || hasUnsavedChanges || (!type.canRegister || !canRecordAmount)} onClick={() => {
                setEditing(isEditing ? null : type.id);
                setStartEdited(false);
                setEntryDraft(newEntry());
              }}>{isEditing ? 'Cancelar' : history.length ? 'Registrar renovación / nueva entrega' : 'Sí, registrar entrega'}</button>
            </div>
            {isEditing && (
              <div className="ed-panel ed-grid">
                <label>Vigencia de esta entrega / renovación
                  <select value={entryDraft.expiryMode} onChange={e => setEntryDraft(old => ({...old, expiryMode:e.target.value, expiresOn:''}))}>
                    <option value="DEFAULT">Usar configuración del documento</option>
                    <option value="MANUAL">Definir fecha de vencimiento manual</option>
                  </select>
                </label>
                <label>Fecha de entrega<DateField  value={entryDraft.deliveredOn} onChange={e => changeEntry('deliveredOn', e.target.value)} /></label>
                {(type.financialKind || ['PERIOD', 'MANUAL'].includes(expiryMode)) && <label>Fecha de inicio<DateField  value={entryDraft.startOn} onChange={e => changeEntry('startOn', e.target.value)} /></label>}
                {expiryMode === 'PERIOD' && <label>Vencimiento calculado
                  <DateField  disabled value={previewExpiry(entryDraft.startOn, type.periodValue, type.periodUnit)} />
                </label>}
                {expiryMode === 'MANUAL' && <label>Fecha de vencimiento<DateField  value={entryDraft.expiresOn} onChange={e => changeEntry('expiresOn', e.target.value)} /></label>}
                {expiryMode === 'EVENT' && type.financialKind!=='SALARY_INCREASE' && <label>Versión del documento<input value={entryDraft.versionLabel} onChange={e => changeEntry('versionLabel', e.target.value)} placeholder="Ej. Reglamento 2026-02" /></label>}
                {type.financialKind==='SALARY_INCREASE' && <label>El monto corresponde a<select value={entryDraft.amountMeaning} onChange={e=>changeEntry('amountMeaning',e.target.value)}>
                  <option value="">Seleccionar</option><option value="NEW_BASE">Nuevo sueldo base</option><option value="INCREASE">Monto del aumento</option>
                </select></label>}
                {!!type.financialKind && <label>{type.financialKind==='BONUS'?'Monto del bono acordado':'Monto acordado'} (CLP)<input type="number" min="1" max="1000000000000" step="1" value={entryDraft.agreedAmount} onChange={e=>changeEntry('agreedAmount',e.target.value)} placeholder="Monto en pesos, sin puntos" /></label>}
                {type.financialKind==='SALARY_INCREASE' && <>
                  <label>¿Tiene retroactivo?<select value={entryDraft.retroactive?'SI':'NO'} onChange={e=>setEntryDraft(old=>({...old,retroactive:e.target.value==='SI',retroactiveAmount:'',retroactiveMonths:[],retroactiveMonth:''}))}><option value="NO">No</option><option value="SI">Sí</option></select></label>
                  {entryDraft.retroactive && <>
                    <label>Monto total del retroactivo (CLP)<input type="number" min="1" max="1000000000000" step="1" value={entryDraft.retroactiveAmount} onChange={e=>changeEntry('retroactiveAmount',e.target.value)} /></label>
                    <div className="ed-full"><label>Mes del retroactivo<MonthField value={entryDraft.retroactiveMonth} onChange={e=>changeEntry('retroactiveMonth',e.target.value)} /></label>
                      <button type="button" disabled={!entryDraft.retroactiveMonth || entryDraft.retroactiveMonths.includes(entryDraft.retroactiveMonth) || entryDraft.retroactiveMonths.length>=120} onClick={()=>setEntryDraft(old=>({...old,retroactiveMonths:[...old.retroactiveMonths,old.retroactiveMonth].sort(),retroactiveMonth:''}))}>Agregar mes</button>
                      <p>Agrega cada mes al que corresponde el monto total, aunque no sean consecutivos.</p>
                      {entryDraft.retroactiveMonths.map(month=><span key={month}>{month.slice(5)+'/'+month.slice(0,4)} <button type="button" onClick={()=>changeEntry('retroactiveMonths',entryDraft.retroactiveMonths.filter(value=>value!==month))}>Quitar mes</button> </span>)}
                    </div>
                  </>}
                </>}
                <label className="ed-full">Observaciones (opcional)<input value={entryDraft.notes} onChange={e => changeEntry('notes', e.target.value)} /></label>
                <div className="ed-full"><button type="button" className="primary" disabled={busy || hasUnsavedChanges || !entryDraft.deliveredOn || (['PERIOD', 'MANUAL'].includes(expiryMode) && !entryDraft.startOn) || (expiryMode === 'MANUAL' && !entryDraft.expiresOn) || (type.financialKind && (!entryDraft.startOn || !Number.isSafeInteger(Number(entryDraft.agreedAmount)) || Number(entryDraft.agreedAmount)<=0 || Number(entryDraft.agreedAmount)>1000000000000 || !canRecordAmount)) || (type.financialKind==='SALARY_INCREASE' && (!entryDraft.amountMeaning || (entryDraft.retroactive && (!Number.isSafeInteger(Number(entryDraft.retroactiveAmount)) || Number(entryDraft.retroactiveAmount)<=0 || Number(entryDraft.retroactiveAmount)>1000000000000 || !entryDraft.retroactiveMonths.length))))} onClick={() => addEntry(type)}>Guardar entrega / renovación</button></div>
              </div>
            )}
            {history.map((entry, index) => {
              const entryState = entryStatus(entry);
              const upload = uploads[entry.id] || {};
              return (
                <div key={entry.id} className="ed-record">
                  <div className="ed-bar"><strong>{index === 0 ? 'Registro más reciente' : 'Registro histórico'} · {readable(entry.deliveredOn)}</strong><span className={'ed-status ed-' + entryState.kind}>{entryState.text}</span></div>
                  <div className="ed-dates">
                    <span>{modes[entry.expiryMode]}</span>
                    {entry.startOn && <span>Inicio: {readable(entry.startOn)}</span>}
                    {entry.expiresOn && <span>Vencimiento: {readable(entry.expiresOn)}</span>}
                    {entry.agreedAmount!=null && <span>{entry.amountMeaning==='NEW_BASE'?'Nuevo sueldo base':entry.amountMeaning==='INCREASE'?'Monto del aumento':'Bono'}: {new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP'}).format(entry.agreedAmount)}</span>}
                    {entry.financialKind && entry.agreedAmount==null && ['admin','supervisor'].includes(role) && <span>Monto no registrado en este documento histórico</span>}
                    {entry.retroactive!=null && <span>Retroactivo: {entry.retroactive?'Sí':'No'}</span>}
                    {entry.retroactiveAmount!=null && <span>Total retroactivo: {new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP'}).format(entry.retroactiveAmount)}</span>}
                    {!!entry.retroactiveMonths?.length && <span>Meses: {entry.retroactiveMonths.map(month=>month.slice(5)+'/'+month.slice(0,4)).join(', ')}</span>}
                    {entry.versionLabel && entry.financialKind!=='SALARY_INCREASE' && type.financialKind!=='SALARY_INCREASE' && <span>Versión: {entry.versionLabel}</span>}
                  </div>
                  {!entry.attachments.length && <p className="ed-status ed-danger" role="status">No hay PDF relacionado con esta entrega o renovación.</p>}
                  {entry.documentName !== type.name && <p>Nombre original de esta entrega: <strong>{entry.documentName}</strong></p>}
                  {entry.notes && <p>{entry.notes}</p>}
                  {entry.attachments.map(file => (
                    <div className="ed-bar" key={file.id}>
                      <span>PDF · {file.signedPhysical ? 'Firma física declarada' : 'Firma no confirmada'} · {file.uploadedAt}</span>
                      <button type="button" onClick={() => downloadFile(file.id)}>Descargar PDF</button>
                    </div>
                  ))}
                  <div className="ed-upload">
                    <label>Adjuntar respaldo PDF (máx. 8 MB)<input type="file" accept=".pdf,application/pdf" disabled={busy || hasUnsavedChanges}
                      onChange={e => uploadChange(entry.id, 'file', e.target.files?.[0] || null)} /></label>
                    <label className="ed-checkbox"><input type="checkbox" checked={!!upload.signed} disabled={busy || hasUnsavedChanges}
                      onChange={e => uploadChange(entry.id, 'signed', e.target.checked)} /> Confirmo que el PDF está firmado físicamente</label>
                    {upload.signed && <label>Fecha de firma<DateField  value={upload.signedOn || localDate()}
                      onChange={e => uploadChange(entry.id, 'signedOn', e.target.value)} /></label>}
                    <button type="button" disabled={busy || hasUnsavedChanges || !upload.file} onClick={() => uploadFile(entry)}>Guardar PDF</button>
                  </div>
                </div>
              );
            })}
          </details>
        );
      })}
      <p className="ed-footnote">El envío por correo y la firma digital están reservados para una etapa posterior, cuando se incorporen las plantillas. Ahora puedes registrar entregas y adjuntar PDF de firmas físicas.</p>
    </fieldset>
  );
}
