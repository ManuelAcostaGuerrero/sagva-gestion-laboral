import React,{useEffect,useState} from 'react';
import {api} from './services/api.js';
import './employeeFile.css';

const empty=()=>({legalName:'',taxId:'',tradeName:'',address:'',commune:'',email:'',phone:'',representativeName:'',representativeRut:'',defaultBranch:'',defaultAreaId:null,defaultPositionName:'',defaultSchedule:'',revision:0});
export default function Companies({areas=[],positions=[],onMessage}){
 const [companies,setCompanies]=useState([]);
 const [id,setId]=useState(null),[draft,setDraft]=useState(empty),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function reload(){
   const result=await api('/companies');
   setCompanies(result.companies);
 }
 useEffect(()=>{reload().catch(e=>setError(e.message));},[]);
 function select(item){setId(item?.id||null);setDraft(item?{...item}:empty());setError('');}
 function change(key,value){setDraft(old=>({...old,[key]:value}));}
 async function save(event){
  event.preventDefault();setBusy(true);setError('');
  try{
   const result=await api(id?'/companies/'+id:'/companies',{method:id?'PUT':'POST',body:JSON.stringify(draft)});
   await reload();onMessage?.(result.message);
   if(id){const updated=await api('/companies');select(updated.companies.find(c=>c.id===id));}
   else {const latest=await api('/companies');select(latest.companies.find(c=>c.id===result.id));}
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 const inputs=[['legalName','Razón social'],['taxId','RUT empresa'],['tradeName','Nombre comercial'],
 ['address','Dirección'],['commune','Comuna'],['email','Correo institucional'],
 ['phone','Teléfono'],['representativeName','Representante legal'],['representativeRut','RUT representante legal'],
 ['defaultBranch','Sucursal predeterminada']];
 return <section className="ef module-content" aria-label="Empresas">
   <div className="ef-toolbar"><div><strong>Administración de empresas</strong>
     <p>Los cambios no reemplazan datos históricos ni alteran contratos guardados.</p></div>
     <button type="button" onClick={()=>select(null)} disabled={busy}>Nueva empresa</button>
   </div>
   <div className="ef-layout">
    <aside className="ef-list" aria-label="Empresas registradas">
     {companies.map(company=><button type="button" key={company.id}
       className={id===company.id?'selected':''} onClick={()=>select(company)}>
       <strong>{company.legalName}</strong><span>{company.taxId||'RUT pendiente'} · {company.tradeName||'Sin nombre comercial'}</span>
     </button>)}
     {!companies.length&&<p>Sin empresas configuradas.</p>}
    </aside>
    <form className="ef-form" onSubmit={save}>
      <div className="ef-heading"><h2>{id?'Editar empresa':'Nueva empresa'}</h2></div>
      {error&&<p className="ef-note" role="alert">{error}</p>}
      <fieldset className="ef-section"><legend>Datos empresariales</legend><div className="ef-grid">
       {inputs.map(([key,label])=><label key={key}>{label}<input
         type={key==='email'?'email':'text'}
         value={draft[key]||''}
         maxLength={250}
         required={key==='legalName'}
         onChange={e=>change(key,['email','taxId','representativeRut','phone'].includes(key)?e.target.value:e.target.value.toLocaleUpperCase('es-CL'))}/></label>)}
      </div></fieldset>
      <fieldset className="ef-section"><legend>Valores sugeridos para nuevas fichas</legend><div className="ef-grid">
       <label>Área sugerida<select value={draft.defaultAreaId||''} onChange={e=>change('defaultAreaId',e.target.value?Number(e.target.value):null)}>
        <option value="">Sin preselección</option>{areas.filter(a=>a.isActive).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
       <label>Cargo sugerido<select value={draft.defaultPositionName||''} onChange={e=>change('defaultPositionName',e.target.value)}>
        <option value="">Sin preselección</option>{positions.filter(p=>p.isActive).map(p=><option key={p.id} value={p.name}>{p.name}</option>)}</select></label>
       <label>Jornada sugerida<select value={draft.defaultSchedule||''} onChange={e=>change('defaultSchedule',e.target.value)}>
        <option value="">Sin preselección</option><option value="FULL_TIME">FULL TIME</option>
        <option value="PART_TIME">PART TIME</option><option value="PEAK_TIME">PEAK TIME</option></select></label>
      </div></fieldset>
      <div className="ef-actions"><button className="primary" type="submit" disabled={busy}>
        {busy?'Guardando…':id?'Guardar empresa':'Crear empresa'}</button></div>
    </form>
   </div>
  </section>;
}
