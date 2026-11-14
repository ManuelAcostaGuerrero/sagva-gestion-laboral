import crypto from 'node:crypto';

// El lector valida hashes; la bóveda solo se abre para reimprimir con sesión administrativa.
// No registrar códigos ni claves en bitácoras, logs o URLs.
const format=/^at_[A-Za-z0-9_-]{43}$/;
const fail=message=>Object.assign(new Error(message),{status:503});
function keyFor(version){
 if(version==='k1'){
  const value=String(process.env.SAGVA_QR_DATA_KEY||'').trim();
  if(!/^[0-9a-fA-F]{64}$/.test(value))throw fail('SAGVA_QR_DATA_KEY no está configurada o tiene formato inválido.');
  return Buffer.from(value,'hex');
 }
 if(version==='j1'){
  const jwt=String(process.env.JWT_SECRET||'');
  if(jwt.length<32||/cambia_este|desarrollo/i.test(jwt))
   throw fail('JWT_SECRET seguro o SAGVA_QR_DATA_KEY es obligatorio para conservar los QR.');
  // Compatibilidad automática con la instalación Windows existente. Conservar la clave
  // en respaldos: cambiar JWT_SECRET sin migración impediría reimprimir estos QR.
  return Buffer.from(crypto.hkdfSync('sha256',Buffer.from(jwt),Buffer.from('SAGVA-WORKER-QR-v1'),Buffer.from('worker-token-encryption'),32));
 }
 throw new Error('Formato de credencial cifrada no reconocido.');
}
export function sealWorkerQr(token){
 if(!format.test(token))throw new Error('Código QR inválido para guardar.');
 const version=String(process.env.SAGVA_QR_DATA_KEY||'').trim()?'k1':'j1';
 const key=keyFor(version),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(Buffer.from('SAGVA-WORKER-QR-v1'));
 const encrypted=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
 return [version,iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.');
}
export function unsealWorkerQr(value){
 const [version,nonce,tag,data,...extra]=String(value||'').split('.');
 if(extra.length||!['j1','k1'].includes(version)||!nonce||!tag||!data)throw new Error('Registro QR cifrado corrupto.');
 const decipher=crypto.createDecipheriv('aes-256-gcm',keyFor(version),Buffer.from(nonce,'base64url'));
 decipher.setAAD(Buffer.from('SAGVA-WORKER-QR-v1'));
 decipher.setAuthTag(Buffer.from(tag,'base64url'));
 const token=Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]).toString('utf8');
 if(!format.test(token))throw new Error('Registro QR recuperado inválido.');
 return token;
}
export const workerQrRecoverable=value=>Boolean(value);
