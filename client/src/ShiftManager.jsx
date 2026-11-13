import React, { useEffect, useState } from 'react';
import { Clock, PlusCircle, Trash2 } from 'lucide-react';
import { api } from './services/api.js';

const emptySchedule = groupId => ({
  groupId: String(groupId || ''), breakMinutes: 30,
  segments: [{ startTime: '08:00', endTime: '17:00' }]
});

const automaticScheduleName = (form, groups) => {
  if (!form) return '';
  const group = groups.find(item => String(item.id) === String(form.groupId));
  const groupName = group?.name || 'Rotativo';
  const ranges = form.segments
    .filter(segment => segment.startTime && segment.endTime)
    .map(segment => `${segment.startTime}–${segment.endTime}`);
  return ranges.length ? `${groupName} ${ranges.join(' / ')}` : groupName;
};

export default function ShiftManager({ data, onReload, onMessage }) {
  const [selectedId, setSelectedId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [form, setForm] = useState(null);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!data.groups.some(group => String(group.id) === selectedId)) {
      const group = data.groups.find(item => item.name.toLowerCase() === 'rotativo') || data.groups[0];
      setSelectedId(group ? String(group.id) : '');
    }
  }, [data.groups, selectedId]);

  const selected = data.groups.find(group => String(group.id) === selectedId);
  const schedules = data.shifts.filter(shift => String(shift.groupId) === selectedId);
  const query = search.trim().toLocaleLowerCase();
  const visible = schedules.filter(shift => `${shift.name} ${shift.label}`.toLocaleLowerCase().includes(query));
  const rotativo = selected?.name.toLowerCase() === 'rotativo';

  async function mutate(action) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try { await action(); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  function report(message) {
    setNotice(message);
    onMessage?.(message);
  }

  async function createGroup(event) {
    event.preventDefault();
    await mutate(async () => {
      const result = await api('/schedules/groups', { method: 'POST', body: JSON.stringify({ name: groupName }) });
      await onReload();
      setSelectedId(String(result.id));
      setSearch('');
      setGroupName('');
      setShowGroupForm(false);
      report(result.message);
    });
  }

  async function createSchedule(event) {
    event.preventDefault();
    await mutate(async () => {
      const result = await api('/schedules/shifts', {
        method: 'POST', body: JSON.stringify({ groupId: Number(form.groupId), breakMinutes: Number(form.breakMinutes), segments: form.segments })
      });
      await onReload();
      setSelectedId(String(form.groupId));
      setSearch('');
      setForm(null);
      report(result.message);
    });
  }

  async function deleteGroup() {
    if (!selected || !window.confirm(`¿Borrar el turno ${selected.name}? Sus registros históricos se conservarán.`)) return;
    await mutate(async () => {
      const result = await api(`/schedules/groups/${selected.id}`, { method: 'DELETE' });
      await onReload();
      setForm(null);
      setSearch('');
      report(result.message);
    });
  }

  async function deleteSchedule(shift) {
    if (!window.confirm(`¿Borrar el horario ${shift.name} (${shift.label}) de la biblioteca?`)) return;
    await mutate(async () => {
      const result = await api(`/schedules/shifts/${shift.id}`, { method: 'DELETE' });
      await onReload();
      report(result.message);
    });
  }

  function updateSegment(index, field, value) {
    setForm(current => ({ ...current, segments: current.segments.map((segment, item) => item === index ? { ...segment, [field]: value } : segment) }));
  }

  return (
    <section className="module-content shift-manager">
      <section className="form-panel">
        <div className="shift-manager-heading">
          <div><h2><Clock size={20} /> Turnos y horarios</h2><p>Un turno agrupa horarios. Rotativo mantiene una sola vez cada horario y lo comparte con todas las áreas.</p></div>
          <div className="shift-manager-actions">
            <button type="button" disabled={busy} onClick={() => { setShowGroupForm(true); setForm(null); setError(''); }}><PlusCircle size={18} /> Crear turno</button>
            <button className="primary" type="button" disabled={busy || !selected} onClick={() => { setForm(emptySchedule(selectedId)); setShowGroupForm(false); setError(''); }}><PlusCircle size={18} /> Agregar horario</button>
          </div>
        </div>
        {error && <p className="soft-alert" role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}

        {showGroupForm && (
          <form className="shift-manager-form" onSubmit={createGroup}>
            <h3>Crear turno</h3>
            <label>Nombre del turno<input value={groupName} onChange={event => setGroupName(event.target.value.toLocaleUpperCase('es-CL'))} placeholder="Ej.: Fin de semana" minLength={2} maxLength={100} required autoFocus /></label>
            <div className="shift-manager-actions"><button className="primary" disabled={busy} type="submit">Guardar turno</button><button disabled={busy} type="button" onClick={() => setShowGroupForm(false)}>Cancelar</button></div>
          </form>
        )}

        {form && (
          <form className="shift-manager-form" onSubmit={createSchedule}>
            <h3>Agregar horario</h3>
            <div className="shift-manager-fields">
              <label>Turno<select required value={form.groupId} onChange={event => setForm({ ...form, groupId: event.target.value })}>{data.groups.map(group => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label>
              <div className="shift-manager-auto-name">
                <span>Nombre automático</span>
                <strong>{automaticScheduleName(form, data.groups)}</strong>
              </div>
              <label>Colación (minutos)<input type="number" min={0} max={240} required value={form.breakMinutes} onChange={event => setForm({ ...form, breakMinutes: event.target.value })} /></label>
            </div>
            {form.segments.map((segment, index) => (
              <fieldset className="shift-manager-segment" key={index}>
                <legend>Tramo {index + 1}</legend>
                <label>Entrada<input type="time" required value={segment.startTime} onChange={event => updateSegment(index, 'startTime', event.target.value)} /></label>
                <label>Salida<input type="time" required value={segment.endTime} onChange={event => updateSegment(index, 'endTime', event.target.value)} /></label>
                {form.segments.length > 1 && <button type="button" disabled={busy} onClick={() => setForm(current => ({ ...current, segments: current.segments.filter((_, item) => item !== index) }))}>Quitar tramo</button>}
              </fieldset>
            ))}
            <p>Todos los horarios estarán disponibles en cualquier área. La salida puede ser al día siguiente.</p>
            <div className="shift-manager-actions">
              {form.segments.length < 4 && <button type="button" disabled={busy} onClick={() => setForm(current => ({ ...current, segments: [...current.segments, { startTime: '', endTime: '' }] }))}>Agregar tramo</button>}
              <button className="primary" disabled={busy} type="submit">Guardar horario</button>
              <button disabled={busy} type="button" onClick={() => setForm(null)}>Cancelar</button>
            </div>
          </form>
        )}

        <div className="shift-manager-tabs" role="group" aria-label="Elegir turno">
          {data.groups.map(group => <button key={group.id} type="button" disabled={busy} aria-pressed={String(group.id) === selectedId} onClick={() => { setSelectedId(String(group.id)); setSearch(''); setError(''); }}>{group.name} <span>{group.scheduleCount}</span></button>)}
        </div>
        {selected && (
          <>
            <div className="shift-manager-heading">
              <div><h3>{selected.name}</h3><p>{schedules.length} horarios · disponibles en todas las áreas.</p></div>
              <button className="danger" type="button" disabled={busy || rotativo} title={rotativo ? 'Rotativo se conserva como biblioteca común.' : `Borrar ${selected.name}`} onClick={deleteGroup}><Trash2 size={16} /> Borrar turno</button>
            </div>
            {rotativo && <p className="shift-manager-help">Rotativo se conserva como biblioteca común. Puedes agregar o borrar sus horarios sin uso.</p>}
            <label>Buscar horario<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre u horas, por ejemplo 19:00" /></label>
            <div className="shift-manager-table">
              <table>
                <thead><tr><th>Horario</th><th>Nombre / referencia</th><th>Horas efectivas</th><th>Colación</th><th>Acciones</th></tr></thead>
                <tbody>
                  {visible.map(shift => <tr key={shift.id}><td><strong>{shift.label}</strong></td><td>{shift.name}</td><td>{Math.floor(shift.workMinutes / 60)}h {String(shift.workMinutes % 60).padStart(2, '0')}m</td><td>{shift.breakMinutes} min</td><td><button className="danger" type="button" disabled={busy} onClick={() => deleteSchedule(shift)}><Trash2 size={16} /> Borrar horario</button></td></tr>)}
                  {!visible.length && <tr><td colSpan={5}>{schedules.length ? 'No hay horarios que coincidan con la búsqueda.' : 'Este turno aún no tiene horarios. Usa «Agregar horario».'}</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </section>
  );
}
