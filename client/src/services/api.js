import {resolveApiUrl} from './apiUrl.js';
const API_URL = resolveApiUrl(typeof window==='undefined'?null:window.location,import.meta.env?.VITE_API_URL || '');

let authToken = localStorage.getItem('token') || '';

export function setToken(token) {
  authToken = token || '';
}

export async function api(path, options = {}) {
  const currentToken = authToken || localStorage.getItem('token') || '';

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch (cause) {
    if (cause.name === 'AbortError') throw cause;
    const error = new Error('No se pudo conectar con el servidor de asistencia. Comprueba que el sistema esté iniciado y vuelve a intentar.', { cause });
    error.code = 'NETWORK_ERROR';
    throw error;
  }

  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    throw new Error('La conexión no devolvió una respuesta del servidor de asistencia. Revisa el estado del sistema y vuelve a intentar.');
  }
  if (!response.ok) {
    const error = new Error(payload.message || 'No se pudo completar la solicitud');
    error.status = response.status;
    error.assignedEmployees = Array.isArray(payload.assignedEmployees) ? payload.assignedEmployees : [];
    error.historyCount = Number(payload.historyCount || 0);
    throw error;
  }

  return payload;
}

 // Descargar archivos protegidos sin exponer el token en URLs o enlaces públicos.
export async function downloadApiFile(path){
  const currentToken=authToken || localStorage.getItem('token') || '';
  let response;
  try{
    response=await fetch(`${API_URL}${path}`,{headers:{
      ...(currentToken ? {Authorization:`Bearer ${currentToken}`}: {})
    },cache:'no-store'});
  }catch(cause){
    const error=new Error('No se pudo descargar el reporte. Revisa la conexión.',{cause});
    error.code='NETWORK_ERROR';
    throw error;
  }
  if(!response.ok){
    const body=await response.json().catch(()=>null);
    throw new Error(body?.message || 'No fue posible descargar el archivo.');
  }
  const disposition=response.headers.get('Content-Disposition')||'';
  const filename=disposition.match(/filename="([a-z0-9._-]+)"/i)?.[1]||'reporte-asistencia.csv';
  return {blob:await response.blob(),filename,digest:response.headers.get('X-Report-SHA256')||null};
}
