
import crypto from 'node:crypto';
import {permitted} from './securityPermissions.js';

export const mayConfigureLabor=admin=>permitted(admin,'labor.benefits.manage');
export const mayReadBank=admin=>permitted(admin,'personal.bank.read')||permitted(admin,'personal.bank.write');
export const mayEditBank=admin=>permitted(admin,'personal.bank.write');
// Compatibilidad de lectura para consumidores existentes.
export const mayAccessBank=mayReadBank;

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
