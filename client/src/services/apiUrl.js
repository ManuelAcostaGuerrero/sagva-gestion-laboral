// La web compilada y Vite reenvían /api al servidor local. Las direcciones
// absolutas antiguas del .env pueden apuntar a otro PC o a un túnel vencido.
export function resolveApiUrl(_location, configured = '') {
  const value = String(configured).trim();
  return /^\/(?!\/)/.test(value) ? value.replace(/\/+$/, '') || '/api' : '/api';
}
