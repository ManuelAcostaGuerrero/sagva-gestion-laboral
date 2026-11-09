import DateField from './DateField.jsx';
import React, { useEffect, useRef, useState } from "react";
import { api } from "./services/api.js";
import "./employeeFile.css";
import EmployeeDocuments from "./EmployeeDocuments.jsx";
import ContractFiles from "./ContractFiles.jsx";
import MedicalLeaves from "./MedicalLeaves.jsx";
import MedicalProfile from "./MedicalProfile.jsx";
import TerritoryFields from './TerritoryFields.jsx';
import {matchesEmployeeSearch} from './employeeSearch.js';
import PhoneField from "./PhoneField.jsx";
import ContractTerms from "./ContractTerms.jsx";
import {assembledWorkerName,normalizeLabel,workerNumberFromRut,completeFileMissing,SEX_OPTIONS,CIVIL_STATUS_OPTIONS,NATIONALITIES} from "../../server/src/workerFileStandards.js";
import {checkRut,formatRut} from '../../server/src/rut.js';
import {currentContractEnd, validContractDate} from '../../server/src/employeeContracts.js';
import {pendingFileSections, canCloseAfterSuccessfulSave, showReviewAction} from './employeeFileReview.js';
import {saveEmployeeSections} from './saveEmployeeSections.js';

const fresh = () => ({
  fullName: "",
  legalFullName: "",
  firstName: "",
  secondName: "",
  otherNames: "",
  firstLastName: "",
  secondLastName: "",
  validationNotes: "",
  clearFields: [],
  documentId: "",
  email: "",
  positionName: "",
  companyId: null,
  workAreaId: "",
  validationStatus: "NO_VALIDADO",
  company: "",
  workSchedule: "",
  hireDate: "",
  terminationDate: "",
  contractType: "",
  annexes: [],
  hasAnnexes: false,
  employmentStatus: "ACTIVO",
  terminationReason: "",
  birthDate: "",
  address: "",
  phone: "",
  mobile: "",
  observations: "",
  extra: {},
});
const fields = [
  ["fullName", "Nombre completo"],
  ["firstName", "Primer nombre"],
  ["secondName", "Segundo nombre"],
  ["otherNames", "Otros nombres"],
  ["firstLastName", "Primer apellido"],
  ["secondLastName", "Segundo apellido"],
  ["documentId", "RUT / documento"],
  ["email", "Correo personal"],
  ["address", "Dirección"],
  ["phone", "Teléfono"],
  ["mobile", "Celular"],
  ["birthDate", "Nacimiento"],
];
const extras = [
  ["workerNumber", "N.º de trabajador"],
  ["temporaryDocument", "Documento temporal"],
  ["sex", "Sexo"],
  ["nationality", "Nacionalidad"],
  ["hierarchyUnit", "Unidad jerárquica"],
  ["costCenter", "Centro de costo"],
  ["branch", "Sucursal"],
];
export default function EmployeeFile({ areas, positions = [], onSaved, onMessage, workerNavigation, onWorkerNavigationHandled, active = true }) {
  const [files, setFiles] = useState([]),
    [counts, setCounts] = useState({ all: 0, pending: 0, validated: 0 });
  const [filter, setFilter] = useState("ALL"),
    [search, setSearch] = useState(""),
    [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [next, setNext] = useState(null);
  const [tab,setTab]=useState('general');
  const [medicalDirty,setMedicalDirty]=useState(false);
  const medicalRef = useRef(null);
  const contractRef = useRef(null);
  const [contractDirty,setContractDirty]=useState(false);
  const [documentsDirty,setDocumentsDirty]=useState(false);
  const [contractReload,setContractReload]=useState(0);
  const [role,setRole]=useState(null);
  const [companies,setCompanies]=useState([]);
  const dirty = Boolean(draft) && JSON.stringify(draft) !== saved;
  const pendingSections = pendingFileSections({general:dirty, medical:medicalDirty, contract:contractDirty, documents:documentsDirty});
  const showContractDetails = ['INDEFINIDO', 'PLAZO_FIJO'].includes(draft?.contractType);
  async function load() {
    const result = await api("/employee-files");
    setFiles(result.files);
    setCounts(result.counts);
    return result;
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
    api('/auth/me').then(result=>setRole(result.admin?.role||null)).catch(()=>setRole(null));
  }, []);
  useEffect(() => {
    if(!active)return;
    let current=true;
    api('/companies').then(result=>{if(current)setCompanies(result.companies||[]);}).catch(e=>{if(current)setError(e.message);});
    return ()=>{current=false;};
  },[active]);
  useEffect(() => {
    if (!dirty && !medicalDirty && !contractDirty && !documentsDirty) return;
    const guard = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty,medicalDirty,contractDirty,documentsDirty]);
  const open = (file) => {
    if (file?.id && file.id === draft?.id) return;
    if (pendingSections.length) {
      setNext(file);
      return;
    }
    select(file);
  };
  const select = (file) => {
    if (file.id !== draft?.id) {setMedicalDirty(false);setContractDirty(false);setDocumentsDirty(false);}
    const value = structuredClone(file);
    value.hasAnnexes = !!value.annexes?.length;
    value.employmentStatus ||= value.isActive === 0 ? "INACTIVO" : "ACTIVO";
    setDraft(value);
    setSaved(JSON.stringify(value));
    setError("");
    setNext(null);
    setTab("general");
  };
  // Si el usuario ya había solicitado otro trabajador, continuar solo cuando
  // se hayan guardado TODAS las secciones pendientes; nunca descartar datos.
  useEffect(() => {
    if (!next || busy || pendingSections.length > 0) return;
    select(next);
  }, [next, busy, dirty, medicalDirty, contractDirty, documentsDirty]);
  useEffect(() => {
    if (!workerNavigation?.id) return;
    const target = files.find(file => Number(file.id) === Number(workerNavigation.id));
    if (!target) return;
    setFilter('ALL');
    setSearch('');
    open(target); // El aviso de cambios pendientes sigue protegiendo ediciones sin guardar.
    onWorkerNavigationHandled?.();
  }, [workerNavigation?.id, workerNavigation?.seq, files]);
  const nameKeys=['firstName','secondName','otherNames','firstLastName','secondLastName'];
  const change = (key, value) => setDraft(current => {
    const next={...current,[key]:key==='address'?value.toLocaleUpperCase('es-CL'):nameKeys.includes(key)||['fullName','email','company','terminationReason'].includes(key)?normalizeLabel(value):value};
    if(nameKeys.includes(key)){
      const assembled=assembledWorkerName(next);
      if(assembled)next.fullName=assembled;
      if(!current.id && assembled)next.legalFullName=assembled;
    }
    return next;
  });
  function chooseCompany(raw){
    const company=companies.find(c=>c.id===Number(raw));
    if (!company || (!company.isActive && Number(draft?.companyId)!==company.id)) return;
    setDraft(current=>({...current,
      companyId:company?.id||null,company:company?.legalName||current.company||'',
      workAreaId:current.workAreaId||company?.defaultAreaId||'',
      positionName:current.positionName||company?.defaultPositionName||'',
      workSchedule:current.workSchedule||company?.defaultSchedule||'',
      extra:{...current.extra,branch:Number(current.companyId)!==company.id ? company.defaultBranch||'' : current.extra?.branch||company.defaultBranch||''}
    }));
  }
  async function save(event,complete=false) {
    event?.preventDefault();
    if (!draft || busy) return;
    if(documentsDirty){setError('Termina o cancela el documento laboral en preparación antes de cerrar la ficha.');return;}
    setBusy(true);
    setError('');
    let resultFile = null;
    let generalSaved = false;
    try {
      const completed = await saveEmployeeSections({
        needsCreation: !draft.id,
        generalDirty: dirty,
        medicalDirty: medicalDirty || Boolean(medicalRef.current?.isDirty()),
        contractDirty: contractDirty || Boolean(contractRef.current?.isDirty()),
        completing: complete,
        saveGeneral: async () => {
          const result = await api(
            `/employee-files${draft.id ? `/${draft.id}` : ''}`,
            {method: draft.id ? 'PUT' : 'POST',
              body: JSON.stringify({...draft,completeProfile:complete,validationStatus:complete?'VALIDADO':draft.validationStatus})}
          );
          resultFile = result.file;
          generalSaved = true;
          const value = structuredClone(result.file);
          value.hasAnnexes = !!value.annexes?.length;
          value.employmentStatus ||= value.isActive === 0 ? 'INACTIVO' : 'ACTIVO';
          // No usar select(): cambia de pestaña y destruye el estado de edición.
          setDraft(value);
          setSaved(JSON.stringify(value));
        },
        saveMedical: () => {
          if (!medicalRef.current) throw new Error('La pestaña médica aún no está preparada.');
          return medicalRef.current.saveChanges();
        },
        saveContract: () => {
          if (!contractRef.current) throw new Error('Las condiciones contractuales aún no están preparadas.');
          return contractRef.current.saveChanges();
        }
      });
      const closed = canCloseAfterSuccessfulSave({savedSections:completed,documents:documentsDirty});
      if (closed) {
        if (next) select(next);
        else {
          setDraft(null);
          setSaved('');
          setNext(null);
          setTab('general');
        }
      } else if (next) {
        select(next);
      }
      if (generalSaved) {
        try {
          await load();
          await onSaved?.();
        } catch (refreshError) {
          setError('Datos guardados, pero no se pudo refrescar la lista: '+refreshError.message);
        }
      }
      onMessage?.(closed ? 'Cambios guardados. Ficha cerrada correctamente.'
        : completed.length ? 'Cambios guardados: '+completed.join(', ')+'.'
        : 'La ficha ya está guardada, sin cambios pendientes.');
    } catch (e) {
      // Si el primer módulo se guardó, no volverlo a guardar al reintentar.
      // Los módulos restantes conservan sus borradores, sin cerrar la ficha.
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const changeAnnex = (index,key,value) => setDraft(current => ({...current,annexes:current.annexes.map((a,i) => i === index ? {...a,[key]:value} : a)}));
  const renderClear = key => draft.id && !draft[key] && JSON.parse(saved || '{}')[key] && !['fullName','legalFullName','documentId'].includes(key) && (
    <span className="ef-clear-field"><input type="checkbox" checked={(draft.clearFields || []).includes(key)}
      onChange={e => change('clearFields',e.target.checked ? [...(draft.clearFields || []),key] : (draft.clearFields || []).filter(k => k !== key))} /> Confirmar vaciado de este campo</span>
  );
  const renderField = (key,label) => <label key={key} className={['fullName','legalFullName','address','terminationReason'].includes(key) ? 'ef-field-wide' : undefined}>
    {label}{key.endsWith('Date') ? (
      <DateField value={draft[key] || ''} onChange={e => change(key,e.target.value)} />
    ) : (
      <input type="text" value={key==='fullName' ? (assembledWorkerName(draft)||draft.fullName||'') : key==='documentId' ? formatRut(draft[key]) : draft[key] || ''}
        className={key==='fullName'?'ef-readonly':''}
        readOnly={key==='fullName'} tabIndex={key==='fullName'?-1:undefined}
        onChange={key==='fullName'?undefined:e => change(key,e.target.value)} />
    )}
    {key==='documentId' && <span role="status">{checkRut(draft.documentId).valid ? 'RUT válido · dígito verificador correcto' : draft.documentId ? 'RUT inválido · revisa las cifras y el dígito verificador' : 'RUT pendiente'}</span>}
    {renderClear(key)}
  </label>;
  const renderExtra = ([key,label]) => <label key={key}>{label}<input value={draft.extra?.[key] || ''} onChange={e => change('extra',{...draft.extra,[key]:normalizeLabel(e.target.value)})} /></label>;
  const renderSelectExtra=(key,label,options)=> <label key={key}>{label}<select value={draft.extra?.[key]||''} onChange={e=>change('extra',{...draft.extra,[key]:e.target.value})}>
    <option value="">Sin informar</option>
    {options.map(value=><option key={value} value={value}>{value}</option>)}
    {draft.extra?.[key]&&!options.includes(draft.extra[key])&&<option value={draft.extra[key]}>{draft.extra[key]} (histórico)</option>}
  </select></label>;
  const selectedCompany = companies.find(company=>company.id===Number(draft?.companyId));
  const shown = files.filter(
    (file) =>
      (filter === "ALL" || file.validationStatus === filter) &&
      matchesEmployeeSearch(file,search),
  );
  return (
    <section className="ef module-content">
      <div className="ef-toolbar">
        <div>
          <strong>{counts.pending ? `${counts.pending} fichas pendientes de revisión` : 'Todas las fichas registradas están revisadas'}</strong>
          <p>
            Completa y revisa los datos a tu ritmo. Los campos adicionales
            pueden quedar vacíos.
          </p>
        </div>
        <button onClick={() => open(fresh())} disabled={busy}>
          Nueva ficha
        </button>
        <button
          onClick={() => load().catch((e) => setError(e.message))}
          disabled={busy}
        >
          Actualizar lista
        </button>
      </div>
      <div className="ef-filters" aria-label="Filtrar fichas">
        {[
          ["ALL", "Todos", counts.all],
          ["NO_VALIDADO", "No validados", counts.pending],
          ["VALIDADO", "Validados", counts.validated],
        ].map(([value, label, count]) => (
          <button
            key={value}
            aria-pressed={filter === value}
            className={filter === value ? "selected" : ""}
            onClick={() => setFilter(value)}
          >
            {label} ({count})
          </button>
        ))}
        <input
          aria-label="Buscar trabajador"
          placeholder="Buscar nombre, RUT o empresa"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {error && (
        <p className="ef-note" role="status">
          {error}
        </p>
      )}
      {next && (
        <div className="ef-note" role="dialog" aria-label="Cambios pendientes">
          <p>
            Cambios pendientes en: <strong>{pendingSections.join(', ')}</strong>.
            Guarda esa sección antes de cambiar de trabajador o descarta los cambios.
          </p>
          <button onClick={() => setNext(null)}>Seguir editando</button>
          <button onClick={() => select(next)}>Descartar y cambiar</button>
        </div>
      )}
      <div className="ef-layout">
        <aside className="ef-list" aria-label="Trabajadores">
          {shown.map((file) => (
            <button
              key={file.id}
              className={draft?.id === file.id ? "selected" : ""}
              onClick={() => open(file)}
              disabled={busy}
            >
              <strong>{file.fullName}</strong>
              <span>
                {formatRut(file.documentId) || "RUT pendiente"} ·{" "}
                {file.company || "Empresa pendiente"}
              </span>
              <span className="ef-badge">
                {file.validationStatus === "VALIDADO"
                  ? "VALIDADO"
                  : "NO VALIDADO"}{" "}
                ·{" "}
                {file.isActive
                  ? "Activo"
                  : file.employmentStatus === "FINIQUITADO"
                    ? "FINIQUITADO"
                    : "Inactivo"}
              </span>
            </button>
          ))}
          {!shown.length && <p>No hay fichas en este filtro.</p>}
        </aside>
        {draft ? (
          <form className="ef-form" onSubmit={event=>save(event)} noValidate>
            <div className="ef-heading">
              <h2>{draft.id ? `Ficha ${draft.id}` : "Nueva ficha"}</h2>
              {(counts.pending > 0 || draft.validationStatus !== 'VALIDADO') && <div className="ef-review-status">
                <strong>Revisión: {draft.validationStatus==='VALIDADO'?'VALIDADO':'NO VALIDADO'}</strong>
                {counts.pending > 0 && draft.validationStatus==='VALIDADO'&&<button type="button" onClick={()=>change('validationStatus','NO_VALIDADO')}>Marcar pendiente</button>}
              </div>}
              <span className="ef-badge">
                {draft.id
                  ? draft.isActive
                    ? "Activo"
                    : draft.employmentStatus === "FINIQUITADO"
                      ? "FINIQUITADO / inactivo"
                      : "Inactivo"
                  : "Nuevo trabajador"}
              </span>
            </div>
            <nav className="ef-tabs" aria-label="Pestañas de la ficha del trabajador">
              <button type="button" className={tab==='general'?'selected':''} onClick={()=>setTab('general')}>Ficha general</button>
              <button type="button" className={tab==='documents'?'selected':''} onClick={()=>setTab('documents')}>Documentos laborales</button>
              {['admin','supervisor'].includes(role)&&<button type="button" className={tab==='medical'?'selected':''} onClick={()=>setTab('medical')}>Licencias médicas</button>}
              {['admin','supervisor'].includes(role)&&<button type="button" className={tab==='health'?'selected':''} onClick={()=>setTab('health')}>Ficha médica</button>}
            </nav>
            <div className="ef-shared-save" role="group" aria-label="Guardar cambios del trabajador">
              <button className="primary" type="submit"
                disabled={busy || (!dirty && !medicalDirty && !contractDirty && !!draft.id)}>
                {busy ? 'Guardando…' : draft.id ? 'Guardar ficha' : 'Guardar ficha provisional'}
              </button>
              {showReviewAction({status:draft.validationStatus}) &&
                <button type="button" disabled={busy} onClick={()=>save(null,true)}>Completar / validar ficha</button>}
              <span aria-live="polite">{pendingSections.length
                ? 'Cambios pendientes: '+pendingSections.join(', ')
                : 'Sin cambios pendientes'}</span>
            </div>
            <div className="ef-tab-body" hidden={tab!=='general'}>
            <p className="ef-note">
              RUT: {checkRut(draft.documentId).status} · {['documentId','firstName','firstLastName','company','workSchedule','hireDate','email','address','birthDate'].filter(key => !String(draft[key] || '').trim()).length + (draft.phone || draft.mobile ? 0 : 1)} campos pendientes.
              {draft.validatedAt && <> Revisado por {draft.validatorName || `usuario ${draft.validatedBy}`} el {draft.validatedAt}.</>}
              {!draft.documentId && <> Ficha provisional: se conserva NO VALIDADO hasta informar el RUT.</>}
            </p>
            <p>El nombre completo se calcula al editar nombres y apellidos. El nombre legal histórico se conserva para revisión. El botón de guardado provisional no exige completar toda la ficha.</p>
            {!!completeFileMissing(draft).length&&<p className="ef-note">Para validar la ficha faltan: {completeFileMissing(draft).join(', ')}.</p>}
            <fieldset className="ef-section">
              <legend>Datos del trabajador</legend>
              <div className="ef-grid">
                {fields.filter(([key])=>!['mobile','phone'].includes(key)).map(([key,label])=>renderField(key,label))}
                <TerritoryFields prefix="Trabajador" value={draft.extra||{}} onChange={changes=>change('extra',{...draft.extra,...changes})}/>
                <PhoneField label="Celular" mobile value={draft.mobile} onChange={value=>change('mobile',value)}/>
                <PhoneField label="Teléfono fijo" value={draft.phone} onChange={value=>change('phone',value)}/>
                <label>Número del trabajador (derivado del RUT)<input readOnly value={workerNumberFromRut(draft.documentId)||draft.extra?.workerNumber||''}/></label>
                {!draft.documentId&&renderExtra(['temporaryDocument','Documento temporal (sin RUT)'])}
                {renderSelectExtra('sex','Sexo',SEX_OPTIONS)}
                {renderSelectExtra('nationality','Nacionalidad',NATIONALITIES)}
                {draft.extra?.nationality==='OTRA'&&renderExtra(['nationalityDetail','Especificar nacionalidad'])}
                {renderSelectExtra('civilStatus','Estado civil',CIVIL_STATUS_OPTIONS)}
                <label>AFP
                  <input maxLength={150} value={draft.extra?.afp||''}
                    onChange={e=>change('extra',{...draft.extra,afp:normalizeLabel(e.target.value)})} placeholder="AFP del trabajador"/>
                </label>
                <label>Sistema de salud
                  <select value={draft.extra?.healthSystem||''} onChange={e=>change('extra',{...draft.extra,healthSystem:e.target.value,...(e.target.value==='FONASA'?{isapreName:''}:{})})}>
                    <option value="">Sin informar</option><option value="FONASA">FONASA</option><option value="ISAPRE">ISAPRE</option>
                    {draft.extra?.healthSystem&&!['FONASA','ISAPRE'].includes(draft.extra.healthSystem)&&<option value={draft.extra.healthSystem}>{draft.extra.healthSystem} (histórico)</option>}
                  </select>
                </label>
                {draft.extra?.healthSystem==='ISAPRE'&&<label>Nombre de Isapre
                  <input maxLength={150} value={draft.extra?.isapreName||''}
                    onChange={e=>change('extra',{...draft.extra,isapreName:normalizeLabel(e.target.value)})}/>
                </label>}
                {draft.extra?.workerNumber&&workerNumberFromRut(draft.documentId)&&draft.extra.workerNumber!==workerNumberFromRut(draft.documentId)&&<p className="ef-note ef-field-wide">Número histórico diferente: {draft.extra.workerNumber}. Se conservará como referencia al guardar.</p>}
              </div>
            </fieldset>
            <fieldset className="ef-section">
              <legend>Datos laborales</legend>
              <div className="ef-grid">
                <label>Empresa<select aria-label="Empresa" value={draft.companyId||''} onChange={e=>chooseCompany(e.target.value)}>
                  <option value="" disabled>{draft.company ? draft.company + ' (histórica / no vinculada)' : 'Seleccionar empresa'}</option>
                  {companies.map(company=><option key={company.id} value={company.id} disabled={!company.isActive && Number(draft.companyId)!==company.id}>{company.legalName}{!company.isActive ? ' (inactiva)' : ''}</option>)}
                  {draft.companyId&&!companies.some(c=>c.id===Number(draft.companyId))&&<option value={draft.companyId}>{draft.company || 'Empresa histórica'} (fuera del catálogo disponible)</option>}
                </select></label>
                <button type="button" onClick={()=>api('/companies').then(result=>setCompanies(result.companies||[])).catch(e=>setError(e.message))}>Actualizar empresas</button>
                <label>Sucursal<select aria-label="Sucursal" value={draft.extra?.branch||''} onChange={e=>change('extra',{...draft.extra,branch:e.target.value})}>
                  <option value="" disabled>Sin sucursal registrada</option>
                  {!!selectedCompany?.defaultBranch && <option value={selectedCompany.defaultBranch}>{selectedCompany.defaultBranch}</option>}
                  {!!draft.extra?.branch && draft.extra.branch!==selectedCompany?.defaultBranch && <option value={draft.extra.branch}>{draft.extra.branch} (histórica)</option>}
                </select></label>
                {draft.companyId&&!selectedCompany?.defaultBranch&&<p className="ef-note ef-field-wide">Para precargar una sucursal, regístrala en Administración → Empresas.</p>}
                <label>Área
                  <select aria-label="Área" value={draft.workAreaId || ''} onChange={e => change('workAreaId',e.target.value)}>
                    <option value="">Sin asignar</option>
                    {areas.map(area => <option key={area.id} value={area.id}>{area.name}{area.isActive ? '' : ' (inactiva)'}</option>)}
                  </select>
                  {renderClear('workAreaId')}
                </label>
                <label>Cargo
                  <select aria-label="Cargo" value={draft.positionName || ''} onChange={e => change('positionName',e.target.value)}>
                    <option value="">Sin asignar</option>
                    {positions.map(p => <option key={p.id} value={p.name} disabled={!p.isActive && p.name !== draft.positionName}>{p.name}{p.isActive ? '' : ' (inactivo)'}</option>)}
                    {draft.positionName && !positions.some(p => p.name === draft.positionName) && <option value={draft.positionName}>{draft.positionName} (histórico)</option>}
                  </select>
                  {renderClear('positionName')}
                </label>
                <label>Jornada
                  <select aria-label="Jornada" value={draft.workSchedule || ''} onChange={e => change('workSchedule',e.target.value)}>
                    <option value="">Sin informar</option>
                    {['FULL_TIME','PART_TIME','PEAK_TIME'].map(v => <option key={v}>{v}</option>)}
                    {draft.workSchedule && !['FULL_TIME','PART_TIME','PEAK_TIME'].includes(draft.workSchedule) && <option>{draft.workSchedule}</option>}
                  </select>
                  {renderClear('workSchedule')}
                </label>
                <label className="ef-field-wide">Tipo de contrato
                  <select aria-label="Tipo de contrato" value={draft.contractType || ''} onChange={e => {
                    const contractType = e.target.value;
                    setDraft(current => ({...current,contractType,
                      ...(contractType === 'INDEFINIDO' ? {annexes:JSON.parse(saved || '{}').annexes || [],hasAnnexes:!!JSON.parse(saved || '{}').annexes?.length} : {})}));
                  }}>
                    <option value="">Sin informar</option>
                    <option value="INDEFINIDO">INDEFINIDO</option>
                    <option value="PLAZO_FIJO">PLAZO FIJO</option>
                    {draft.contractType && !['INDEFINIDO','PLAZO_FIJO'].includes(draft.contractType) && <option>{draft.contractType}</option>}
                  </select>
                  {renderClear('contractType')}
                </label>
                {showContractDetails && renderField('hireDate','Fecha de inicio')}
                {draft.contractType === 'INDEFINIDO' && (draft.employmentStatus === 'INACTIVO' || draft.employmentStatus === 'FINIQUITADO' || draft.isActive === 0) && renderField('terminationDate','Fecha de término efectivo')}
                {draft.contractType === 'INDEFINIDO' && draft.employmentStatus==='ACTIVO' && draft.isActive!==0 &&
                  <p className="ef-note ef-field-wide">Contrato indefinido vigente: sin fecha de vencimiento. Una fecha anterior, si existe, se conserva como historial.</p>}
                {draft.contractType === 'PLAZO_FIJO' && <>
                  {renderField('terminationDate','Fecha de término inicial')}
                  <label>¿Tiene anexos?
                    <select aria-label="¿Tiene anexos?" value={draft.hasAnnexes ? 'SI' : 'NO'} onChange={e => setDraft(current => ({...current, hasAnnexes:e.target.value === 'SI', annexes:e.target.value === 'SI' ? (current.annexes?.length ? current.annexes : [{annexDate:'',endDate:''}]) : []}))}>
                      <option value="NO" disabled={!!JSON.parse(saved || '{}').annexes?.length}>No</option><option value="SI">Sí</option>
                    </select>
                  </label>
                  {draft.hasAnnexes && <div className="ef-field-wide ef-annexes">
                    {(draft.annexes || []).map((annex,index) => <div key={index}>
                      <strong>Anexo {index+1}</strong>
                      <ContractFiles file={draft} dirty={dirty} target={String(index+1)} onMessage={onMessage} />
                      <div className="ef-grid">
                        <label>Fecha del anexo<DateField  value={annex.annexDate} onChange={e => changeAnnex(index,'annexDate',e.target.value)} /></label>
                        <label>Nueva fecha de término<DateField  value={annex.endDate} onChange={e => changeAnnex(index,'endDate',e.target.value)} /></label>
                      </div>
                    </div>)}
                    {draft.annexes?.length === 1 && <button type="button" disabled={!validContractDate(draft.annexes[0].annexDate) || !validContractDate(draft.annexes[0].endDate) || !validContractDate(draft.terminationDate) || draft.annexes[0].endDate <= draft.terminationDate} onClick={() => change('annexes',[...draft.annexes,{annexDate:'',endDate:''}])}>Agregar Anexo 2</button>}
                    {draft.annexes?.length === 2 && (JSON.parse(saved || '{}').annexes?.length || 0) < 2 && <button type="button" onClick={() => change('annexes',draft.annexes.slice(0,1))}>Descartar Anexo 2 sin guardar</button>}
                    {!!JSON.parse(saved || '{}').annexes?.length && <p>Los anexos guardados se conservan en el historial. Las correcciones quedan auditadas.</p>}
                  </div>}
                </>}
                {showContractDetails && <div className="ef-note ef-field-wide" aria-live="polite">
                  <strong>Vigencia actual del contrato</strong>
                  <p>{draft.contractType === 'INDEFINIDO' ? 'Contrato indefinido' + (draft.employmentStatus === 'ACTIVO' && draft.isActive !== 0 ? ' vigente' : ' · trabajador inactivo') + (currentContractEnd(draft) ? ' · Término: ' + currentContractEnd(draft).split('-').reverse().join('/') : '') : currentContractEnd(draft)?.split('-').reverse().join('/') || 'Fecha de término pendiente'}</p>
                </div>}
                <ContractFiles file={draft} dirty={dirty} onMessage={onMessage} />
                {["admin","supervisor"].includes(role)&& (draft.id ? <ContractTerms ref={contractRef} key={draft.id+'-'+contractReload} employeeId={draft.id} suggestedWorkplace={draft.extra?.branch||selectedCompany?.defaultBranch||''}
                  positionName={draft.positionName} positions={positions}
                  onDirtyChange={setContractDirty} /> : <p className="ef-note ef-field-wide">Guarda primero al trabajador para registrar condiciones contractuales.</p>)}
                <div className="ef-field-wide"><strong>Estado laboral</strong></div>
                <label>Estado laboral
                  <select aria-label="Estado laboral" value={draft.employmentStatus || ''} onChange={e => change('employmentStatus',e.target.value)}>
                    <option value="">Sin informar</option>
                    <option value="ACTIVO" disabled={draft.isActive === 0}>Activo</option>
                    <option value="INACTIVO">Inactivo</option>
                    <option value="FINIQUITADO">Finiquitado</option>
                  </select>
                </label>
                {renderField('terminationReason','Motivo / observación de término')}
                {extras.filter(([key]) => ['hierarchyUnit','costCenter','branch'].includes(key)).map(renderExtra)}
              </div>
            </fieldset>
            <label>
              Observaciones
              <textarea
                rows={3}
                value={draft.readableObservations ?? draft.observations ?? ""}
                onChange={(e) => setDraft(current => ({...current,observations:e.target.value,readableObservations:e.target.value}))}
              />
            </label>
            {!!draft.warnings?.length && (
              <div className="ef-note">
                <strong>Datos por revisar</strong>
                {draft.warnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </div>
            )}
            {draft.id && (
              <p className="ef-note">
                La identificación diaria se gestiona en Usuarios mediante QR personal y PIN. La activación o desactivación conserva el historial.
              </p>
            )}
            <div className="ef-actions">
              <span>{draft.updatedAt ? 'Última actualización: '+draft.updatedAt : 'Ficha nueva'}</span>
            </div>
            </div>
            <div className="ef-tab-content" hidden={tab!=='documents'}>
              <EmployeeDocuments role={role} key={draft.id || 'new'} employeeId={draft.id}
                 hasUnsavedChanges={Boolean(dirty||medicalDirty||contractDirty)}
                 onDirtyChange={setDocumentsDirty}
                 onSalaryApplied={()=>setContractReload(n=>n+1)} onMessage={onMessage} />
            </div>
            {['admin','supervisor'].includes(role)&&<div className="ef-tab-content" hidden={tab!=='medical'}>
              {draft.id ? <MedicalLeaves key={draft.id} employeeId={draft.id} hasUnsavedChanges={Boolean(dirty)} onMessage={onMessage} />
                : <p>Guarda primero la ficha para registrar licencias médicas.</p>}
            </div>}
            {['admin','supervisor'].includes(role)&&<div className="ef-tab-content" hidden={tab!=='health'}>
              {draft.id ? <MedicalProfile ref={medicalRef} key={draft.id} employeeId={draft.id}
                fullName={draft.legalFullName || draft.fullName} documentId={draft.documentId}
                onDirtyChange={setMedicalDirty} />
                : <p>Guarda primero la ficha general para completar la ficha médica.</p>}
            </div>}
          </form>
        ) : (
          <div className="ef-empty">
            Selecciona un trabajador para revisar su ficha o crea una ficha
            nueva.
          </div>
        )}
      </div>
    </section>
  );
}
