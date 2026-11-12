import {useState} from 'react';
import {api,downloadApiFile} from './services/api.js';

const hms=(value)=>{
  if(value == null)return '—';
  const n=Math.max(0,Math.trunc(Number(value)||0));
  return [Math.trunc(n/3600),Math.trunc(n%3600/60),n%60].map(v=>String(v).padStart(2,'0')).join(':');
};
const periods={daily:'Diario',weekly:'Semanal',monthly:'Mensual'};

export default function AttendancePeriodReports({employees=[],defaultMonth,adminRole,onMessage}){
  const [filters,setFilters]=useState({month:defaultMonth,period:'daily',employeeId:''});
  const [report,setReport]=useState(null);
  const [loadedQuery,setLoadedQuery]=useState('');
  const [busy,setBusy]=useState(false);
  const [exporting,setExporting]=useState(false);
  const query=new URLSearchParams({month:filters.month,period:filters.period,employeeId:filters.employeeId||'0'}).toString();
  const stale=loadedQuery!==query;
  const authorized=['admin','supervisor'].includes(adminRole);

  async function consult(event){
    event.preventDefault();
    if(!authorized||busy)return;
    setBusy(true);
    try{
      const data=await api('/attendance/period-report?'+query);
      setReport(data);setLoadedQuery(query);
    }catch(error){setReport(null);setLoadedQuery('');onMessage(error.message);}
    finally{setBusy(false);}
  }
  async function download(){
    if(!authorized||!report||stale||exporting)return;
    setExporting(true);
    try{
      const {blob,filename}=await downloadApiFile('/attendance/period-report/export?'+loadedQuery);
      const url=URL.createObjectURL(blob);
      try{
        const link=document.createElement('a');
        link.href=url;link.download=filename;
        document.body.appendChild(link);link.click();link.remove();
      }finally{window.setTimeout(()=>URL.revokeObjectURL(url),1500);}
      onMessage('Reporte descargado y exportación registrada en auditoría.');
    }catch(error){onMessage(error.message);}
    finally{setExporting(false);}
  }

  return <section className="module-content" aria-label="Reportes de asistencia por período A03">
    <form className="form-panel calendar-filter-form" onSubmit={consult}>
      <h2>Reportes por período (A03)</h2>
      <label>Mes
        <input type="month" required value={filters.month}
          onChange={e=>setFilters({...filters,month:e.target.value})}/>
      </label>
      <label>Agrupación
        <select value={filters.period} onChange={e=>setFilters({...filters,period:e.target.value})}>
          {Object.entries(periods).map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>Trabajador
        <select value={filters.employeeId} onChange={e=>setFilters({...filters,employeeId:e.target.value})}>
          <option value="">Todos</option>
          {employees.map(e=><option key={e.id} value={e.id}>{e.fullName}</option>)}
        </select>
      </label>
      <div className="filter-actions">
        <button className="primary" disabled={!authorized||busy} type="submit">{busy?'Consultando...':'Consultar períodos'}</button>
        <button type="button" disabled={!authorized||!report||stale||exporting} onClick={download}>{exporting?'Exportando...':'Exportar CSV auditado'}</button>
      </div>
      {!authorized && <p>Esta vista requiere un perfil administrador o supervisor central.</p>}
      <small>Los excesos mostrados son técnicos y no constituyen horas extras autorizadas ni pagos.</small>
    </form>
    {stale && report && <p>Los filtros cambiaron. Pulsa «Consultar períodos» para actualizar.</p>}
    {!stale && report && <>
      <div className="metric-grid reports-metrics">
        <article className="metric-card"><span>Períodos</span><strong>{report.summary.periods}</strong><small>{periods[report.granularity]}</small></article>
        <article className="metric-card"><span>Jornadas registradas</span><strong>{report.summary.recordedDays}</strong><small>Sin cálculo: {report.summary.uncalculatedDays}</small></article>
        <article className="metric-card"><span>Horas registradas</span><strong>{hms(report.summary.actualSeconds)}</strong><small>Tiempo neto calculable</small></article>
        <article className="metric-card"><span>Exceso técnico</span><strong>{hms(report.summary.technicalExcessSeconds)}</strong><small>No implica autorización</small></article>
      </div>
      <section className="table-panel" style={{overflowX:'auto'}}>
        <h3>Detalle por trabajador y período</h3>
        <table>
          <thead><tr><th>Período</th><th>Desde / Hasta</th><th>Trabajador</th><th>Días con marcas</th>
            <th>Sin cálculo</th><th>Incompletos</th><th>Trabajo</th><th>Colación</th><th>Atrasos</th><th>Exceso técnico</th></tr></thead>
          <tbody>
            {report.rows.map(r=><tr key={r.employeeId+':'+r.period}>
              <td>{r.period}</td><td>{r.from} / {r.to}</td><td>{r.fullName}</td>
              <td>{r.recordedDays}</td><td>{r.uncalculatedDays}</td><td>{r.incompleteDays}</td>
              <td>{hms(r.actualSeconds)}</td><td>{hms(r.mealSeconds)}</td>
              <td>{hms(r.lateSeconds)}</td><td>{hms(r.technicalExcessSeconds)}</td>
            </tr>)}
            {!report.rows.length && <tr><td colSpan="10">Sin datos programados ni marcaciones para los filtros seleccionados.</td></tr>}
          </tbody>
        </table>
      </section>
    </>}
  </section>;
}
