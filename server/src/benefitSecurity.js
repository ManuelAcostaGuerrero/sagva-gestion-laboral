
import crypto from 'node:crypto';

// Transitorio hasta BL-007 Root: acceso explícito por ID, cerrado por defecto.
// No depender solo del rol admin existente, que aún no distingue administradores locales.
const ids = value => new Set(String(value || '').split(',').map(s=>s.trim()).filter(s=>/^\d+$/.test(s)));
export const mayConfigureLabor = admin => admin?.role === 'admin' &&
  ids(process.env.SAGVA_CONFIGURATION_USER_IDS).has(String(admin.id));
export const mayAccessBank = admin => admin?.role === 'admin' &&
  ids(process.env.SAGVA_BANK_ACCESS_USER_IDS).has(String(admin.id));

function key() {
  const raw=String(process.env.SAGVA_BANK_DATA_KEY || '');
  if (!/^[a-fA-F0-9]{64}$/.test(raw))
    throw Object.assign(new Error('Clave de cifrado bancario no configurada.'),{status:503});
  return Buffer.from(raw,'hex');
}
export function encryptBank(data) {
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);
  const body=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]);
  return [iv.toString('base64'),cipher.getAuthTag().toString('base64'),body.toString('base64')].join('.');
}
export function decryptBank(payload) {
  const [nonce,tag,body]=String(payload).split('.');
  if (!nonce || !tag || !body) throw new Error('Formato de registro bancario inválido.');
  const decipher=crypto.createDecipheriv('aes-256-gcm',key(),Buffer.from(nonce,'base64'));
  decipher.setAuthTag(Buffer.from(tag,'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(body,'base64')),decipher.final()]).toString('utf8'));
}
export const bankReady=()=>/^[a-fA-F0-9]{64}$/.test(String(process.env.SAGVA_BANK_DATA_KEY||''));
export const restricted=(predicate)=> (req,res,next)=>predicate(req.admin)?next():res.status(403).json({message:'Acceso no autorizado para esta operación.'});
