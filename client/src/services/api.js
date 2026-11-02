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
