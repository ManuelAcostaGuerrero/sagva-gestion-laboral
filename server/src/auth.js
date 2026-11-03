import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET || 'desarrollo';
const adminSessionExpiresIn = process.env.ADMIN_SESSION_EXPIRES_IN || '8h';

export function signAdmin(admin) {
  return jwt.sign(
    { id: admin.id, username: admin.username, role: admin.role || 'admin' },
    secret,
    { expiresIn: adminSessionExpiresIn }
  );
}

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Token requerido' });
  }

  try {
    req.admin = jwt.verify(token, secret);
    return next();
  } catch {
    return res.status(401).json({ message: 'Sesion no valida' });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    requireAdmin(req, res, () => {
      if (!roles.includes(req.admin.role || 'admin')) {
        return res.status(403).json({ message: 'No tienes permisos para esta accion' });
      }
      return next();
    });
  };
}
