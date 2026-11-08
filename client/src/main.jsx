import MonthField from './MonthField.jsx';
import DateTimeField from './DateTimeField.jsx';
import DateField from './DateField.jsx';
import TokenKiosk from './TokenKiosk.jsx';
import TokenCredentials from './TokenCredentials.jsx';
import PressToRevealPassword from './PressToRevealPassword.jsx';
import EmployeeFile from './EmployeeFile.jsx';
import DocumentCatalog from './DocumentCatalog.jsx';
import DocumentAudit from './DocumentAudit.jsx';
import Companies from './Companies.jsx';
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BarChart3,
  BellRing,
  Building2,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  History,
  ImageOff,
  KeyRound,
  LogIn,
  LogOut,
  MonitorSmartphone,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Wrench
} from 'lucide-react';
import { api, setToken } from './services/api.js';
import { createEmployeeExport } from './employeeExport.js';
import { disablePushNotifications, enablePushNotifications, getPushStatus, registerAppServiceWorker } from './services/pushNotifications.js';
import './styles.css';
import WeeklyPlanner from './WeeklyPlanner.jsx';
import ShiftManager from './ShiftManager.jsx';
import { version as appVersion } from '../package.json';

const ATTENDANCE_TYPE_OPTIONS = [
  { id: 'entrada', label: 'Entrada', shortLabel: 'Entrada' },
  { id: 'salida_colacion', label: 'Salida de colacion', shortLabel: 'Salida colacion' },
  { id: 'entrada_colacion', label: 'Entrada a colacion', shortLabel: 'Entrada colacion' },
  { id: 'salida', label: 'Salida', shortLabel: 'Salida' }
];

const WEEKLY_DAY_TYPES = [
  { id: 'rest', label: 'Descanso' },
  { id: 'leave', label: 'Licencia' },
  { id: 'vacation', label: 'Vacaciones' },
  { id: 'permit', label: 'Permiso' },
  { id: 'absence', label: 'Falta' }
];

function getAttendanceLabel(type) {
  return ATTENDANCE_TYPE_OPTIONS.find((option) => option.id === type)?.label || type;
}

function getAuditActionLabel(action) {
  const labels = {
    save_weekly_draft: 'Guardo borrador semanal',
    publish_weekly_schedule: 'Publico horario semanal',
    reopen_weekly_schedule: 'Abrio revision semanal',
    create_segmented_shift: 'Creo turno por tramos',
    assign_calendar_shift: 'Asigno turno en calendario',
    assign_area: 'Asigno area',
    assign_shift: 'Asigno turno fijo',
    bulk_assign_calendar_shift: 'Programo turnos del mes',
    change_password: 'Cambio clave',
    clear_calendar_month: 'Limpio calendario de turnos',
    create: 'Creo registro',
    create_manual_record: 'Creo marca manual',
    change_document: 'Corrigio documento',
    deactivate: 'Desactivo usuario',
    delete: 'Elimino registro',
    enable_access_code: 'Habilito clave de empleado',
    enable_mfa: 'Habilito autenticador',
    enroll_fingerprint: 'Registro anterior',
    regenerate: 'Genero codigos de respaldo',
    reactivate: 'Reactivo usuario',
    unassign_calendar_shift: 'Quito turno del calendario',
    unassign_shift: 'Quito turno fijo',
    update: 'Actualizo configuracion',
    update_role: 'Cambio rol',
    void: 'Anulo registro'
  };

  return labels[action] || action;
}

function getAuditEntityLabel(entityType) {
  const labels = {
    admin_user: 'administrador',
    attendance_record: 'marcacion',
    backup_codes: 'codigos de respaldo',
    employee: 'empleado',
    system_settings: 'sistema',
    work_shift: 'horario',
    shift_group: 'turno'
  };

  return labels[entityType] || entityType;
}

const TIME_ZONE_OPTIONS = [
  { country: 'Chile', timeZone: 'America/Santiago', label: 'Chile - Santiago' },
  { country: 'Argentina', timeZone: 'America/Argentina/Buenos_Aires', label: 'Argentina - Buenos Aires' },
  { country: 'Peru', timeZone: 'America/Lima', label: 'Peru - Lima' },
  { country: 'Colombia', timeZone: 'America/Bogota', label: 'Colombia - Bogota' },
  { country: 'Mexico', timeZone: 'America/Mexico_City', label: 'Mexico - Ciudad de Mexico' },
  { country: 'Estados Unidos', timeZone: 'America/New_York', label: 'Estados Unidos - Este' },
  { country: 'Estados Unidos', timeZone: 'America/Los_Angeles', label: 'Estados Unidos - Pacifico' },
  { country: 'Espana', timeZone: 'Europe/Madrid', label: 'Espana - Madrid' }
];

function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds)) {
    return '-';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

function formatMinutes(totalMinutes) {
  if (!Number.isFinite(totalMinutes)) {
    return '-';
  }

  const minutes = Math.max(0, Number(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${String(rest).padStart(2, '0')}m` : `${rest}m`;
}

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString() : '-';
}

function pairClassName(pairId) {
  if (!pairId) {
    return 'record-unpaired';
  }

  const pairNumber = Number(String(pairId).split('-').at(-1)) || 0;
  return `record-pair pair-${pairNumber % 6}`;
}

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

function currentWeekStartValue() {
  const date = new Date();
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function addDaysValue(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDateValue(dateValue) {
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString();
}

function formatWeeklyHours(totalMinutes) {
  const minutes = Math.max(0, Number(totalMinutes || 0));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours},${String(rest).padStart(2, '0')}` : String(hours);
}

function shiftMinutesFromTimes(startTime, endTime, breakMinutes = 0) {
  if (!startTime || !endTime) {
    return 0;
  }

  const [startHour, startMinute] = String(startTime).slice(0, 5).split(':').map(Number);
  const [endHour, endMinute] = String(endTime).slice(0, 5).split(':').map(Number);
  const start = startHour * 60 + startMinute;
  let end = endHour * 60 + endMinute;
  if (end <= start) {
    end += 24 * 60;
  }

  return Math.max(0, end - start - Number(breakMinutes || 0));
}

function buildCalendarCells(month) {
  const firstDay = new Date(`${month}-01T00:00:00`);
  const daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
  const leading = (firstDay.getDay() + 6) % 7;
  const cells = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, '0')}`);
  }
  return cells;
}

function toCsvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function getTokenExpiry(token) {
  if (!token) {
    return 0;
  }

  try {
    const payload = JSON.parse(window.atob(token.split('.')[1]));
    return Number(payload.exp || 0) * 1000;
  } catch {
    return 0;
  }
}

function App() {
  const [tokenState, setTokenState] = useState(() => {
    const savedToken = localStorage.getItem('token') || '';
    if (savedToken && getTokenExpiry(savedToken) <= Date.now()) {
      localStorage.removeItem('token');
      setToken('');
      return '';
    }
    setToken(savedToken);
    return savedToken;
  });
  const [view, setView] = useState(tokenState ? 'admin' : 'attendance');
  const [message, setMessage] = useState('');
  const [sessionPromptOpen, setSessionPromptOpen] = useState(false);
  const [sessionExpiry, setSessionExpiry] = useState(() => getTokenExpiry(tokenState));

  useEffect(() => {
    setToken(tokenState);
    setSessionExpiry(getTokenExpiry(tokenState));
  }, [tokenState]);

  useEffect(() => {
    registerAppServiceWorker().catch(() => {});
  }, []);

  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setMessage('');
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [message]);

  function onLogin(token) {
    localStorage.setItem('token', token);
    setTokenState(token);
    setView('admin');
  }

  async function flushPlannerDrafts() {
    const promises = [];
    window.dispatchEvent(
      new CustomEvent('attendance:before-logout', { detail: { promises } })
    );
    if (promises.length) await Promise.allSettled(promises);
  }

  async function logout() {
    await flushPlannerDrafts();
    localStorage.removeItem('token');
    setTokenState('');
    setView('attendance');
    setSessionPromptOpen(false);
  }

  async function goToAttendance() {
    await flushPlannerDrafts();
    setView('attendance');
  }

  useEffect(() => {
    if (!tokenState || !sessionExpiry) {
      return undefined;
    }

    const warningDelay = Math.max(0, sessionExpiry - Date.now() - (3 * 60 * 1000));
    const warningTimer = window.setTimeout(() => {
      setSessionPromptOpen(true);
    }, warningDelay);

    const forcedLogoutTimer = window.setTimeout(() => {
      logout().finally(() => {
        setMessage('La sesion administrativa se cerro al vencer su tiempo.');
      });
    }, Math.max(0, sessionExpiry - Date.now()));

    return () => {
      window.clearTimeout(warningTimer);
      window.clearTimeout(forcedLogoutTimer);
    };
  }, [tokenState, sessionExpiry]);

  async function keepSessionActive() {
    try {
      const result = await api('/auth/refresh-session', { method: 'POST' });
      localStorage.setItem('token', result.token);
      setTokenState(result.token);
      setSessionPromptOpen(false);
      setMessage('Sesion administrativa renovada.');
    } catch (error) {
      await logout();
      setMessage(error.message);
    }
  }

  return (
    <main className={`app-shell${view === 'admin' && tokenState ? ' app-shell-admin' : ''}`}>
      <div className="build-version-badge" aria-label={`Versión instalada ${appVersion}`}>
        v{appVersion}
      </div>
      {message && <div className="notice">{message}</div>}

      {sessionPromptOpen && (
        <section className="session-renewal-banner">
          <div>
            <strong>Tu sesion administrativa cerrara pronto.</strong>
            <span>¿Quieres mantener activa la sesión administrativa?</span>
          </div>
          <div className="session-renewal-actions">
            <button className="primary" type="button" onClick={keepSessionActive}>Mantener activa</button>
            <button type="button" onClick={logout}>Cerrar sesion</button>
          </div>
        </section>
      )}

      {view === 'attendance' && (
        <PublicWorkspace
          activeView="attendance"
          onShowAttendance={() => setView('attendance')}
          onShowAdmin={() => setView(tokenState ? 'admin' : 'login')}
          onLogout={tokenState ? logout : null}
          title="Asistencia"
          description="Marcación con QR personal o PIN de respaldo en una terminal autorizada."
        >
          <TokenKiosk setMessage={setMessage} />
        </PublicWorkspace>
      )}
      {view === 'login' && (
        <PublicWorkspace
          activeView="login"
          onShowAttendance={() => setView('attendance')}
          onShowAdmin={() => setView(tokenState ? 'admin' : 'login')}
          onLogout={tokenState ? logout : null}
          title="Acceso administrador"
          description="Ingreso seguro y recuperacion bajo demanda."
        >
          <Login onLogin={onLogin} setMessage={setMessage} />
        </PublicWorkspace>
      )}
      {view === 'admin' && tokenState && <AdminPanel setMessage={setMessage} onGoAttendance={goToAttendance} onLogout={logout} />}
      {view === 'admin' && !tokenState && (
        <PublicWorkspace
          activeView="login"
          onShowAttendance={() => setView('attendance')}
          onShowAdmin={() => setView('login')}
          onLogout={null}
          title="Acceso administrador"
          description="Ingreso seguro y recuperacion bajo demanda."
        >
          <Login onLogin={onLogin} setMessage={setMessage} />
        </PublicWorkspace>
      )}
    </main>
  );
}

function PublicWorkspace({ activeView, children, description, onLogout, onShowAdmin, onShowAttendance, title }) {
  return (
    <section className="public-shell">
      <aside className="admin-sidebar public-sidebar">
        <img className="sidebar-brand" src="/brand/red-taurus-sidebar.png" alt="Red Taurus Codex Asistencia" />
        <nav className="sidebar-nav">
          <p>Acceso</p>
          <button className={activeView === 'attendance' ? 'active' : ''} onClick={onShowAttendance}>
            <KeyRound size={18} /> Asistencia
          </button>
          <button className={activeView === 'login' ? 'active' : ''} onClick={onShowAdmin}>
            <Shield size={18} /> Administracion
          </button>
        </nav>
        <small className="app-version">Versión {appVersion}</small>
        {onLogout && (
          <div className="sidebar-footer-actions">
            <button type="button" onClick={onLogout}><LogOut size={18} /> Cerrar sesion</button>
          </div>
        )}
      </aside>
      <div className="public-main">
        <section className="module-heading">
          <div>
            <h1>{title}</h1>
          </div>
          <span>{description}</span>
        </section>
        <div className="public-content">
          {children}
        </div>
      </div>
    </section>
  );
}

function Login({ onLogin, setMessage }) {
  const [form, setForm] = useState({ username: 'admin', password: '' });
  const [recoveryForm, setRecoveryForm] = useState({ username: 'admin', otpCode: '', newPassword: '' });
  const [backupRecoveryForm, setBackupRecoveryForm] = useState({ username: 'admin', backupCode: '', newPassword: '' });
  const [showRecovery, setShowRecovery] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [connection, setConnection] = useState('checking');

  async function checkConnection() {
    setConnection('checking');
    try {
      const result = await api('/health');
      setConnection(result.service === 'attendance-fingerprint-api' ? 'ready' : 'offline');
    } catch { setConnection('offline'); }
  }

  useEffect(() => { checkConnection(); }, []);

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setLoginError('');
    try {
      const result = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      onLogin(result.token);
      setMessage(`Bienvenido, ${result.admin.fullName}`);
    } catch (error) {
      setLoginError(error.message);
      if (error.code === 'NETWORK_ERROR') setConnection('offline');
    } finally {
      setSubmitting(false);
    }
  }


  async function recoverWithAuthenticator(event) {
    event.preventDefault();
    try {
      await api('/auth/recover-password-otp', {
        method: 'POST',
        body: JSON.stringify(recoveryForm)
      });
      setRecoveryForm({ username: recoveryForm.username, otpCode: '', newPassword: '' });
      setMessage('Clave restablecida con autenticador. Ya puedes iniciar sesion.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function recoverWithBackupCode(event) {
    event.preventDefault();
    try {
      await api('/auth/recover-password-backup', {
        method: 'POST',
        body: JSON.stringify(backupRecoveryForm)
      });
      setBackupRecoveryForm({ username: backupRecoveryForm.username, backupCode: '', newPassword: '' });
      setMessage('Clave restablecida con codigo de respaldo. Ya puedes iniciar sesion.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="login-recovery-layout compact-login-layout">
      <form className="form-panel narrow login-primary-card" onSubmit={submit}>
        <h2><Shield size={22} /> Acceso administrador</h2>
        <p className="login-connection" role="status">{connection === 'checking' ? 'Comprobando conexión…' : connection === 'ready' ? 'Servidor de asistencia disponible' : 'Sin conexión con el servidor de asistencia'}</p>
        {connection === 'offline' && <button type="button" onClick={checkConnection}>Comprobar conexión</button>}
        {loginError && <p className="soft-alert" role="alert">{loginError}</p>}
        <label>Usuario<input autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
        <PressToRevealPassword label="Clave" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button className="primary" type="submit" disabled={submitting}><Shield size={18} /> {submitting ? 'Ingresando…' : 'Ingresar'}</button>
        <button type="button" onClick={() => setShowRecovery((current) => !current)}>
          {showRecovery ? 'Ocultar recuperacion' : 'Olvide mi clave'}
        </button>
      </form>

      {showRecovery && (
        <div className="login-recovery-options">
          <form className="form-panel narrow" onSubmit={recoverWithAuthenticator}>
            <h2><KeyRound size={20} /> Recuperar con Authenticator</h2>
            <label>Usuario<input value={recoveryForm.username} onChange={(e) => setRecoveryForm({ ...recoveryForm, username: e.target.value })} /></label>
            <label>Codigo Authenticator<input value={recoveryForm.otpCode} onChange={(e) => setRecoveryForm({ ...recoveryForm, otpCode: e.target.value })} inputMode="numeric" /></label>
            <PressToRevealPassword label="Nueva clave" autoComplete="new-password" value={recoveryForm.newPassword} onChange={(e) => setRecoveryForm({ ...recoveryForm, newPassword: e.target.value })} />
            <button type="submit">Restablecer con autenticador</button>
          </form>

          <form className="form-panel narrow" onSubmit={recoverWithBackupCode}>
            <h2><ShieldCheck size={20} /> Recuperar con respaldo</h2>
            <label>Usuario<input value={backupRecoveryForm.username} onChange={(e) => setBackupRecoveryForm({ ...backupRecoveryForm, username: e.target.value })} /></label>
            <label>Codigo respaldo<input value={backupRecoveryForm.backupCode} onChange={(e) => setBackupRecoveryForm({ ...backupRecoveryForm, backupCode: e.target.value })} /></label>
            <PressToRevealPassword label="Nueva clave" autoComplete="new-password" value={backupRecoveryForm.newPassword} onChange={(e) => setBackupRecoveryForm({ ...backupRecoveryForm, newPassword: e.target.value })} />
            <button type="submit">Restablecer con respaldo</button>
          </form>
        </div>
      )}
    </section>
  );
}

function AdminPanel({ setMessage, onGoAttendance, onLogout }) {
  const [adminModule, setAdminModule] = useState('dashboard');
  const adminRole = (() => { try { const token = localStorage.getItem('token'); return JSON.parse(window.atob(token.split('.')[1])).role || ''; } catch { return ''; } })();
  const canManageDocumentCatalog = adminRole === 'admin';
  const canAuditDocuments = ['admin', 'supervisor'].includes(adminRole);
  const [employees, setEmployees] = useState([]);
  const [userQuery,setUserQuery]=useState('');
  const [userResults,setUserResults]=useState([]);
  const [userResultsBusy,setUserResultsBusy]=useState(false);
  const [userRefresh,setUserRefresh]=useState(0);
  const [exportingWorkers, setExportingWorkers] = useState(false);
  const [records, setRecords] = useState([]);
  const [areas, setAreas] = useState([]);
  const [positions, setPositions] = useState([]);
  const [summary, setSummary] = useState({
    totalEmployees: 0,
    presentCount: 0,
    activeMeals: 0,
    openShifts: 0,
    completedShifts: 0,
    alerts: [],
    recentRecords: []
  });
  const [calendarData, setCalendarData] = useState({ month: currentMonthValue(), days: [] });
  const [calendarFilters, setCalendarFilters] = useState({ month: currentMonthValue(), employeeId: '' });
  const [expectedReportFilters, setExpectedReportFilters] = useState({ month: currentMonthValue(), employeeId: '' });
  const [expectedReport, setExpectedReport] = useState({
    month: currentMonthValue(),
    summary: {
      reportDays: 0,
      scheduledDays: 0,
      unplannedDays: 0,
      absentDays: 0,
      incompleteDays: 0,
      daysWithObservations: 0,
      totalLateMinutes: 0,
      totalMealMinutes: 0,
      justifiedDays: 0,
      totalMissingMinutes: 0,
      totalOvertimeMinutes: 0
    },
    items: []
  });
  const [adminUsers, setAdminUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [backupCodeStatus, setBackupCodeStatus] = useState({ totalCodes: 0, availableCodes: 0 });
  const [generatedBackupCodes, setGeneratedBackupCodes] = useState([]);
  const [backupCodePassword, setBackupCodePassword] = useState('');
  const [adminUserForm, setAdminUserForm] = useState({ username: '', fullName: '', password: '', role: 'supervisor' });
  const [confirmAdminUserPassword, setConfirmAdminUserPassword] = useState('');
  const [scheduleData, setScheduleData] = useState({ groups: [], shifts: [], assignments: [] });
  const [shiftForm, setShiftForm] = useState({ name: '', groupId: '', startTime: '08:00', endTime: '17:00', breakMinutes: 30 });
  const [schedulePlanner, setSchedulePlanner] = useState({ employeeId: '', month: currentMonthValue(), selectedShiftId: '' });
  const [scheduleCalendar, setScheduleCalendar] = useState({ employeeId: '', month: currentMonthValue(), days: [] });
  const [weeklyPlanner, setWeeklyPlanner] = useState({ weekStart: currentWeekStartValue() });
  const [weeklyBoards, setWeeklyBoards] = useState([]);
  const [weeklyDraft, setWeeklyDraft] = useState({});
  const [weeklySaving, setWeeklySaving] = useState(false);
  const [settings, setSettings] = useState({
    timeMode: 'auto',
    country: 'Chile',
    timeZone: 'America/Santiago',
    manualUtcOffset: '-03:00',
    companyName: 'Red Taurus Codex Asistencia',
    companyTagline: 'Control de asistencia y permanencia',
    workdayTargetHours: '8',
    lateToleranceMinutes: '10'
  });
  const [notificationStatus, setNotificationStatus] = useState({
    enabled: false,
    activeSubscriptions: 0,
    browserPermission: 'unsupported',
    hasLocalSubscription: false
  });
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ documentId: '', fullName: '', email: '', positionName: '', workAreaId: '' });
  const [areaForm, setAreaForm] = useState({ name: '', description: '' });
  const [positionForm, setPositionForm] = useState({ name: '', description: '' });
  const [deleteBlock, setDeleteBlock] = useState(null);
  const [workerNavigation, setWorkerNavigation] = useState({id:null,seq:0});
  const [manualRecord, setManualRecord] = useState({ employeeId: '', type: 'entrada', registeredAt: '', reason: '' });
  const [recordFilters, setRecordFilters] = useState({ employeeId: '', from: '', to: '', type: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', otpCode: '', newPassword: '', confirmPassword: '' });
  const [authenticatorStatus, setAuthenticatorStatus] = useState({ enabled: false });
  const [authenticatorSetup, setAuthenticatorSetup] = useState({ currentPassword: '', code: '', secret: '', qrCodeDataUrl: '' });

  async function loadEmployees() {
    const employeeResult = await api('/employees?includeInactive=1');
    setEmployees(employeeResult.employees);
    setUserRefresh(n=>n+1);
  }

  async function downloadWorkers(format) {
    if (adminRole !== 'admin' || exportingWorkers) return;
    setExportingWorkers(true);
    try {
      // Se consulta el padrón completo, sin limitarlo a la búsqueda visible.
      const result = await api('/employees?includeInactive=1');
      const { blob, filename } = createEmployeeExport(result.employees, format, 'sagva-laboral');
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      }
      setMessage('Archivo preparado: ' + filename + ' (' + result.employees.length + ' trabajadores).');
    } catch (error) {
      setMessage('No fue posible exportar trabajadores: ' + error.message);
    } finally {
      setExportingWorkers(false);
    }
  }


  useEffect(()=>{
    if(adminModule!=='users')return undefined;
    const q=userQuery.trim();
    if(q.length<2){setUserResults([]);setUserResultsBusy(false);return undefined;}
    let active=true;
    setUserResultsBusy(true);
    const timer=setTimeout(()=>{
      api('/employees?includeInactive=1&onlySearch=1&q='+encodeURIComponent(q))
        .then(result=>{if(active)setUserResults(result.employees);})
        .catch(error=>{if(active)setMessage(error.message);})
        .finally(()=>{if(active)setUserResultsBusy(false);});
    },300);
    return ()=>{active=false;clearTimeout(timer);};
  },[adminModule,userQuery,userRefresh]);

  async function loadAreas() {
    const result = await api('/areas?includeInactive=1');
    setAreas(result.areas);
  }

  async function loadPositions() {
    const result = await api('/positions?includeInactive=1');
    setPositions(result.positions);
  }
  async function loadRecords(filters = recordFilters) {
    const query = new URLSearchParams();
    if (filters.employeeId) query.set('employeeId', filters.employeeId);
    if (filters.from) query.set('from', filters.from);
    if (filters.to) query.set('to', filters.to);
    if (filters.type) query.set('type', filters.type);

    const recordResult = await api(`/attendance/records${query.toString() ? `?${query.toString()}` : ''}`);
    setRecords(recordResult.records);
  }

  async function loadSettings() {
    const settingsResult = await api('/settings');
    setSettings(settingsResult.settings);
  }

  async function loadSummary() {
    const result = await api('/attendance/summary');
    setSummary(result.summary);
  }

  async function loadCalendar(filters = calendarFilters) {
    const query = new URLSearchParams();
    if (filters.month) query.set('month', filters.month);
    if (filters.employeeId) query.set('employeeId', filters.employeeId);
    const result = await api(`/attendance/calendar?${query.toString()}`);
    setCalendarData(result);
  }

  async function loadExpectedReport(filters = expectedReportFilters) {
    const query = new URLSearchParams();
    if (filters.month) query.set('month', filters.month);
    if (filters.employeeId) query.set('employeeId', filters.employeeId);
    const result = await api(`/attendance/expected-report?${query.toString()}`);
    setExpectedReport(result);
  }

  async function loadAdminUsers() {
    const result = await api('/admin/users');
    setAdminUsers(result.users);
  }

  async function loadAuditLogs() {
    const result = await api('/admin/audit');
    setAuditLogs(result.logs);
  }

  async function loadBackupCodeStatus() {
    const result = await api('/admin/backup-codes/status');
    setBackupCodeStatus(result);
  }

  async function loadSchedules() {
    const result = await api('/schedules');
    setScheduleData(result);
    setShiftForm((current) => {
      if (current.groupId || !result.groups?.length) return current;
      const rotativo = result.groups.find((group) => group.name === 'Rotativo') || result.groups[0];
      return { ...current, groupId: String(rotativo.id) };
    });
  }

  async function loadScheduleCalendar(planner = schedulePlanner) {
    if (!planner.employeeId) {
      setScheduleCalendar({ employeeId: '', month: planner.month, days: [] });
      return;
    }

    const query = new URLSearchParams({
      employeeId: planner.employeeId,
      month: planner.month
    });
    const result = await api(`/schedules/calendar?${query.toString()}`);
    setScheduleCalendar(result);
  }

  async function loadWeeklySchedule(planner = weeklyPlanner) {
    const enabledAreas = areas.filter((area) => area.isActive);
    if (!enabledAreas.length) {
      setWeeklyBoards([]);
      setWeeklyDraft({});
      return;
    }

    const weekStarts = [planner.weekStart];
    const boards = await Promise.all(weekStarts.map(async (weekStart) => {
      const areaSchedules = await Promise.all(enabledAreas.map(async (area) => {
        const query = new URLSearchParams({
          areaId: String(area.id),
          weekStart
        });
        return api(`/schedules/weekly?${query.toString()}`);
      }));

      return {
        weekStart,
        dates: areaSchedules[0]?.dates || [],
        areas: areaSchedules
      };
    }));
    setWeeklyBoards(boards);
    setWeeklyDraft({});
  }


  async function loadNotificationStatus() {
    const status = await getPushStatus();
    setNotificationStatus(status);
  }

  async function loadAuthenticatorStatus() {
    const status = await api('/auth/mfa/status');
    setAuthenticatorStatus(status);
  }

  async function loadData(filters = recordFilters) {
    setLoading(true);
    try {
      await Promise.all([
        loadEmployees(),
        loadAreas(),
        loadPositions(),
        loadRecords(filters),
        loadSettings(),
        loadNotificationStatus(),
        loadAuthenticatorStatus(),
        loadSummary(),
        loadCalendar(),
        loadExpectedReport(),
        loadAdminUsers(),
        loadAuditLogs(),
        loadBackupCodeStatus(),
        loadSchedules()
      ]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData().catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    loadScheduleCalendar(schedulePlanner).catch((error) => setMessage(error.message));
  }, [schedulePlanner.employeeId, schedulePlanner.month]);



  async function createEmployee(event) {
    event.preventDefault();
    try {
      await api('/employees', { method: 'POST', body: JSON.stringify(form) });
      setForm({ documentId: '', fullName: '', email: '', positionName: '', workAreaId: '' });
      await loadData();
      setMessage('Empleado creado');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function permanentlyDelete(kind, item) {
    const isArea = kind === 'area';
    const singular = isArea ? 'área' : 'cargo';
    const resource = isArea ? 'areas' : 'positions';
    setDeleteBlock(null);
    if (!window.confirm(`¿Eliminar definitivamente ${singular} "${item.name}"? No se puede deshacer. Solo se permite si no tiene trabajadores asignados ni referencias históricas protegidas.`)) return;
    try {
      await api(`/${resource}/${item.id}/permanent`, {method:'DELETE'});
      await Promise.all([loadEmployees(), isArea ? loadAreas() : loadPositions()]);
      setMessage(`Se eliminó el ${singular} "${item.name}".`);
    } catch(error) {
      if (error.status === 409 && error.assignedEmployees?.length) {
        setDeleteBlock({kind, item, employees:error.assignedEmployees, message:error.message});
      } else {
        setMessage(error.message);
      }
    }
  }
  function goToAssignedWorker(worker) {
    setDeleteBlock(null);
    setAdminModule('employeeFile');
    setWorkerNavigation(current=>({id:worker.id,seq:current.seq+1}));
  }
  async function createArea(event) {
    event.preventDefault();
    try {
      await api('/areas', { method: 'POST', body: JSON.stringify(areaForm) });
      setAreaForm({ name: '', description: '' });
      await loadAreas();
      await loadEmployees();
      setMessage('Area creada');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function editArea(area) {
    const name = window.prompt('Nombre del area', area.name);
    if (!name || name.trim().length < 2) {
      setMessage('Debes indicar un nombre valido');
      return;
    }

    const description = window.prompt('Descripcion del area', area.description || '') || '';
    try {
      await api(`/areas/${area.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim(), description: description.trim() })
      });
      await loadAreas();
      setMessage('Area actualizada');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deactivateArea(area) {
    const reason = window.prompt(`Motivo para desactivar ${area.name}`);
    if (!reason || reason.trim().length < 5) {
      setMessage('Debes indicar un motivo de al menos 5 caracteres');
      return;
    }

    try {
      await api(`/areas/${area.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason: reason.trim() })
      });
      await loadAreas();
      setMessage('Area desactivada sin borrar historial');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function reactivateArea(area) {
    try {
      await api(`/areas/${area.id}/reactivate`, { method: 'POST' });
      await loadAreas();
      setMessage('Area reactivada');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createPosition(event) {
    event.preventDefault();
    try {
      await api('/positions',{method:'POST',body:JSON.stringify(positionForm)});
      setPositionForm({name:'',description:''});
      await loadPositions();
      setMessage('Cargo creado');
    } catch(error) {setMessage(error.message);}
  }
  async function editPosition(position) {
    const name=window.prompt('Nombre del cargo',position.name);
    if(name===null) return;
    const description=window.prompt('Descripción del cargo',position.description||'');
    if(description===null) return;
    try {
      await api(`/positions/${position.id}`,{method:'PUT',body:JSON.stringify({name,description})});
      await Promise.all([loadPositions(),loadEmployees()]);
      setMessage('Cargo actualizado');
    } catch(error) {setMessage(error.message);}
  }
  async function deactivatePosition(position) {
    const reason=window.prompt(`Motivo para desactivar ${position.name}`);
    if(reason===null) return;
    try {
      await api(`/positions/${position.id}`,{method:'DELETE',body:JSON.stringify({reason})});
      await loadPositions();
      setMessage('Cargo desactivado; se mantienen las asignaciones');
    } catch(error) {setMessage(error.message);}
  }
  async function reactivatePosition(position) {
    try {
      await api(`/positions/${position.id}/reactivate`,{method:'POST'});
      await loadPositions();
      setMessage('Cargo reactivado');
    } catch(error) {setMessage(error.message);}
  }
  async function assignEmployeeArea(employee, workAreaId) {
    try {
      await api(`/employees/${employee.id}/area`, {
        method: 'PUT',
        body: JSON.stringify({ workAreaId: workAreaId || null })
      });
      await loadEmployees();
      await loadAreas();
      setMessage(workAreaId ? `Area asignada a ${employee.fullName}` : `Area quitada a ${employee.fullName}`);
    } catch (error) {
      setMessage(error.message);
    }
  }


  async function deleteEmployee(employee) {
    const confirmed = window.confirm(
      `Desactivar a ${employee.fullName}? No se borrara su historial de asistencia.`
    );

    if (!confirmed) {
      return;
    }

    const reason = window.prompt('Motivo de desactivacion del empleado');
    if (!reason || reason.trim().length < 5) {
      setMessage('Debes indicar un motivo de al menos 5 caracteres');
      return;
    }

    try {
      await api(`/employees/${employee.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason: reason.trim() })
      });
      await loadData();
      setMessage('Empleado desactivado sin borrar historial');
    } catch (error) {
      setMessage(error.message);
    }
  }


  async function deleteAttendanceRecord(record) {
    const confirmed = window.confirm(
      `Anular marca de ${record.fullName}: ${getAttendanceLabel(record.type)} del ${new Date(record.registeredAt).toLocaleString()}?`
    );

    if (!confirmed) {
      return;
    }

    const reason = window.prompt('Motivo de anulacion de la marca');
    if (!reason || reason.trim().length < 5) {
      setMessage('Debes indicar un motivo de al menos 5 caracteres');
      return;
    }

    try {
      await api(`/attendance/records/${record.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason: reason.trim() })
      });
      await loadRecords();
      await loadExpectedReport();
      setMessage('Marca anulada');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createManualRecord(event) {
    event.preventDefault();

    try {
      await api('/attendance/records/manual', {
        method: 'POST',
        body: JSON.stringify(manualRecord)
      });
      setManualRecord({ employeeId: '', type: 'entrada', registeredAt: '', reason: '' });
      await loadRecords();
      await loadExpectedReport();
      setMessage('Marca manual creada');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function applyRecordFilters(event) {
    event.preventDefault();
    await loadRecords(recordFilters);
  }

  async function clearRecordFilters() {
    const emptyFilters = { employeeId: '', from: '', to: '', type: '' };
    setRecordFilters(emptyFilters);
    await loadRecords(emptyFilters);
  }

  async function saveSettings(event) {
    event.preventDefault();

    try {
      const selectedZone = TIME_ZONE_OPTIONS.find((option) => option.timeZone === settings.timeZone);
      const payload = {
        ...settings,
        country: selectedZone?.country || settings.country
      };
      const result = await api('/settings', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      setSettings(result.settings);
      setMessage('Configuracion de sistema guardada');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function changeAdminPassword(event) {
    event.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage('La confirmacion de la nueva clave no coincide');
      return;
    }

    try {
      await api('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword || undefined,
          otpCode: passwordForm.otpCode || undefined,
          newPassword: passwordForm.newPassword
        })
      });
      setPasswordForm({ currentPassword: '', otpCode: '', newPassword: '', confirmPassword: '' });
      setMessage('Clave de administrador actualizada');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function beginAuthenticatorSetup(event) {
    event.preventDefault();
    try {
      const result = await api('/auth/mfa/setup', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: authenticatorSetup.currentPassword })
      });
      setAuthenticatorSetup({
        ...authenticatorSetup,
        secret: result.secret,
        qrCodeDataUrl: result.qrCodeDataUrl
      });
      setMessage('Escanea el QR y confirma el codigo de 6 digitos');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function confirmAuthenticatorSetup(event) {
    event.preventDefault();
    try {
      await api('/auth/mfa/confirm', {
        method: 'POST',
        body: JSON.stringify({ code: authenticatorSetup.code })
      });
      setAuthenticatorSetup({ currentPassword: '', code: '', secret: '', qrCodeDataUrl: '' });
      await loadAuthenticatorStatus();
      setMessage('Google Authenticator habilitado para el admin');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function activatePushNotifications() {
    try {
      await enablePushNotifications();
      await loadNotificationStatus();
      setMessage('Notificaciones activadas en este dispositivo');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deactivatePushNotifications() {
    try {
      await disablePushNotifications();
      await loadNotificationStatus();
      setMessage('Notificaciones desactivadas en este dispositivo');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createAdminUser(event) {
    event.preventDefault();
    if (adminUserForm.password !== confirmAdminUserPassword) {
      setMessage('La clave inicial y su confirmacion no coinciden');
      return;
    }
    try {
      await api('/admin/users', {
        method: 'POST',
        body: JSON.stringify(adminUserForm)
      });
      setAdminUserForm({ username: '', fullName: '', password: '', role: 'supervisor' });
      setConfirmAdminUserPassword('');
      await Promise.all([loadAdminUsers(), loadAuditLogs()]);
      setMessage('Usuario administrativo creado');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function changeAdminRole(userId, role) {
    try {
      await api(`/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role })
      });
      await Promise.all([loadAdminUsers(), loadAuditLogs()]);
      setMessage('Rol actualizado');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function reactivateEmployee(employee) {
    const reason = window.prompt(`Motivo para reactivar a ${employee.fullName}`);
    if (!reason || reason.trim().length < 5) {
      setMessage('Debes indicar un motivo de al menos 5 caracteres');
      return;
    }

    try {
      await api(`/employees/${employee.id}/reactivate`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() })
      });
      await loadData();
      setMessage('Empleado reactivado con su historial');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function changeEmployeeDocument(employee) {
    const documentId = window.prompt(`Nuevo documento/RUT para ${employee.fullName}`, employee.documentId);
    if (!documentId || documentId.trim().length < 3 || documentId.trim() === employee.documentId) {
      setMessage('Debes indicar un documento nuevo valido');
      return;
    }

    const reason = window.prompt('Motivo de correccion del documento');
    if (!reason || reason.trim().length < 5) {
      setMessage('Debes indicar un motivo de al menos 5 caracteres');
      return;
    }

    try {
      await api(`/employees/${employee.id}/document`, {
        method: 'PUT',
        body: JSON.stringify({ documentId: documentId.trim(), reason: reason.trim() })
      });
      await loadData();
      setMessage('Documento corregido conservando su historial');
    } catch (error) {
      setMessage(error.message);
    }
  }


  async function generateBackupCodes(event) {
    event.preventDefault();
    try {
      const result = await api('/admin/backup-codes', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: backupCodePassword })
      });
      setGeneratedBackupCodes(result.codes);
      setBackupCodePassword('');
      await Promise.all([loadBackupCodeStatus(), loadAuditLogs()]);
      setMessage('Codigos de respaldo generados');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createShift(event) {
    event.preventDefault();
    try {
      await api('/schedules/shifts', {
        method: 'POST',
        body: JSON.stringify(shiftForm)
      });
      setShiftForm((current) => ({ name: '', groupId: current.groupId, startTime: '08:00', endTime: '17:00', breakMinutes: 30 }));
      await loadSchedules();
      await loadScheduleCalendar();
      setMessage('Turno creado');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function assignShift(employeeId, shiftId) {
    try {
      await api(`/schedules/employees/${employeeId}`, {
        method: 'PUT',
        body: JSON.stringify({ shiftId: shiftId ? Number(shiftId) : null })
      });
      await loadSchedules();
      setMessage(shiftId ? 'Turno asignado' : 'Turno quitado');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteShift(shift) {
    const confirmed = window.confirm(`Eliminar el turno ${shift.name}?`);
    if (!confirmed) {
      return;
    }

    try {
      await api(`/schedules/shifts/${shift.id}`, { method: 'DELETE' });
      await loadSchedules();
      await loadScheduleCalendar();
      setMessage('Turno eliminado');
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function assignCalendarShift(workDate, shiftId) {
    if (!schedulePlanner.employeeId) {
      setMessage('Selecciona un usuario para programar turnos');
      return;
    }

    try {
      await api(`/schedules/calendar/${schedulePlanner.employeeId}`, {
        method: 'PUT',
        body: JSON.stringify({ workDate, shiftId: shiftId ? Number(shiftId) : null })
      });
      await loadScheduleCalendar();
      setMessage(shiftId ? 'Turno programado' : 'Turno quitado del dia');
    } catch (error) {
      setMessage(error.message);
    }
  }

  function buildWeeklyPayload(workDate, value) {
    const [kind, id] = String(value || '').split(':');
    return !value
      ? { workDate, dayType: null, shiftId: null }
      : kind === 'shift'
        ? { workDate, dayType: 'work', shiftId: Number(id) }
        : { workDate, dayType: kind, shiftId: null };
  }

  function assignWeeklyDay(employee, workDate, value) {
    setWeeklyDraft((current) => ({
      ...current,
      [`${employee.id}|${workDate}`]: value
    }));
  }

  async function saveWeeklySchedule() {
    const changes = Object.entries(weeklyDraft);
    if (!changes.length) {
      setMessage('No hay cambios pendientes para guardar');
      return;
    }

    setWeeklySaving(true);
    try {
      for (const [key, value] of changes) {
        const [employeeId, workDate] = key.split('|');
        await api(`/schedules/weekly/${employeeId}`, {
          method: 'PUT',
          body: JSON.stringify(buildWeeklyPayload(workDate, value))
        });
      }

      await loadWeeklySchedule();
      await loadScheduleCalendar();
      setMessage(`${changes.length} cambios guardados en horario semanal`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWeeklySaving(false);
    }
  }

  async function applyBulkSchedule(mode, shiftId = schedulePlanner.selectedShiftId) {
    if (!schedulePlanner.employeeId) {
      setMessage('Selecciona un usuario para programar turnos');
      return;
    }

    if (!shiftId) {
      setMessage('Selecciona un turno para aplicar al calendario');
      return;
    }

    try {
      const result = await api('/schedules/calendar/bulk', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: Number(schedulePlanner.employeeId),
          month: schedulePlanner.month,
          shiftId: Number(shiftId),
          mode
        })
      });
      await loadScheduleCalendar();
      setMessage(`${result.affectedDays} dias programados`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function clearBulkSchedule(mode) {
    if (!schedulePlanner.employeeId) {
      setMessage('Selecciona un usuario para limpiar el calendario');
      return;
    }

    try {
      const result = await api('/schedules/calendar/bulk', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: Number(schedulePlanner.employeeId),
          month: schedulePlanner.month,
          shiftId: null,
          mode
        })
      });
      await loadScheduleCalendar();
      setMessage(`${result.affectedDays} dias limpiados`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function applyCalendarFilters(event) {
    event.preventDefault();
    await loadCalendar(calendarFilters);
  }

  async function applyExpectedReportFilters(event) {
    event.preventDefault();
    await loadExpectedReport(expectedReportFilters);
  }

  function exportRecordsCsv() {
    const rows = [
      ['Fecha', 'Empleado', 'Documento', 'Tipo', 'Turno programado', 'Atraso min', 'Permanencia efectiva', 'Colacion'],
      ...records.map((record) => [
        new Date(record.registeredAt).toLocaleString(),
        record.fullName,
        record.documentId,
        getAttendanceLabel(record.type),
        record.shiftName ? `${record.shiftName} ${record.scheduleLabel || `${record.scheduledStart}-${record.scheduledEnd}`}` : '',
        record.lateMinutes ?? '',
        record.type === 'salida' ? formatDuration(record.durationSeconds) : '',
        record.type === 'salida' ? formatDuration(record.deductedMealSeconds) : formatDuration(record.mealDurationSeconds)
      ])
    ];
    const csv = rows.map((row) => row.map(toCsvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte-marcaciones-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function printRecordsReport() {
    const reportWindow = window.open('', '_blank', 'width=1280,height=860');
    if (!reportWindow) {
      setMessage('El navegador bloqueo la ventana de impresion');
      return;
    }

    const escapeHtml = (value) => String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

    const statusLabels = {
      complete: 'Completo',
      with_observations: 'Con observacion',
      incomplete: 'Incompleto',
      absent: 'Ausente',
      unplanned: 'Sin turno',
      no_shift: 'Sin programacion',
      rest: 'Descanso',
      leave: 'Licencia',
      vacation: 'Vacaciones',
      permit: 'Permiso',
      absence: 'Falta'
    };

    const rows = expectedReport.items.map((item) => `
      <tr>
        <td>${escapeHtml(item.workDate)}</td>
        <td>${escapeHtml(item.fullName)}</td>
        <td>${escapeHtml(item.documentId)}</td>
        <td>${escapeHtml(item.shiftName ? `${item.shiftName} ${item.scheduleLabel || `${item.scheduledStart}-${item.scheduledEnd}`}` : 'Sin turno')}</td>
        <td>${escapeHtml(formatTime(item.firstEntry))}</td>
        <td>${escapeHtml(formatTime(item.mealStart))}</td>
        <td>${escapeHtml(formatTime(item.mealEnd))}</td>
        <td>${escapeHtml(formatTime(item.lastExit))}</td>
        <td>${escapeHtml(item.lateMinutes ? `${item.lateMinutes} min` : '-')}</td>
        <td>${escapeHtml(item.earlyLeaveMinutes ? `${item.earlyLeaveMinutes} min` : '-')}</td>
        <td>${escapeHtml(formatMinutes(item.actualMinutes))}</td>
        <td>${escapeHtml(formatMinutes(item.mealMinutes))}</td>
        <td>${escapeHtml(statusLabels[item.status] || item.status || '-')}</td>
      </tr>
    `).join('');

    reportWindow.document.write(`
      <html>
        <head>
          <title>Reporte Red Taurus Codex Asistencia</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; margin: 0; color: #17211f; font-size: 10px; }
            h1 { margin: 0 0 3px; font-size: 18px; }
            p { color: #52615e; margin: 0; }
            .header { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; border-bottom: 2px solid #17211f; padding-bottom: 8px; margin-bottom: 10px; }
            .meta { text-align: right; line-height: 1.45; min-width: 220px; }
            .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin: 10px 0; }
            .summary div { border: 1px solid #d9e1df; padding: 6px; border-radius: 4px; }
            .summary span { display: block; color: #52615e; font-size: 8px; text-transform: uppercase; }
            .summary strong { font-size: 12px; }
            table { border-collapse: collapse; width: 100%; table-layout: fixed; }
            th, td { border: 1px solid #d9e1df; padding: 4px 3px; text-align: left; vertical-align: top; word-break: break-word; }
            th { background: #eef4f2; font-size: 8px; text-transform: uppercase; }
            td { font-size: 8.5px; }
            .empty { text-align: center; padding: 18px; color: #52615e; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>${escapeHtml(settings.companyName)}</h1>
              <p>Reporte esperado vs real</p>
            </div>
            <div class="meta">
              <div>Mes: ${escapeHtml(expectedReport.month || expectedReportFilters.month)}</div>
              <div>Generado: ${escapeHtml(new Date().toLocaleString())}</div>
            </div>
          </div>
          <section class="summary">
            <div><span>Dias</span><strong>${escapeHtml(expectedReport.summary.reportDays ?? expectedReport.items.length)}</strong></div>
            <div><span>Programados</span><strong>${escapeHtml(expectedReport.summary.scheduledDays || 0)}</strong></div>
            <div><span>Ausencias</span><strong>${escapeHtml(expectedReport.summary.absentDays || 0)}</strong></div>
            <div><span>Atrasos</span><strong>${escapeHtml(formatMinutes(expectedReport.summary.totalLateMinutes))}</strong></div>
            <div><span>Colacion</span><strong>${escapeHtml(formatMinutes(expectedReport.summary.totalMealMinutes))}</strong></div>
          </section>
          <table>
            <thead><tr><th>Fecha</th><th>Empleado</th><th>Doc.</th><th>Turno</th><th>Ent.</th><th>Sal. col.</th><th>Ent. col.</th><th>Sal.</th><th>Atraso</th><th>Sal. ant.</th><th>Real</th><th>Colacion</th><th>Estado</th></tr></thead>
            <tbody>${rows || '<tr><td class="empty" colspan="13">No hay datos calculados para imprimir.</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  }

  const recordInsights = useMemo(() => {
    const workedSeconds = records
      .filter((record) => record.type === 'salida')
      .reduce((total, record) => total + Number(record.durationSeconds || 0), 0);
    const mealSeconds = records
      .filter((record) => record.type === 'salida')
      .reduce((total, record) => total + Number(record.deductedMealSeconds || 0), 0);
    const openPairs = records.filter((record) => !record.pairId || record.type === 'entrada').length;
    return {
      workedSeconds,
      mealSeconds,
      openPairs,
      totalRecords: records.length
    };
  }, [records]);

  const calendarCells = useMemo(() => buildCalendarCells(calendarFilters.month), [calendarFilters.month]);
  const calendarDayMap = useMemo(() => new Map(calendarData.days.map((day) => [day.date, day])), [calendarData.days]);
  const moduleMeta = {
    dashboard: ['Resumen diario', 'Estado operativo de asistencia y alertas.'],
    users: ['Usuarios', 'Trabajadores, QR personal y PIN de respaldo.'],
    employeeFile: ['Ficha del trabajador', 'Datos personales y laborales guardados, con revisión pendiente o validada.'],
    areas: ['Áreas', 'Grupos operativos para organizar personal y cobertura.'],
    positions: ['Cargos', 'Catálogo de cargos laborales, sin escritura manual en fichas.'],
    companies: ['Empresas', 'Razón social, representante legal y valores laborales sugeridos.'],
    documents: ['Documentos', 'Catálogo laboral, vigencias y documentos aplicables a los trabajadores.'],
    documentAudit: ['Auditoría documental', 'Detección preventiva de faltantes, datos incompletos y fechas que requieren revisión.'],
    shifts: ['Turnos', 'Biblioteca central de horarios organizada por grupo.'],
    records: ['Marcaciones', 'Consulta, correccion y permanencia efectiva.'],
    reports: ['Reportes', 'Exportacion y lectura ejecutiva de asistencia.'],
    calendar: ['Calendario', 'Revision mensual por empleado o grupo.'],
    weekly: ['Horario semanal', 'Planificacion visual por area y cobertura.'],
    security: ['Seguridad', 'Claves, recuperacion, roles e historial.'],
    system: ['Sistema', 'Configuracion horaria, empresa y dispositivos.'],
    notifications: ['Notificaciones', 'Avisos y estado de suscripciones.'],
    updates: ['Horarios', 'Catalogo de turnos y asignacion por usuario.']
  };
  const [moduleTitle, moduleDescription] = moduleMeta[adminModule] || moduleMeta.dashboard;
  const scheduleDayByDate = new Map(scheduleCalendar.days.map((day) => [day.date, day]));
  const activeEmployees = employees.filter((employee) => employee.isActive);
  const activeAreas = areas.filter((area) => area.isActive);
  const activePositions = positions.filter((position) => position.isActive);
  const pendingWeeklyChanges = Object.keys(weeklyDraft).length;

  function getWeeklyDayValue(employeeId, day) {
    const key = `${employeeId}|${day.workDate}`;
    if (Object.prototype.hasOwnProperty.call(weeklyDraft, key)) {
      return weeklyDraft[key];
    }

    return day.dayType === 'work' && day.shiftId
      ? `shift:${day.shiftId}`
      : day.dayType || '';
  }

  function resolveWeeklyDay(employeeId, day) {
    const value = getWeeklyDayValue(employeeId, day);
    if (!value) {
      return { ...day, dayType: null, shiftId: null, shiftName: null, startTime: null, endTime: null, minutes: 0 };
    }

    const [kind, id] = String(value).split(':');
    if (kind === 'shift') {
      const shift = scheduleData.shifts.find((item) => String(item.id) === String(id));
      return {
        ...day,
        dayType: 'work',
        shiftId: Number(id),
        shiftName: shift?.name || day.shiftName,
        startTime: shift?.startTime || day.startTime,
        endTime: shift?.endTime || day.endTime,
        breakMinutes: Number(shift?.breakMinutes || day.breakMinutes || 0),
        minutes: shift ? shiftMinutesFromTimes(shift.startTime, shift.endTime, shift.breakMinutes) : Number(day.minutes || 0)
      };
    }

    return { ...day, dayType: kind, shiftId: null, shiftName: null, startTime: null, endTime: null, minutes: 0 };
  }

  function getAreaAssignedCount(areaSchedule, date) {
    return areaSchedule.employees.filter((employee) => {
      const day = employee.days.find((item) => item.workDate === date);
      const resolved = day ? resolveWeeklyDay(employee.id, day) : null;
      return resolved?.dayType === 'work' && resolved.shiftId;
    }).length;
  }


  return (
    <section className="admin-shell">
      <aside className="admin-sidebar">
        <img className="sidebar-brand" src="/brand/red-taurus-sidebar.png" alt="Red Taurus Codex Asistencia" />
        <nav className="sidebar-nav">
          <p>Principal</p>
          <button className={adminModule === 'dashboard' ? 'active' : ''} onClick={() => setAdminModule('dashboard')}>
            <BarChart3 size={18} /> Resumen
          </button>
          <button className={adminModule === 'users' ? 'active' : ''} onClick={() => setAdminModule('users')}>
            <Users size={18} /> Usuarios
          </button>
          <button className={adminModule === 'employeeFile' ? 'active' : ''} onClick={() => setAdminModule('employeeFile')}>
            <FileText size={18} /> Ficha del trabajador
          </button>
          {canManageDocumentCatalog && <button className={adminModule === 'companies' ? 'active' : ''} onClick={() => setAdminModule('companies')}>
            <Building2 size={18}/> Empresas
          </button>}
          <button className={adminModule === 'areas' ? 'active' : ''} onClick={() => setAdminModule('areas')}>
            <Building2 size={18} /> Áreas
          </button>
          <button className={adminModule === 'positions' ? 'active' : ''} onClick={() => setAdminModule('positions')}>
            <BriefcaseBusiness size={18} /> Cargos
          </button>
          {canManageDocumentCatalog && <button className={adminModule === 'documents' ? 'active' : ''} onClick={() => setAdminModule('documents')}>
            <FileText size={18} /> Documentos
          </button>}
          {canAuditDocuments && <button className={adminModule === 'documentAudit' ? 'active' : ''} onClick={() => setAdminModule('documentAudit')}>
            <ShieldCheck size={18} /> Auditoría documental
          </button>}
          <button className={adminModule === 'shifts' ? 'active' : ''} onClick={() => setAdminModule('shifts')}>
            <Clock size={18} /> Turnos
          </button>
          <p>Marcaciones</p>
          <button className={adminModule === 'records' ? 'active' : ''} onClick={() => setAdminModule('records')}>
            <Clock size={18} /> Marcaciones
          </button>
          <button className={adminModule === 'calendar' ? 'active' : ''} onClick={() => setAdminModule('calendar')}>
            <CalendarDays size={18} /> Calendario
          </button>
          <button className={adminModule === 'weekly' ? 'active' : ''} onClick={() => setAdminModule('weekly')}>
            <CalendarDays size={18} /> Armar horario
          </button>
          <p>Gestion</p>
          <button className={adminModule === 'reports' ? 'active' : ''} onClick={() => setAdminModule('reports')}>
            <FileText size={18} /> Reportes
          </button>
          <button className={adminModule === 'security' ? 'active' : ''} onClick={() => setAdminModule('security')}>
            <ShieldCheck size={18} /> Seguridad
          </button>
          <button className={adminModule === 'system' ? 'active' : ''} onClick={() => setAdminModule('system')}>
            <Settings size={18} /> Sistema
          </button>
          <button className={adminModule === 'notifications' ? 'active' : ''} onClick={() => setAdminModule('notifications')}>
            <BellRing size={18} /> Notificaciones
          </button>
          <button className={adminModule === 'updates' ? 'active' : ''} onClick={() => setAdminModule('updates')}>
            <Wrench size={18} /> Actualizaciones
          </button>
        </nav>
        <div className="sidebar-footer-actions">
          <small className="app-version">Versión {appVersion}</small>
          <button type="button" onClick={onGoAttendance}><KeyRound size={18} /> Ir a asistencia</button>
          <button type="button" onClick={onLogout}><LogOut size={18} /> Cerrar sesion</button>
        </div>
      </aside>

      <div className="admin-main">
        <section className="module-heading module-heading-overlay">
          <div>
            <p className="eyebrow">{moduleTitle}</p>
            <h1>{moduleTitle}</h1>
          </div>
          <span>{moduleDescription}</span>
        </section>

      {adminModule === 'dashboard' && (
        <section className="dashboard-module module-content">
          <section className="form-panel module-top-panel dashboard-overview-panel">
            <div className="panel-heading">
              <h2><BarChart3 size={20} /> Indicadores del dia</h2>
            </div>
            <div className="metric-grid">
              <article className="metric-card"><span>Presentes</span><strong>{summary.presentCount}</strong><small>Dentro del recinto</small></article>
              <article className="metric-card"><span>Jornadas abiertas</span><strong>{summary.openShifts}</strong><small>Sin salida registrada</small></article>
              <article className="metric-card"><span>Colaciones abiertas</span><strong>{summary.activeMeals}</strong><small>En pausa activa</small></article>
              <article className="metric-card"><span>Turnos cerrados</span><strong>{summary.completedShifts}</strong><small>Hoy</small></article>
            </div>
          </section>
          <div className="dashboard-grid">
            <section className="table-panel">
              <div className="panel-heading">
                <h2><History size={20} /> Ultimas marcaciones</h2>
                <button onClick={() => loadSummary().catch((error) => setMessage(error.message))}><RefreshCw size={16} /> Actualizar</button>
              </div>
              <table>
                <thead><tr><th>Hora</th><th>Empleado</th><th>Tipo</th></tr></thead>
                <tbody>
                  {summary.recentRecords?.length ? summary.recentRecords.map((record) => (
                    <tr key={record.id}>
                      <td>{new Date(record.registeredAt).toLocaleTimeString()}</td>
                      <td>{record.fullName}</td>
                      <td><span className={`badge ${record.type}`}>{getAttendanceLabel(record.type)}</span></td>
                  <td>{record.markMethod || "ANTERIOR"}<span className="pair-label">{record.terminalName || "Registro anterior"}</span></td>
                    </tr>
                  )) : <tr><td colSpan="3">Sin movimientos para mostrar.</td></tr>}
                </tbody>
              </table>
            </section>
            <section className="form-panel alert-panel">
              <h2><BellRing size={20} /> Alertas operativas</h2>
              {summary.alerts?.length ? summary.alerts.map((alert, index) => (
                <p className="soft-alert" key={`${alert.type}-${index}`}>{alert.label}</p>
              )) : <p>No hay alertas activas.</p>}
            </section>
          </div>
        </section>
      )}

      {adminModule === 'users' && (
        <div className="admin-grid module-content users-module-grid">
          <form className="form-panel module-top-panel" onSubmit={createEmployee}>
            <h2><UserPlus size={20} /> Nuevo empleado</h2>
            <label>Documento<input value={form.documentId} onChange={(e) => setForm({ ...form, documentId: e.target.value })} required /></label>
            <label>Nombre completo<input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></label>
            <label>Email<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label>Cargo
              <select aria-label="Cargo del nuevo empleado" value={form.positionName} onChange={e => setForm({...form,positionName:e.target.value})}>
                <option value="">Sin asignar</option>
                {activePositions.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </label>
            <label>
              Area
              <select value={form.workAreaId} onChange={(e) => setForm({ ...form, workAreaId: e.target.value })}>
                <option value="">Sin area</option>
                {activeAreas.map((area) => (
                  <option key={`new-employee-area-${area.id}`} value={area.id}>{area.name}</option>
                ))}
              </select>
            </label>
            <button className="primary" type="submit">Guardar</button>
          </form>

          <div className="table-panel employee-table-panel module-top-panel">
            <div className="panel-heading">
              <h2><Users size={20} /> Buscar trabajadores</h2>
              <button onClick={()=>setUserRefresh(n=>n+1)} disabled={userResultsBusy}>
                <RefreshCw size={16}/> Actualizar búsqueda
              </button>
            </div>
            <label>Nombre o documento
              <input type="search" value={userQuery} placeholder="Escribe al menos 2 caracteres"
                onChange={e=>setUserQuery(e.target.value)}/>
            </label>
            {adminRole === 'admin' && (
              <div className="worker-export-actions">
                <button type="button" disabled={exportingWorkers} onClick={() => downloadWorkers('xlsx')}>
                  <Download size={16} /> Exportar Excel
                </button>
                <button type="button" disabled={exportingWorkers} onClick={() => downloadWorkers('xml')}>
                  <Download size={16} /> Exportar XML
                </button>
                <small>Incluye activos e inactivos: ID, nombre, documento, correo, cargo, área y estado. Sin claves ni datos médicos.</small>
              </div>
            )}
            {userQuery.trim().length<2&&<p>Escribe un nombre o documento para consultar empleados.</p>}
            {userQuery.trim().length>=2&&<table>
              <thead><tr><th>Nombre</th><th>Documento</th><th>Area</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {userResultsBusy && (
                  <tr><td colSpan="5">Buscando trabajadores…</td></tr>
                )}
                {!userResultsBusy && userResults.length === 0 && (
                  <tr><td colSpan="5">No se encontraron resultados.</td></tr>
                )}
                {!userResultsBusy&&userResults.map((employee) => (
                  <tr className={!employee.isActive ? 'inactive-row' : ''} key={employee.id}>
                    <td>{employee.fullName}</td>
                    <td>{employee.documentId}</td>
                    <td>{employee.workAreaName || <span className="pair-label">Sin area</span>}</td>
                    <td>
                      <span className={`status-pill ${employee.isActive ? 'active' : 'inactive'}`}>
                        {employee.isActive ? 'Activo' : 'Desactivado'}
                      </span>
                      {!employee.isActive && employee.deletionReason && <span className="pair-label">{employee.deletionReason}</span>}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button title="Corregir documento" onClick={() => changeEmployeeDocument(employee)}>
                          <FileText size={16} /> Documento
                        </button>
                        {employee.isActive ? (
                          <button className="danger" title="Desactivar empleado" onClick={() => deleteEmployee(employee)}>
                            <Trash2 size={16} /> Desactivar
                          </button>
                        ) : (
                          <button className="primary" title="Reactivar empleado" onClick={() => reactivateEmployee(employee)}>
                            <RefreshCw size={16} /> Reactivar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>}
          </div>
          <TokenCredentials onMessage={setMessage} canBulk={adminRole==='admin'} canRevokeTerminal={adminRole==='admin'}/>
        </div>
      )}

      <div hidden={adminModule !== 'employeeFile'}><EmployeeFile active={adminModule === 'employeeFile'} areas={areas} positions={positions} onSaved={loadEmployees} onMessage={setMessage}
        workerNavigation={workerNavigation} onWorkerNavigationHandled={() => setWorkerNavigation(current=>({...current,id:null}))} /></div>


      {deleteBlock && adminModule === (deleteBlock.kind === 'area' ? 'areas' : 'positions') && (
        <section className="form-panel module-content" role="alert" aria-label="Imposible eliminar, trabajadores asignados">
          <div className="panel-heading">
            <h2><Users size={20} /> No se puede eliminar {deleteBlock.item.name}</h2>
            <button type="button" onClick={() => setDeleteBlock(null)}>Cerrar</button>
          </div>
          <p>{deleteBlock.message}</p>
          <p>Selecciona un trabajador para abrir su ficha y cambiar o quitar la asignación. Los trabajadores inactivos también impiden la eliminación.</p>
          <div className="row-actions" style={{flexWrap:'wrap'}}>
            {deleteBlock.employees.map(worker => (
              <button type="button" key={worker.id} onClick={() => goToAssignedWorker(worker)}>
                <FileText size={16} /> {worker.fullName} · {worker.documentId || 'Sin RUT'} · {worker.isActive ? 'Activo' : 'Inactivo'} — Abrir ficha
              </button>
            ))}
          </div>
        </section>
      )}

      {adminModule === 'areas' && (
        <div className="areas-module module-content">
          <form className="form-panel module-top-panel area-form" onSubmit={createArea}>
            <h2><Building2 size={20} /> Nueva area</h2>
            <label>Nombre<input value={areaForm.name} onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value.toLocaleUpperCase('es-CL') })} required placeholder="Ej: COCINA" /></label>
            <label>Descripcion<input value={areaForm.description} onChange={(e) => setAreaForm({ ...areaForm, description: e.target.value })} placeholder="Ej: Produccion y preparacion" /></label>
            <button className="primary" type="submit">Crear area</button>
          </form>

          <section className="table-panel">
            <div className="panel-heading">
              <h2><Building2 size={20} /> Areas creadas</h2>
              <button onClick={() => loadAreas().catch((error) => setMessage(error.message))}>
                <RefreshCw size={16} /> Actualizar
              </button>
            </div>
            <table>
              <thead><tr><th>Area</th><th>Descripcion</th><th>Asignados</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {areas.map((area) => (
                  <tr className={!area.isActive ? 'inactive-row' : ''} key={area.id}>
                    <td>{area.name}</td>
                    <td>{area.description || '-'}</td>
                    <td>{area.employeeCount}</td>
                    <td>
                      <span className={`status-pill ${area.isActive ? 'active' : 'inactive'}`}>
                        {area.isActive ? 'Activa' : 'Desactivada'}
                      </span>
                      {!area.isActive && area.deactivationReason && <span className="pair-label">{area.deactivationReason}</span>}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button type="button" onClick={() => editArea(area)}><FileText size={16} /> Editar</button>
                        {area.isActive ? (
                          <button className="danger" type="button" onClick={() => deactivateArea(area)}><Trash2 size={16} /> Desactivar</button>
                        ) : (
                          <button className="primary" type="button" onClick={() => reactivateArea(area)}><RefreshCw size={16} /> Reactivar</button>
                        )}
                        <button type="button" className="danger" onClick={() => permanentlyDelete('area',area)} title="Eliminar definitivamente solo si no tiene trabajadores ni semanas históricas">
                          <Trash2 size={16} /> Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!areas.length && <tr><td colSpan="5">No hay areas creadas.</td></tr>}
              </tbody>
            </table>
          </section>

          <section className="table-panel">
            <div className="panel-heading">
              <h2><Users size={20} /> Personal por area</h2>
            </div>
            <table>
              <thead><tr><th>Empleado</th><th>Documento</th><th>Cargo</th><th>Area asignada</th></tr></thead>
              <tbody>
                {activeEmployees.map((employee) => (
                  <tr key={`area-employee-${employee.id}`}>
                    <td>{employee.fullName}</td>
                    <td>{employee.documentId}</td>
                    <td>{employee.positionName || '-'}</td>
                    <td>
                      <select value={employee.workAreaId || ''} onChange={(e) => assignEmployeeArea(employee, e.target.value)}>
                        <option value="">Sin area</option>
                        {activeAreas.map((area) => (
                          <option key={`assign-${employee.id}-${area.id}`} value={area.id}>{area.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {!activeEmployees.length && <tr><td colSpan="4">No hay empleados activos para asignar.</td></tr>}
              </tbody>
            </table>
          </section>
        </div>
      )}


      {adminModule === 'positions' && (
        <div className="areas-module module-content">
          <form className="form-panel module-top-panel area-form" onSubmit={createPosition}>
            <h2><BriefcaseBusiness size={20} /> Nuevo cargo</h2>
            <label>Nombre<input value={positionForm.name} onChange={e => setPositionForm({...positionForm,name:e.target.value.toLocaleUpperCase('es-CL')})} required placeholder="Ej: CAJERO" /></label>
            <label>Descripción<input value={positionForm.description} onChange={e => setPositionForm({...positionForm,description:e.target.value})} placeholder="Descripción opcional" /></label>
            <button className="primary" type="submit">Crear cargo</button>
          </form>
          <section className="table-panel">
            <div className="panel-heading">
              <h2><BriefcaseBusiness size={20} /> Cargos registrados</h2>
              <button onClick={() => loadPositions().catch(error => setMessage(error.message))}><RefreshCw size={16} /> Actualizar</button>
            </div>
            <table>
              <thead><tr><th>Cargo</th><th>Descripción</th><th>Asignados</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {positions.map(position => (
                  <tr key={position.id} className={!position.isActive?'inactive-row':''}>
                    <td>{position.name}</td>
                    <td>{position.description || '-'}</td>
                    <td>{position.employeeCount}</td>
                    <td><span className={`status-pill ${position.isActive?'active':'inactive'}`}>{position.isActive?'Activo':'Desactivado'}</span>
                      {!position.isActive && position.deactivationReason && <span className="pair-label">{position.deactivationReason}</span>}
                    </td>
                    <td><div className="row-actions">
                      <button type="button" onClick={() => editPosition(position)}><FileText size={16} /> Editar</button>
                      {position.isActive ?
                        <button type="button" className="danger" onClick={() => deactivatePosition(position)}><Trash2 size={16} /> Desactivar</button> :
                        <button type="button" className="primary" onClick={() => reactivatePosition(position)}><RefreshCw size={16} /> Reactivar</button>}
                      <button type="button" className="danger" onClick={() => permanentlyDelete('position',position)} title="Eliminar definitivamente solo si no tiene trabajadores asignados"><Trash2 size={16} /> Eliminar</button>
                    </div></td>
                  </tr>
                ))}
                {!positions.length && <tr><td colSpan="5">No hay cargos registrados.</td></tr>}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {adminModule === 'companies' && canManageDocumentCatalog && <Companies areas={areas} positions={positions} onMessage={setMessage} />}

      {adminModule === 'documents' && canManageDocumentCatalog && (
        <DocumentCatalog employees={employees} onMessage={setMessage} onOpenWorker={goToAssignedWorker} />
      )}

      {adminModule === 'documentAudit' && canAuditDocuments && (
        <DocumentAudit onOpenWorker={goToAssignedWorker} />
      )}

      {adminModule === 'shifts' && (
        <ShiftManager data={scheduleData} onReload={loadSchedules} onMessage={setMessage} />
      )}

      {adminModule === 'records' && (
        <div className="records-module module-content">
          <form className="form-panel record-filter-form" onSubmit={applyRecordFilters}>
            <h2><RefreshCw size={20} /> Filtros</h2>
            <label>
              Empleado
              <select value={recordFilters.employeeId} onChange={(e) => setRecordFilters({ ...recordFilters, employeeId: e.target.value })}>
                <option value="">Todos</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.fullName} - {employee.documentId}</option>
                ))}
              </select>
            </label>
            <label>
              Desde
              <DateField  value={recordFilters.from} onChange={(e) => setRecordFilters({ ...recordFilters, from: e.target.value })} />
            </label>
            <label>
              Hasta
              <DateField  value={recordFilters.to} onChange={(e) => setRecordFilters({ ...recordFilters, to: e.target.value })} />
            </label>
            <label>
              Tipo
              <select value={recordFilters.type} onChange={(e) => setRecordFilters({ ...recordFilters, type: e.target.value })}>
                <option value="">Todas</option>
                {ATTENDANCE_TYPE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
            <div className="filter-actions">
              <button className="primary" type="submit">Consultar</button>
              <button type="button" onClick={clearRecordFilters}>Limpiar</button>
            </div>
          </form>

          <form className="form-panel manual-record-form" onSubmit={createManualRecord}>
            <h2><Clock size={20} /> Marca manual</h2>
            <label>
              Empleado
              <select value={manualRecord.employeeId} onChange={(e) => setManualRecord({ ...manualRecord, employeeId: e.target.value })} required>
                <option value="">Seleccionar</option>
                {activeEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.fullName} - {employee.documentId}</option>
                ))}
              </select>
            </label>
            <label>
              Tipo
              <select value={manualRecord.type} onChange={(e) => setManualRecord({ ...manualRecord, type: e.target.value })}>
                {ATTENDANCE_TYPE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              Fecha y hora
              <DateTimeField value={manualRecord.registeredAt} onChange={(e) => setManualRecord({ ...manualRecord, registeredAt: e.target.value })} required />
            </label>
            <label>
              Motivo
              <textarea value={manualRecord.reason} onChange={(e) => setManualRecord({ ...manualRecord, reason: e.target.value })} required minLength="5" placeholder="Ej: olvido de marca validado por supervisor" />
            </label>
            <button className="primary" type="submit">Agregar marca</button>
          </form>

          <div className="table-panel">
            <div className="panel-heading">
              <h2><Clock size={20} /> Marcaciones</h2>
              <button onClick={() => loadRecords().catch((error) => setMessage(error.message))} disabled={loading}>
                <RefreshCw size={16} /> Actualizar
              </button>
            </div>
            <table>
              <thead><tr><th>Fecha</th><th>Empleado</th><th>Documento</th><th>Tipo</th><th>Método / terminal</th><th>Turno</th><th>Atraso</th><th>Permanencia efectiva</th><th>Colacion</th><th></th></tr></thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan="10">Cargando marcaciones...</td>
                  </tr>
                )}
                {!loading && records.length === 0 && (
                  <tr>
                    <td colSpan="9">No hay marcaciones registradas.</td>
                  </tr>
                )}
                {records.map((record) => (
                <tr className={pairClassName(record.pairId)} key={record.id}>
                  <td>{new Date(record.registeredAt).toLocaleString()}</td>
                  <td>{record.fullName}</td>
                  <td>{record.documentId}</td>
                  <td><span className={`badge ${record.type}`}>{getAttendanceLabel(record.type)}</span></td>
                  <td>
                    {record.shiftName ? (
                      <>
                        {record.shiftName}
                        <span className="pair-label">{record.scheduleLabel || `${record.scheduledStart} - ${record.scheduledEnd}`}</span>
                      </>
                    ) : '-'}
                  </td>
                  <td>{record.lateMinutes ? `${record.lateMinutes} min` : '-'}</td>
                  <td>
                    {record.type === 'salida' ? formatDuration(record.durationSeconds) : '-'}
                    {record.pairId && <span className="pair-label">Turno {String(record.pairId).split('-').at(-1)}</span>}
                  </td>
                  <td>
                    {['entrada_colacion', 'salida_colacion'].includes(record.type) && formatDuration(record.mealDurationSeconds)}
                    {record.type === 'salida' && formatDuration(record.deductedMealSeconds)}
                    {!['entrada_colacion', 'salida_colacion', 'salida'].includes(record.type) && '-'}
                  </td>
                    <td>
                      <button className="danger" title="Anular marca" onClick={() => deleteAttendanceRecord(record)}>
                        <Trash2 size={16} /> Anular
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adminModule === 'reports' && (
        <section className="reports-module module-content">
          <div className="metric-grid reports-metrics">
            <article className="metric-card"><span>Registros filtrados</span><strong>{recordInsights.totalRecords}</strong><small>Base del reporte</small></article>
            <article className="metric-card"><span>Horas netas</span><strong>{formatDuration(recordInsights.workedSeconds)}</strong><small>Permanencia efectiva</small></article>
            <article className="metric-card"><span>Tiempo colacion</span><strong>{formatDuration(recordInsights.mealSeconds)}</strong><small>Descontado</small></article>
            <article className="metric-card"><span>Turnos abiertos</span><strong>{recordInsights.openPairs}</strong><small>Revisar</small></article>
          </div>

          <form className="form-panel calendar-filter-form" onSubmit={applyExpectedReportFilters}>
            <h2><CalendarDays size={20} /> Reporte esperado vs real</h2>
            <label>
              Mes
              <MonthField value={expectedReportFilters.month} onChange={(e) => setExpectedReportFilters({ ...expectedReportFilters, month: e.target.value })} />
            </label>
            <label>
              Empleado
              <select value={expectedReportFilters.employeeId} onChange={(e) => setExpectedReportFilters({ ...expectedReportFilters, employeeId: e.target.value })}>
                <option value="">Todos</option>
                {employees.map((employee) => (
                  <option key={`expected-${employee.id}`} value={employee.id}>{employee.fullName}</option>
                ))}
              </select>
            </label>
            <button className="primary" type="submit">Calcular</button>
          </form>

          <div className="metric-grid reports-metrics">
            <article className="metric-card"><span>Dias del reporte</span><strong>{expectedReport.summary.reportDays ?? expectedReport.items.length}</strong><small>Programados {expectedReport.summary.scheduledDays} · sin turno {expectedReport.summary.unplannedDays || 0}</small></article>
            <article className="metric-card"><span>Ausencias</span><strong>{expectedReport.summary.absentDays}</strong><small>Sin entrada ni salida</small></article>
            <article className="metric-card"><span>Atrasos</span><strong>{formatMinutes(expectedReport.summary.totalLateMinutes)}</strong><small>Acumulado mensual</small></article>
            <article className="metric-card"><span>Colacion registrada</span><strong>{formatMinutes(expectedReport.summary.totalMealMinutes)}</strong><small>Tiempo acumulado</small></article>
          </div>

          <section className="table-panel">
            <div className="panel-heading">
              <h2><FileText size={20} /> Programado contra registrado</h2>
            </div>
            <table>
              <thead><tr><th>Fecha</th><th>Empleado</th><th>Turno</th><th>Entrada</th><th>Salida colacion</th><th>Entrada colacion</th><th>Salida</th><th>Atraso</th><th>Salida antes</th><th>Real</th><th>Colacion</th><th>Estado</th></tr></thead>
              <tbody>
                {expectedReport.items.slice(0, 31).map((item) => (
                  <tr key={`expected-${item.employeeId}-${item.workDate}`}>
                    <td>{item.workDate}</td>
                    <td>{item.fullName}</td>
                    <td>
                      {item.shiftName ? (
                        <>{item.shiftName} <span className="pair-label">{item.scheduleLabel || `${item.scheduledStart} - ${item.scheduledEnd}`}</span></>
                      ) : (
                        <span className="pair-label">Sin turno</span>
                      )}
                    </td>
                    <td>{formatTime(item.firstEntry)}</td>
                    <td>{formatTime(item.mealStart)}</td>
                    <td>{formatTime(item.mealEnd)}</td>
                    <td>{formatTime(item.lastExit)}</td>
                    <td>{item.lateMinutes ? `${item.lateMinutes} min` : '-'}</td>
                    <td>{item.earlyLeaveMinutes ? `${item.earlyLeaveMinutes} min` : '-'}</td>
                    <td>{formatMinutes(item.actualMinutes)}</td>
                    <td>{formatMinutes(item.mealMinutes)}</td>
                    <td>
                      {item.status === 'complete' && 'Completo'}
                      {item.status === 'with_observations' && 'Con observacion'}
                      {item.status === 'incomplete' && 'Incompleto'}
                      {item.status === 'absent' && 'Ausente'}
                      {item.status === 'unplanned' && 'Sin turno'}
                      {item.status === 'no_shift' && 'Sin programacion'}
                      {item.status === 'rest' && 'Descanso'}
                      {item.status === 'leave' && 'Licencia'}
                      {item.status === 'vacation' && 'Vacaciones'}
                      {item.status === 'permit' && 'Permiso'}
                      {item.status === 'absence' && 'Falta'}
                    </td>
                  </tr>
                ))}
                {!expectedReport.items.length && <tr><td colSpan="12">No hay turnos ni marcaciones para este filtro.</td></tr>}
              </tbody>
            </table>
          </section>

          <section className="form-panel report-actions-panel">
            <h2><Download size={20} /> Exportacion</h2>
            <p>Usa los filtros de Marcaciones para preparar la base del reporte antes de exportar.</p>
            <div className="notification-actions">
              <button className="primary" type="button" onClick={exportRecordsCsv}><Download size={18} /> Exportar CSV</button>
              <button type="button" onClick={printRecordsReport}><FileText size={18} /> Imprimir / PDF</button>
            </div>
          </section>
          <section className="table-panel">
            <div className="panel-heading">
              <h2><FileText size={20} /> Vista previa del reporte</h2>
            </div>
            <table>
              <thead><tr><th>Fecha</th><th>Empleado</th><th>Tipo</th><th>Turno</th><th>Atraso</th><th>Permanencia</th><th>Colacion</th></tr></thead>
              <tbody>
                {records.slice(0, 12).map((record) => (
                  <tr key={`report-${record.id}`}>
                    <td>{new Date(record.registeredAt).toLocaleString()}</td>
                    <td>{record.fullName}</td>
                    <td>{getAttendanceLabel(record.type)}</td>
                    <td>{record.shiftName || '-'}</td>
                    <td>{record.lateMinutes ? `${record.lateMinutes} min` : '-'}</td>
                    <td>{record.type === 'salida' ? formatDuration(record.durationSeconds) : '-'}</td>
                    <td>{record.type === 'salida' ? formatDuration(record.deductedMealSeconds) : formatDuration(record.mealDurationSeconds)}</td>
                  </tr>
                ))}
                {!records.length && <tr><td colSpan="7">No hay datos filtrados para exportar.</td></tr>}
              </tbody>
            </table>
          </section>
        </section>
      )}

      {adminModule === 'calendar' && (
        <section className="calendar-module module-content">
          <form className="form-panel calendar-filter-form" onSubmit={applyCalendarFilters}>
            <h2><CalendarDays size={20} /> Calendario de asistencia</h2>
            <label>
              Mes
              <input type="month" value={calendarFilters.month} onChange={(e) => setCalendarFilters({ ...calendarFilters, month: e.target.value })} />
            </label>
            <label>
              Empleado
              <select value={calendarFilters.employeeId} onChange={(e) => setCalendarFilters({ ...calendarFilters, employeeId: e.target.value })}>
                <option value="">Todos</option>
                {employees.map((employee) => (
                  <option key={`calendar-${employee.id}`} value={employee.id}>{employee.fullName}</option>
                ))}
              </select>
            </label>
            <button className="primary" type="submit">Consultar</button>
          </form>
          <section className="table-panel attendance-calendar">
            <div className="weekday-row">
              {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map((day) => <strong key={day}>{day}</strong>)}
            </div>
            <div className="calendar-grid">
              {calendarCells.map((date, index) => {
                const day = date ? calendarDayMap.get(date) : null;
                return (
                  <article className={`calendar-cell ${day?.status || 'empty'}`} key={date || `empty-${index}`}>
                    {date && (
                      <>
                        <strong>{date.slice(-2)}</strong>
                        <span>{day?.status === 'complete' ? 'Completa' : day?.status === 'incomplete' ? 'Incompleta' : 'Sin registro'}</span>
                        {day && <small>{day.totalRecords} marcas</small>}
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </section>
      )}

      <div hidden={adminModule !== 'weekly'}><WeeklyPlanner areas={areas} employees={employees} onMessage={setMessage} active={adminModule === 'weekly'} onClose={() => setAdminModule('dashboard')} /></div>

      {adminModule === 'security' && (
        <section className="security-module module-content">
          <div className="security-grid">
            <form className="form-panel password-form" onSubmit={changeAdminPassword}>
              <h2><KeyRound size={20} /> Cambiar clave admin</h2>
              <PressToRevealPassword label="Clave actual" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} />
              <label>
                O codigo Authenticator
                <input value={passwordForm.otpCode} onChange={(e) => setPasswordForm({ ...passwordForm, otpCode: e.target.value })} inputMode="numeric" />
              </label>
              <PressToRevealPassword label="Nueva clave" autoComplete="new-password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} required />
              <PressToRevealPassword label="Confirmar nueva clave" autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} required />
              <button className="primary" type="submit">Actualizar clave</button>
            </form>

            <section className="form-panel authenticator-panel">
              <h2><Shield size={20} /> Google Authenticator</h2>
              <div className="settings-summary">
                <strong>Estado</strong>
                <span>{authenticatorStatus.enabled ? 'Habilitado para recuperar clave' : 'No configurado'}</span>
              </div>
              {!authenticatorSetup.qrCodeDataUrl && (
                <form onSubmit={beginAuthenticatorSetup}>
                  <PressToRevealPassword label="Confirma clave actual" autoComplete="current-password" value={authenticatorSetup.currentPassword} onChange={(e) => setAuthenticatorSetup({ ...authenticatorSetup, currentPassword: e.target.value })} required />
                  <button type="submit">Configurar autenticador</button>
                </form>
              )}
              {authenticatorSetup.qrCodeDataUrl && (
                <form className="authenticator-confirm" onSubmit={confirmAuthenticatorSetup}>
                  <img alt="QR Google Authenticator" src={authenticatorSetup.qrCodeDataUrl} />
                  <span className="authenticator-secret">{authenticatorSetup.secret}</span>
                  <label>
                    Codigo de 6 digitos
                    <input value={authenticatorSetup.code} onChange={(e) => setAuthenticatorSetup({ ...authenticatorSetup, code: e.target.value })} inputMode="numeric" required />
                  </label>
                  <button className="primary" type="submit">Confirmar autenticador</button>
                </form>
              )}
            </section>
          </div>

          <div className="security-grid secondary-security-grid">
            <form className="form-panel backup-panel" onSubmit={generateBackupCodes}>
              <h2><ShieldCheck size={20} /> Codigos de respaldo</h2>
              <div className="settings-summary">
                <strong>Disponibles</strong>
                <span>{backupCodeStatus.availableCodes} de {backupCodeStatus.totalCodes}</span>
              </div>
              <PressToRevealPassword label="Confirma clave actual" autoComplete="current-password" value={backupCodePassword} onChange={(e) => setBackupCodePassword(e.target.value)} required />
              <button type="submit">Generar codigos</button>
              {generatedBackupCodes.length > 0 && (
                <div className="backup-code-list">
                  {generatedBackupCodes.map((code) => <span key={code}>{code}</span>)}
                </div>
              )}
            </form>

            <form className="form-panel admin-user-form" onSubmit={createAdminUser}>
              <h2><Users size={20} /> Roles del sistema</h2>
              <label>Usuario<input value={adminUserForm.username} onChange={(e) => setAdminUserForm({ ...adminUserForm, username: e.target.value })} required /></label>
              <label>Nombre<input value={adminUserForm.fullName} onChange={(e) => setAdminUserForm({ ...adminUserForm, fullName: e.target.value })} required /></label>
              <PressToRevealPassword label="Clave inicial" autoComplete="new-password" value={adminUserForm.password} onChange={(e) => setAdminUserForm({ ...adminUserForm, password: e.target.value })} required />
              <PressToRevealPassword label="Confirmar clave inicial" autoComplete="new-password" value={confirmAdminUserPassword} onChange={(e) => setConfirmAdminUserPassword(e.target.value)} required />
              {confirmAdminUserPassword && (
                <small className={adminUserForm.password === confirmAdminUserPassword ? 'passwords-match' : 'passwords-mismatch'} role="status">
                  {adminUserForm.password === confirmAdminUserPassword ? 'Las claves coinciden' : 'Las claves no coinciden'}
                </small>
              )}
              <label>
                Rol
                <select value={adminUserForm.role} onChange={(e) => setAdminUserForm({ ...adminUserForm, role: e.target.value })}>
                  <option value="admin">Admin</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="operator">Operador</option>
                </select>
              </label>
              <button className="primary" type="submit">Crear usuario</button>
            </form>
          </div>

          <div className="dashboard-grid">
            <section className="table-panel">
              <div className="panel-heading"><h2><Users size={20} /> Usuarios administrativos</h2></div>
              <table>
                <thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th></tr></thead>
                <tbody>
                  {adminUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.fullName}</td>
                      <td>{user.username}</td>
                      <td>
                        <select value={user.role} onChange={(e) => changeAdminRole(user.id, e.target.value)}>
                          <option value="admin">Admin</option>
                          <option value="supervisor">Supervisor</option>
                          <option value="operator">Operador</option>
                        </select>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="table-panel">
              <div className="panel-heading"><h2><History size={20} /> Historial de cambios</h2></div>
              <table>
                <thead><tr><th>Fecha</th><th>Usuario</th><th>Accion</th></tr></thead>
                <tbody>
                  {auditLogs.slice(0, 12).map((log) => (
                    <tr key={log.id}>
                      <td>{new Date(log.createdAt).toLocaleString()}</td>
                      <td>{log.adminUsername || 'Sistema'}</td>
                      <td>{getAuditActionLabel(log.action)} - {getAuditEntityLabel(log.entityType)}</td>
                    </tr>
                  ))}
                  {!auditLogs.length && <tr><td colSpan="3">Todavia no hay cambios auditados.</td></tr>}
                </tbody>
              </table>
            </section>
          </div>
        </section>
      )}

      {adminModule === 'system' && (
        <div className="system-module module-content">
          <form className="form-panel system-form" onSubmit={saveSettings}>
            <h2><Settings size={20} /> Configuracion horaria</h2>
            <label>
              Modo de hora
              <select value={settings.timeMode} onChange={(e) => setSettings({ ...settings, timeMode: e.target.value })}>
                <option value="auto">Automatico por pais/zona horaria</option>
                <option value="manual">Manual por UTC</option>
              </select>
            </label>
            <label>
              Pais / zona horaria
              <select value={settings.timeZone} onChange={(e) => {
                const selected = TIME_ZONE_OPTIONS.find((option) => option.timeZone === e.target.value);
                setSettings({ ...settings, timeZone: e.target.value, country: selected?.country || settings.country });
              }}>
                {TIME_ZONE_OPTIONS.map((option) => (
                  <option key={option.timeZone} value={option.timeZone}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              Ajuste manual UTC
              <select value={settings.manualUtcOffset} onChange={(e) => setSettings({ ...settings, manualUtcOffset: e.target.value })}>
                <option value="-05:00">UTC-05:00</option>
                <option value="-04:00">UTC-04:00</option>
                <option value="-03:00">UTC-03:00</option>
                <option value="-02:00">UTC-02:00</option>
                <option value="+00:00">UTC+00:00</option>
                <option value="+01:00">UTC+01:00</option>
                <option value="+02:00">UTC+02:00</option>
              </select>
            </label>
            <label>
              Empresa
              <input value={settings.companyName} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })} />
            </label>
            <label>
              Subtitulo
              <input value={settings.companyTagline} onChange={(e) => setSettings({ ...settings, companyTagline: e.target.value })} />
            </label>
            <label>
              Jornada objetivo (horas)
              <input type="number" min="1" max="24" value={settings.workdayTargetHours} onChange={(e) => setSettings({ ...settings, workdayTargetHours: e.target.value })} />
            </label>
            <label>
              Tolerancia atraso (min)
              <input type="number" min="0" max="240" value={settings.lateToleranceMinutes} onChange={(e) => setSettings({ ...settings, lateToleranceMinutes: e.target.value })} />
            </label>
            <div className="settings-summary">
              <strong>Configuracion actual</strong>
              <span>{settings.timeMode === 'auto' ? `${settings.country} / ${settings.timeZone}` : `Manual ${settings.manualUtcOffset}`}</span>
              <span>Las nuevas marcaciones automaticas usaran esta hora.</span>
            </div>
            <button className="primary" type="submit">Guardar configuracion</button>
          </form>

          <div className="dashboard-grid">
            <section className="form-panel system-side-panel">
              <h2><Building2 size={20} /> Configuracion empresarial</h2>
              <p><strong>{settings.companyName}</strong></p>
              <p>{settings.companyTagline}</p>
              <div className="settings-summary">
                <span>Jornada objetivo: {settings.workdayTargetHours} h</span>
                <span>Tolerancia de atraso: {settings.lateToleranceMinutes} min</span>
              </div>
            </section>
            <section className="form-panel system-side-panel"><h2>Identificación del trabajador</h2><p>QR personal con token revocable y PIN de respaldo.</p><p>Las terminales se autorizan desde Usuarios. La marcación conserva la hora real y el método utilizado.</p></section>
          </div>
        </div>
      )}

      {adminModule === 'notifications' && (
        <section className="form-panel notification-panel module-content">
          <h2><BellRing size={20} /> Notificaciones al celular</h2>
          <p>
            Activa este equipo o celular para recibir un aviso cuando cualquier usuario registre una entrada o salida.
          </p>

          <div className="settings-summary">
            <strong>Estado actual</strong>
            <span>Servidor push: {notificationStatus.enabled ? 'Configurado' : 'Sin configurar'}</span>
            <span>Permiso del navegador: {notificationStatus.browserPermission}</span>
            <span>Este dispositivo: {notificationStatus.hasLocalSubscription ? 'Activado' : 'No activado'}</span>
            <span>Dispositivos activos: {notificationStatus.activeSubscriptions}</span>
          </div>

          <div className="notification-actions">
            <button className="primary" type="button" onClick={activatePushNotifications}>
              <BellRing size={18} /> Activar en este dispositivo
            </button>
            <button type="button" onClick={deactivatePushNotifications}>
              Desactivar en este dispositivo
            </button>
            <button type="button" onClick={() => loadNotificationStatus().catch((error) => setMessage(error.message))}>
              <RefreshCw size={16} /> Actualizar estado
            </button>
          </div>

          <div className="settings-summary">
            <strong>Uso en celular</strong>
            <span>Abre la aplicacion desde el celular, entra como admin y presiona activar.</span>
            <span>Para recibir avisos fuera de esta red, la app debe estar publicada con HTTPS o usando un tunel seguro.</span>
          </div>
        </section>
      )}

      {adminModule === 'updates' && (
        <section className="updates-module module-content">
          <div className="dashboard-grid">
            <section className="form-panel schedule-panel">
              <h2><Clock size={20} /> Crear turno</h2>
              <form className="schedule-form" onSubmit={createShift}>
                <label>
                  Nombre del turno
                  <input
                    value={shiftForm.name}
                    onChange={(event) => setShiftForm({ ...shiftForm, name: event.target.value })}
                    placeholder="Turno diurno"
                    required
                  />
                </label>
                <label>
                  Entrada
                  <input
                    type="time"
                    value={shiftForm.startTime}
                    onChange={(event) => setShiftForm({ ...shiftForm, startTime: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Salida
                  <input
                    type="time"
                    value={shiftForm.endTime}
                    onChange={(event) => setShiftForm({ ...shiftForm, endTime: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Colacion estimada
                  <input
                    type="number"
                    min="0"
                    max="240"
                    value={shiftForm.breakMinutes}
                    onChange={(event) => setShiftForm({ ...shiftForm, breakMinutes: event.target.value })}
                    required
                  />
                </label>
                <button className="primary" type="submit"><Clock size={18} /> Guardar turno</button>
              </form>
            </section>

            <section className="form-panel schedule-panel">
              <h2><Wrench size={20} /> Turnos disponibles</h2>
              {scheduleData.shifts.length === 0 && (
                <p>Aun no hay turnos creados.</p>
              )}
              <div className="settings-summary">
                {scheduleData.shifts.map((shift) => (
                  <span className="shift-row" key={shift.id}>
                    <strong>{shift.name}</strong>
                    {shift.label || `${shift.startTime} - ${shift.endTime}`} · {shift.breakMinutes} min colacion
                    <button className="danger" type="button" onClick={() => deleteShift(shift)} title="Eliminar turno">
                      <Trash2 size={16} />
                    </button>
                  </span>
                ))}
              </div>
            </section>
          </div>

          <section className="table-panel schedule-calendar-panel">
            <div className="panel-heading">
              <h2><CalendarDays size={20} /> Programacion por calendario</h2>
              <button type="button" onClick={() => loadScheduleCalendar().catch((error) => setMessage(error.message))}>
                <RefreshCw size={16} /> Actualizar
              </button>
            </div>

            <form className="schedule-planner-controls" onSubmit={(event) => event.preventDefault()}>
              <label>
                Usuario
                <select
                  value={schedulePlanner.employeeId}
                  onChange={(event) => setSchedulePlanner({ ...schedulePlanner, employeeId: event.target.value })}
                >
                  <option value="">Selecciona usuario</option>
                  {activeEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.fullName}</option>
                  ))}
                </select>
              </label>
              <label>
                Mes
                <input
                  type="month"
                  value={schedulePlanner.month}
                  onChange={(event) => setSchedulePlanner({ ...schedulePlanner, month: event.target.value })}
                />
              </label>
              <label>
                Turno para aplicar
                <select
                  value={schedulePlanner.selectedShiftId}
                  onChange={(event) => setSchedulePlanner({ ...schedulePlanner, selectedShiftId: event.target.value })}
                >
                  <option value="">Selecciona turno</option>
                  {scheduleData.shifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name} ({shift.label || `${shift.startTime} - ${shift.endTime}`})
                    </option>
                  ))}
                </select>
              </label>
              <div className="schedule-bulk-actions">
                <button type="button" onClick={() => applyBulkSchedule('weekdays')}>Aplicar lunes a viernes</button>
                <button type="button" onClick={() => applyBulkSchedule('all')}>Aplicar todo el mes</button>
                <button className="danger" type="button" onClick={() => clearBulkSchedule('all')}>Limpiar mes</button>
              </div>
            </form>

            <div className="weekday-row schedule-weekday-row">
              {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map((day) => (
                <strong key={day}>{day}</strong>
              ))}
            </div>
            {!schedulePlanner.employeeId && (
              <div className="settings-summary">
                <strong>Selecciona un usuario</strong>
                <span>El calendario se habilitara cuando elijas un usuario valido.</span>
              </div>
            )}
            <div className="calendar-grid schedule-calendar-grid">
              {buildCalendarCells(schedulePlanner.month).map((date, index) => {
                const day = date ? scheduleDayByDate.get(date) : null;
                return (
                  <div className={`calendar-cell schedule-day ${day?.assignment ? 'complete' : ''}`} key={date || `blank-${index}`}>
                    {date && (
                      <>
                        <strong>{Number(date.slice(-2))}</strong>
                        <select
                          value={day?.assignment?.shiftId || ''}
                          onChange={(event) => assignCalendarShift(date, event.target.value)}
                          disabled={!schedulePlanner.employeeId}
                        >
                          <option value="">Sin turno</option>
                          {scheduleData.shifts.map((shift) => (
                            <option key={shift.id} value={shift.id}>{shift.name}</option>
                          ))}
                        </select>
                        {day?.assignment && (
                          <small>{day.assignment.label || `${day.assignment.startTime} - ${day.assignment.endTime}`}</small>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="form-panel schedule-panel">
            <h2><Users size={20} /> Proxima actualizacion: portal de empleados</h2>
            <div className="settings-summary">
              <strong>Sesion individual para empleados</strong>
              <span>Acceso personal para que cada empleado revise solo su propia informacion.</span>
              <span>Vista de registros de asistencia, atrasos, permanencia efectiva, colaciones y turnos asignados.</span>
              <span>Historial de correcciones realizadas por administradores u otros usuarios autorizados.</span>
              <span>Resumen claro de su calendario laboral, cumplimiento de jornada y observaciones relevantes.</span>
            </div>
          </section>

          <section className="form-panel schedule-panel">
            <h2><MonitorSmartphone size={20} /> Actualizacion pendiente: modo offline seguro</h2>
            <div className="settings-summary">
              <strong>Agente local Windows + SQLite + sincronizacion segura</strong>
              <span>Crear un agente local para registrar marcas aunque se pierda internet.</span>
              <span>Guardar temporalmente las marcaciones en SQLite con deviceId, localId, fecha/hora, usuario y tipo de marca.</span>
              <span>Sincronizar automaticamente con el servidor cuando vuelva la conexion, evitando duplicados.</span>
              <span>Agregar endpoint seguro /api/attendance/sync con API key por dispositivo.</span>
              <span>Crear panel admin para revisar dispositivos, marcas pendientes, errores y ultima sincronizacion.</span>
              <span>Documentar instalacion del agente y mantenerlo opcional para no afectar el uso local actual.</span>
            </div>
          </section>

          <section className="form-panel schedule-panel">
            <h2><Wrench size={20} /> Hilo pendiente: mejoras generales</h2>
            <div className="settings-summary">
              <strong>Revision completa del sistema</strong>
              <span>Crear migraciones de base de datos para actualizar instalaciones sin perder datos.</span>
              <span>Agregar pruebas automaticas para marcaciones, colaciones, atrasos, turnos y identificación por QR y PIN.</span>
              <span>Mejorar auditoria con motivo de correccion, datos antes/despues y anulacion en vez de borrado definitivo.</span>
              <span>Fortalecer seguridad con limite de intentos, politica de sesiones y tokens revocables y PIN de respaldo.</span>
              <span>Crear reportes esperado vs real comparando turnos programados con asistencia registrada.</span>
              <span>Documentado en docs/hilo-continuidad-mejoras.md para retomarlo en futuras sesiones.</span>
            </div>
          </section>
        </section>
      )}
      </div>
    </section>
  );
}

createRoot(document.getElementById('root')).render(<App />);
