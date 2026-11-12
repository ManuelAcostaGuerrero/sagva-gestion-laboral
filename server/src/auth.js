import jwt from 'jsonwebtoken';
import {pool} from './db.js';
import {accessContext,permitted,requirePermission} from './securityPermissions.js';
const secret=process.env.JWT_SECRET||'desarrollo';
const expires=process.env.ADMIN_SESSION_EXPIRES_IN||'8h';
export function signAdmin(admin){
 return jwt.sign({id:admin.id,username:admin.username,role:admin.role||'admin'},secret,{expiresIn:expires});
}
// Releer el rol y las concesiones: la revocación se aplica con la sesión abierta.
export async function requireAdmin(req,res,next){
 const header=req.headers.authorization||'';
 const token=header.startsWith('Bearer ')?header.slice(7):null;
 if(!token)return res.status(401).json({message:'Token requerido'});
 try{
  const claims=jwt.verify(token,secret);
  const id=Number(claims.id);
  if(!Number.isSafeInteger(id)||id<1)return res.status(401).json({message:'Sesión no válida'});
  const [rows]=await pool.execute('SELECT id,username,role FROM admins WHERE id=?',[id]);
  if(!rows.length)return res.status(401).json({message:'Usuario no disponible'});
  req.admin={...rows[0],...(await accessContext(pool,id))};
  return next();
 }catch(error){
  if(['JsonWebTokenError','TokenExpiredError','NotBeforeError'].includes(error.name))
   return res.status(401).json({message:'Sesión no válida'});
  return next(error);
 }
}
export function requireRoles(...roles){
 return (req,res,next)=>requireAdmin(req,res,()=>{
  // Los perfiles nuevos no heredan las facultades de su antiguo rol SQL.
  if(req.admin.profile==='root')return next(); // Perfil verificado en BD, aunque el rol legado/JWT esté desfasado.
  if(['accounting','admin_local'].includes(req.admin.profile))
   return res.status(403).json({message:'No tienes permisos para esta acción'});
  return roles.includes(req.admin.role)?next():res.status(403).json({message:'No tienes permisos para esta acción'});
 });
}
export {permitted,requirePermission};
