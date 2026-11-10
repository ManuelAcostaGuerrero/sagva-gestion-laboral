import React,{useEffect,useState} from 'react';
import {api} from './services/api.js';
const fresh=()=>({code:'EXT_',label:'',target:'FICHA',type:'TEXT',required:false,options:[],reason:''});
export default function LaborFieldConfigurator(){
 const [definitions,setDefinitions]=useState([]),[canManage,setCanManage]=useState(false),[editing,setEditing]=useState(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 async function load(){const r=await api('/labor-fields/definitions');setDefinitions(r.definitions||[]);setCanManage(!!r.canManage);}
 useEffect(()=>{load().catch(e=>setError(e.message));},[]);
 const set=(key,value)=>setEditing(v=>({...v,[key]:value}));
 async function save(e){
  e.preventDefault();setBusy(true);setError('');setNotice('');
  try{
   const isExisting=!!editing.id;
   const payload=isExisting?
    {label:editing.label,required:editing.required,active:editing.active,options:editing.options,revision:editing.revision,reason:editing.reason}:
    {code:editing.code,label:editing.label,target:editing.target,type:editing.type,required:editing.required,options:editing.options,reason:editing.reason};
   await api(isExisting?'/labor-fields/definitions/'+editing.id:'/labor-fields/definitions',
    {method:isExisting?'PUT':'POST',body:JSON.stringify(payload)});
   await load();setEditing(null);setNotice('Definición guardada con historial.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <section className="ef-section">
  <h3>Configuración central de campos</h3>
  <p className="ef-note">Define campos complementarios para la ficha y el contrato. Los trabajadores solo completan valores individuales. No permite redefinir RUT, sueldo, diagnóstico, cuenta bancaria ni cláusulas firmadas.</p>
  {error&&<p className="ef-note" role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  <div className="la-scroll"><table><thead><tr><th>Destino</th><th>Código</th><th>Etiqueta</th><th>Tipo</th><th>Obligatorio</th><th>Estado</th><th></th></tr></thead><tbody>
   {definitions.map(x=><tr key={x.id}><td>{x.target==='FICHA'?'Ficha':'Contrato'}</td><td>{x.code}</td><td>{x.label}</td>
    <td>{x.type}</td><td>{x.required?'Sí':'No'}</td><td>{x.active?'Activo':'Histórico'}</td>
    <td>{canManage&&<button type="button" onClick={()=>setEditing({...x,reason:''})}>Editar</button>}</td></tr>)}
  </tbody></table></div>
  {canManage&&<><button type="button" onClick={()=>setEditing(fresh())}>Agregar campo</button>
   {editing&&<form onSubmit={save} className="ef-section">
    <fieldset disabled={busy}><legend>{editing.id?'Editar definición':'Nuevo campo complementario'}</legend>
     <div className="ef-grid">
      {!editing.id&&<label>Código técnico (inicia EXT_)<input pattern="EXT_[A-Z0-9_]{2,36}" required value={editing.code}
       onChange={e=>set('code',e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g,''))}/></label>}
      <label>Nombre visible<input required maxLength={120} value={editing.label} onChange={e=>set('label',e.target.value)}/></label>
      {!editing.id&&<label>Sección<select value={editing.target} onChange={e=>set('target',e.target.value)}>
       <option value="FICHA">Ficha del trabajador</option><option value="CONTRATO">Condiciones contractuales</option>
      </select></label>}
      {!editing.id&&<label>Tipo<select value={editing.type} onChange={e=>set('type',e.target.value)}>
       <option value="TEXT">Texto</option><option value="NUMBER">Número</option><option value="DATE">Fecha</option>
       <option value="BOOLEAN">Sí / No</option><option value="SELECT">Lista de opciones</option></select></label>}
      <label><input type="checkbox" checked={!!editing.required} onChange={e=>set('required',e.target.checked)}/> Obligatorio para cerrar la ficha</label>
      {!!editing.id&&<label><input type="checkbox" checked={!!editing.active} onChange={e=>set('active',e.target.checked)}/> Activo</label>}
      {editing.type==='SELECT'&&<label className="ef-field-wide">Opciones (una por línea, no eliminar opciones históricas)
       <textarea rows={4} value={(editing.options||[]).join('\n')} onChange={e=>set('options',e.target.value.split('\n').map(s=>s.trim()).filter(Boolean))}/></label>}
      <label className="ef-field-wide">Motivo de modificación<textarea rows={2} minLength={10} required maxLength={500}
       value={editing.reason} onChange={e=>set('reason',e.target.value)}/></label>
     </div><button type="submit">Guardar definición</button> <button type="button" onClick={()=>setEditing(null)}>Cancelar</button>
    </fieldset>
   </form>}
  </>}
  {!canManage&&<p className="ef-note">Solo lectura. Root puede conceder el permiso individual «Configurar definiciones de campos».</p>}
 </section>;
}
