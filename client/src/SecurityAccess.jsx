import React,{useEffect,useState} from 'react';
import {api} from './services/api.js';
export default function SecurityAccess({onMessage}){
 const [self,setSelf]=useState(null),[users,setUsers]=useState([]),[catalog,setCatalog]=useState([]);
 const [selected,setSelected]=useState(''),[details,setDetails]=useState(null);
 const [profile,setProfile]=useState(''),[permission,setPermission]=useState(''),[effect,setEffect]=useState('ALLOW');
 const [reason,setReason]=useState(''),[until,setUntil]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;api('/admin/access/self').then(async v=>{
  if(!active)return;setSelf(v);
  if(v.profile!=='root')return;
  const [u,c]=await Promise.all([api('/admin/access/users'),api('/admin/access/catalog')]);
  if(active){setUsers(u.users||[]);setCatalog(c.permissions||[]);}
 }).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 async function load(id){
  setSelected(id);setDetails(null);setError('');
  if(!id)return;
  try{const x=await api('/admin/access/users/'+id);setDetails(x);setProfile(x.user.profile||'');}
  catch(e){setError(e.message);}
 }
 async function act(url,method,body){
  if(!window.confirm('¿Confirmas el cambio de permisos de este usuario?'))return;
  setBusy(true);setError('');
  try{const response=await api(url,{method,body:body?JSON.stringify(body):undefined});
   onMessage?.(response.message||'Cambio registrado con auditoría.');
   await load(selected);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 if(!self&&!error)return <p className="ef-note">Verificando permisos…</p>;
 if(self?.profile!=='root')return <section className="form-panel"><h2>Root · Permisos individuales</h2>
  <p className="ef-note">Root no está habilitado en esta sesión. La activación inicial requiere que el propietario asigne su ID de usuario preexistente a SAGVA_ROOT_USER_ID en la configuración privada y reinicie el servidor. No se cambian cuentas automáticamente.</p>
  {error&&<p role="alert">{error}</p>}
 </section>;
 return <section className="form-panel">
  <h2>Root · Permisos individuales</h2>
  <p>Concesiones por usuario y acción; no alteran a otras personas del mismo rol. Denegar prevalece sobre permitir. Los cambios y revocaciones quedan registrados.</p>
  {error&&<p role="alert">{error}</p>}
  <label>Usuario<select value={selected} onChange={e=>load(e.target.value)}>
   <option value="">Seleccionar usuario</option>
   {users.map(u=><option key={u.id} value={u.id}>{u.fullName} ({u.username}) · {u.profile||u.role}</option>)}
  </select></label>
  {details&&<>
   <h3>Perfil del usuario</h3>
   <label>Perfil<select value={profile} onChange={e=>setProfile(e.target.value)}>
    <option value="" disabled>Rol anterior: sin migrar</option>
    <option value="root">Root</option><option value="accounting">Contabilidad</option>
    <option value="admin_local" disabled>Administrador local (bloqueado hasta aislamiento por local)</option>
   </select></label>
   <button type="button" disabled={busy||!profile||profile===details.user.profile}
    onClick={()=>act('/admin/access/users/'+selected+'/profile','PUT',{profile})}>Cambiar perfil</button>
   <h3>Acceso específico</h3>
   <form onSubmit={e=>{e.preventDefault();act('/admin/access/users/'+selected+'/permissions','POST',
    {permission,effect,scopeKind:'GLOBAL',reason,validUntil:until||null});}}>
    <div className="ef-grid">
     <label>Módulo y campo<select required value={permission} onChange={e=>setPermission(e.target.value)}>
      <option value="">Seleccionar permiso</option>
      {catalog.filter(c=>c.key!=='security.access.manage').map(c=><option key={c.key} value={c.key}>{c.group} · {c.label}</option>)}
     </select></label>
     <label>Acción<select value={effect} onChange={e=>setEffect(e.target.value)}>
      <option value="ALLOW">Permitir</option><option value="DENY">Denegar</option></select></label>
     <label>Vencimiento opcional<input type="date" value={until} onChange={e=>setUntil(e.target.value)}/></label>
     <label>Motivo<textarea value={reason} required minLength={10} maxLength={500} onChange={e=>setReason(e.target.value)}/></label>
    </div>
    <p className="ef-note">En esta entrega las concesiones desde la interfaz son globales. El aislamiento por sucursal aún debe probarse antes de activar permisos locales.</p>
    <button type="submit" disabled={busy||!permission||reason.trim().length<10}>Registrar excepción</button>
   </form>
   <h3>Permisos particulares</h3>
   <div className="la-scroll"><table><thead><tr><th>Permiso</th><th>Decisión</th><th>Ámbito</th><th>Vigencia</th><th>Estado</th><th></th></tr></thead><tbody>
    {(details.overrides||[]).map(x=><tr key={x.id}>
     <td>{catalog.find(c=>c.key===x.permission)?.label||x.permission}</td><td>{x.effect}</td>
     <td>{x.scopeKind}</td><td>{x.validUntil?.slice(0,10)||'Indefinido'}</td><td>{x.revokedAt?'Revocado':'Vigente'}</td>
     <td>{!x.revokedAt&&<button disabled={busy} type="button" onClick={()=>act('/admin/access/permissions/'+x.id+'/revoke','POST')}>Revocar</button>}</td>
    </tr>)}
   </tbody></table></div>
  </>}
 </section>;
}
