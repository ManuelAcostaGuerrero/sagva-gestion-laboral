import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter } from './routes/auth.routes.js';
import { employeeRouter } from './routes/employees.routes.js';
import { attendanceRouter } from './routes/attendance.routes.js';
import { settingsRouter } from './routes/settings.routes.js';
import { notificationsRouter } from './routes/notifications.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { schedulesRouter } from './routes/schedules.routes.js';
import { areasRouter } from './routes/areas.routes.js';
import { positionsRouter } from './routes/positions.routes.js';
import { plannerRouter } from './routes/planner.routes.js';
import { contractFilesRouter } from './routes/contractFiles.routes.js';
import { employeeFilesRouter } from './routes/employeeFiles.routes.js';
import { employeeDocumentsRouter } from './routes/employeeDocuments.routes.js';
import { documentCatalogRouter } from './routes/documentCatalog.routes.js';
import { documentAuditRouter } from './routes/documentAudit.routes.js';
import { medicalLeavesRouter } from './routes/medicalLeaves.routes.js';
import { medicalProfilesRouter } from './routes/medicalProfiles.routes.js';
import { companiesRouter } from './routes/companies.routes.js';
import { contractTermsRouter } from './routes/contractTerms.routes.js';
import { tokenRouter } from './routes/token.routes.js';
import { laborAccountingRouter } from './routes/laborAccounting.routes.js';
import { laborBenefitsRouter } from './routes/laborBenefits.routes.js';
import { employeeBenefitsRouter } from './routes/employeeBenefits.routes.js';

export const app = express();
const allowedOrigins = String(process.env.CLIENT_ORIGIN || 'http://localhost:5183')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function isPrivateLanHost(hostname) {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname.startsWith('192.168.')
    || hostname.startsWith('10.')
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
}

function isAllowedOrigin(origin) {
  if (!origin || allowedOrigins.includes(origin)) {
    return true;
  }

  try {
    const url = new URL(origin);
    return ['5183', '5184'].includes(url.port) && isPrivateLanHost(url.hostname);
  } catch {
    return false;
  }
}

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origen no permitido por CORS'));
  }
}));
app.use(express.json({ limit: '2mb' }));
// Retired identification methods remain archived for historical compatibility;
// no public route can mark or log in with the old biometric/code flow.
app.use((req,res,next)=>{
  const retired=['/api/attendance/register','/api/attendance/register-code','/api/auth/login-fingerprint'];
  if((retired.includes(req.path)||req.path.endsWith('/fingerprint')) && req.method!=='GET')
    return res.status(410).json({message:'Método de identificación retirado. Usa QR personal o PIN en una terminal autorizada.'});
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'attendance-fingerprint-api' });
});

app.use('/api/auth', authRouter);
app.use('/api/employees', employeeRouter);
app.use('/api/employee-files', employeeFilesRouter);
app.use('/api/contract-files', contractFilesRouter);
app.use('/api/employee-documents', employeeDocumentsRouter);
app.use('/api/document-catalog', documentCatalogRouter);
app.use('/api/document-audit', documentAuditRouter);
app.use('/api/medical-leaves', medicalLeavesRouter);
app.use('/api/medical-profiles', medicalProfilesRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/labor-accounting', laborAccountingRouter);
app.use('/api/labor-benefits', laborBenefitsRouter);
app.use('/api/employee-benefits', employeeBenefitsRouter);
app.use('/api/contract-terms', contractTermsRouter);
app.use('/api/tokens', tokenRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/areas', areasRouter);
app.use('/api/positions', positionsRouter);
app.use('/api/planner', plannerRouter);

app.use((err, _req, res, _next) => {
  if (err.status && err.status>=400 && err.status<500) return res.status(err.status).json({message:err.message});
  console.error(err);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      message: 'La solicitud enviada al servidor no tiene un formato JSON valido.'
    });
  }

  const isDatabaseError = err.code?.includes?.('SQLITE');

  res.status(500).json({
    message: isDatabaseError
      ? 'No se pudo operar con SQLite. Revisa el archivo de datos, sus permisos y el registro del servidor.'
      : 'Error interno del servidor'
  });
});
