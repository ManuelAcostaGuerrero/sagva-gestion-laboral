import React, { useEffect, useMemo, useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { api } from './services/api.js';
import './documentAudit.css';

const labels = {
  CORRECT: 'Correcto',
  MISSING: 'Faltante',
  INCOMPLETE: 'Incompleto',
  REVIEW: 'Revisar',
  NA: 'No aplica'
};
const readableDate = value => value ? value.split('-').reverse().join('/') : '—';
const readablePeriod = value => value ? value.slice(5, 7) + '/' + value.slice(0, 4) : '—';

export default function DocumentAudit({ onOpenWorker }) {
  const [data, setData] = useState({ activeWorkers: 0, groups: [] });
  const [selectedKey, setSelectedKey] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const result = await api('/document-audit');
      setData(result);
      setSelectedKey(current => current && result.groups.some(group => group.key === current)
        ? current
        : (result.groups.find(group => group.key === 'IRL') || result.groups.find(group => group.key === 'PACTO DE HORAS') || result.groups[0])?.key || '');
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const selected = data.groups.find(group => group.key === selectedKey) || null;
  const rows = useMemo(() => {
    if (!selected) return [];
    const q = search.trim().toLocaleUpperCase('es-CL');
    return selected.rows.filter(row => {
      if (statusFilter === 'ALL' && row.status === 'NA') return false;
      if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
      if (!q) return true;
      return String(row.fullName || '').toLocaleUpperCase('es-CL').includes(q)
        || String(row.documentId || '').toLocaleUpperCase('es-CL').includes(q);
    });
  }, [selected, statusFilter, search]);

  if (loading) return <section className="da"><p>Cargando auditoría documental…</p></section>;

  return (
    <section className="da module-content">
      <div className="da-intro">
        <div>
          <h2><ShieldCheck size={21} /> Auditoría documental</h2>
          <p>Vista de solo lectura. Detecta faltantes, datos incompletos y diferencias de fecha sin modificar documentos ni fichas.</p>
        </div>
        <span className="da-readonly">Solo lectura</span>
      </div>

      {error && <p className="soft-alert" role="alert">{error}</p>}
      {!data.groups.length && <section className="da-empty">Aún no hay tipos ni registros documentales que puedan auditarse.</section>}

      {!!data.groups.length && <>
        <div className="da-controls">
          <label>Documento
            <select value={selectedKey} onChange={event => { setSelectedKey(event.target.value); setStatusFilter('ALL'); }}>
              {data.groups.map(group => <option key={group.key} value={group.key}>{group.name}</option>)}
            </select>
          </label>
          <label className="da-search">Buscar trabajador
            <span><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre o RUT" /></span>
          </label>
        </div>

        {selected && <>
          <div className="da-summary" aria-label="Resumen de auditoría">
            <article><strong>{data.activeWorkers}</strong><span>Trabajadores activos</span></article>
            <article className="ok"><strong>{selected.counts.CORRECT}</strong><span>Correctos</span></article>
            <article className="missing"><strong>{selected.counts.MISSING}</strong><span>Faltantes</span></article>
            <article className="incomplete"><strong>{selected.counts.INCOMPLETE}</strong><span>Incompletos</span></article>
            <article className="review"><strong>{selected.counts.REVIEW}</strong><span>Revisar</span></article>
          </div>

          <div className="da-pattern">
            <strong>{selected.name}</strong>
            <span>{selected.peerCount} de {selected.totalPeers} trabajadores activos tienen algún registro.</span>
            {selected.dominantPeriod && selected.dominantPeriod.total >= 3 &&
              <span>Patrón de fecha observado: <b>{readablePeriod(selected.dominantPeriod.period)}</b> ({selected.dominantPeriod.count} de {selected.dominantPeriod.total} registros con fecha).</span>}
            {!selected.configured && <span>Este grupo proviene del historial detectado; no se considera una obligación automática.</span>}
          </div>

          <div className="da-filterbar" aria-label="Filtrar estados">
            {['ALL', 'MISSING', 'INCOMPLETE', 'REVIEW', 'CORRECT'].map(status =>
              <button type="button" key={status} className={statusFilter === status ? 'active' : ''} onClick={() => setStatusFilter(status)}>
                {status === 'ALL' ? 'Todos' : labels[status]}
              </button>)}
          </div>

          <div className="da-list">
            <div className="da-row da-head">
              <span>Trabajador</span><span>Estado</span><span>Fecha registrada</span><span>Vence</span><span>Hallazgo</span><span></span>
            </div>
            {rows.map(row => <div className={'da-row da-' + row.status.toLowerCase()} key={row.employeeId}>
              <span className="da-worker"><strong>{row.fullName}</strong><small>{row.documentId || 'Sin RUT'}</small></span>
              <span><b className={'da-status da-status-' + row.status.toLowerCase()}>{labels[row.status]}</b></span>
              <span>{readableDate(row.deliveredOn || row.startOn)}</span>
              <span>{readableDate(row.expiresOn)}</span>
              <span className="da-reason">{row.reason}</span>
              <span>{onOpenWorker && <button type="button" onClick={() => onOpenWorker({ id: row.employeeId, fullName: row.fullName, documentId: row.documentId })}>Abrir ficha</button>}</span>
            </div>)}
            {!rows.length && <p className="da-empty">No hay trabajadores con este filtro.</p>}
          </div>

          {selected.aliases.length > 1 && <details className="da-aliases">
            <summary>Variantes de nombre detectadas ({selected.aliases.length})</summary>
            <p>Solo se agrupan para esta auditoría. Los nombres originales no se cambian.</p>
            <div>{selected.aliases.map(alias => <span key={alias}>{alias}</span>)}</div>
          </details>}
        </>}
      </>}
    </section>
  );
}
