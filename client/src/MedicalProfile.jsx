import DateField from './DateField.jsx';
import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { api } from './services/api.js';
import { MEDICAL_GROUPS, BLOOD_TYPES, emptyMedicalProfile } from '../../server/src/medicalProfileFields.js';
import './medicalProfile.css';
import {formatRut} from '../../server/src/rut.js';

const MedicalProfile = forwardRef(function MedicalProfile({ employeeId, fullName, documentId, onDirtyChange },ref) {
  const [draft, setDraft] = useState(emptyMedicalProfile);
  const [saved, setSaved] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty = saved !== null && JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api('/medical-profiles/workers/' + employeeId)
      .then(result => {
        if (!active) return;
        setSaved(result.profile);
        setDraft(structuredClone(result.profile));
        setUpdatedAt(result.updatedAt);
      })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [employeeId]);

  function change(key, value) {
    setDraft(old => ({ ...old, [key]: value }));
  }
  function changeCondition(key, field, value) {
    setDraft(old => ({
      ...old,
      conditions: {
        ...old.conditions,
        [key]: { ...old.conditions[key], [field]: value }
      }
    }));
  }
  async function saveChanges() {
    if (!dirty) return;
    if (loading || busy || saved === null) throw new Error('La ficha médica aún está cargando.');
    setBusy(true);
    setError('');
    try {
      const result = await api('/medical-profiles/workers/' + employeeId, {
        method: 'PUT',
        body: JSON.stringify(draft)
      });
      setSaved(result.profile);
      setDraft(structuredClone(result.profile));
      setUpdatedAt(new Date().toLocaleString('es-CL'));
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  useImperativeHandle(ref,()=>({saveChanges,isDirty:()=>dirty}),[dirty,draft,loading,busy,saved,employeeId]);
  return (
    <section className="mp-module" aria-label="Ficha médica del trabajador" onKeyDown={event => {
      if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') event.preventDefault();
    }}>
      <div className="mp-heading">
        <div><h3>Ficha médica del trabajador</h3>
          <p>Antecedentes declarados · Acceso restringido a administración y supervisión</p></div>
        <span className="ef-badge">{saved?.revision ? 'Registro guardado' : 'Sin ficha registrada'}</span>
      </div>
      <div className="mp-identity">
        <div><span>Trabajador</span><strong>{fullName || 'Nombre pendiente'}</strong></div>
        <div><span>RUT / documento</span><strong>{formatRut(documentId) || 'Sin informar'}</strong></div>
        <label>Fecha de la ficha
          <DateField  value={draft.filledOn} disabled={loading || busy}
            onChange={event => change('filledOn', event.target.value)} />
        </label>
      </div>
      <p className="mp-privacy">Información de salud sensible. Registrar únicamente los antecedentes necesarios cuando exista una base jurídica válida; no compartirla con operadores ni usarla para decisiones discriminatorias. Esta ficha no reemplaza una evaluación médica.</p>
      {loading && <p className="ef-note">Cargando ficha médica…</p>}
      {error && <p className="ef-note" role="alert">{error}</p>}
      {!loading && MEDICAL_GROUPS.map(group => (
        <fieldset key={group.title} className="ef-section mp-section" disabled={busy}>
          <legend>{group.title}</legend>
          <div className="mp-column-head" aria-hidden="true">
            <span>Antecedente</span><span>Respuesta</span><span>Observaciones / diagnóstico / controles / medicamentos</span>
          </div>
          {group.items.map(({ key, label }) => (
            <div className="mp-condition" key={key}>
              <strong>{label}</strong>
              <div className="mp-answer-cell">
                <div className="mp-radio-group" role="radiogroup" aria-label={label + ': respuesta'}>
                  <label className="mp-radio-option">
                    <input type="radio" name={`medical-answer-${employeeId}-${key}`} value="SI"
                      checked={draft.conditions[key].answer === 'SI'}
                      onChange={() => changeCondition(key, 'answer', 'SI')} />
                    <span>Sí</span>
                  </label>
                  <label className="mp-radio-option">
                    <input type="radio" name={`medical-answer-${employeeId}-${key}`} value="NO"
                      checked={draft.conditions[key].answer === 'NO'}
                      onChange={() => changeCondition(key, 'answer', 'NO')} />
                    <span>No</span>
                  </label>
                </div>
                {draft.conditions[key].answer ? (
                  <button type="button" className="mp-clear-answer"
                    aria-label={`Quitar respuesta de ${label}`}
                    onClick={() => changeCondition(key, 'answer', '')}>
                    Quitar selección
                  </button>
                ) : (
                  <span className="mp-unanswered">Sin informar</span>
                )}
              </div>
              <label>Observaciones
                <textarea rows={2} maxLength={500} value={draft.conditions[key].notes}
                  aria-label={label + ': observaciones'}
                  onChange={event => changeCondition(key, 'notes', event.target.value)} />
              </label>
            </div>
          ))}
          {group.title === 'Antecedentes generales' && <div className="mp-condition">
            <strong>Grupo sanguíneo</strong>
            <label>Grupo / Rh
              <select aria-label="Grupo sanguíneo" value={draft.bloodType}
                onChange={event => change('bloodType', event.target.value)}>
                <option value="">Sin informar</option>
                {BLOOD_TYPES.filter(Boolean).map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label>Observaciones
              <textarea rows={2} maxLength={500} value={draft.bloodNotes}
                aria-label="Grupo sanguíneo: observaciones"
                onChange={event => change('bloodNotes', event.target.value)} />
            </label>
          </div>}
        </fieldset>
      ))}
      {!loading && <div className="mp-actions" aria-live="polite">
        <span>{dirty ? 'Cambios pendientes: usa Guardar ficha (botón general).' : 'Sin cambios pendientes'}{updatedAt ? ' · Última actualización: ' + updatedAt : ''}</span>
      </div>}
    </section>
  );
});
export default MedicalProfile;
