import React, {useEffect, useRef, useState} from 'react';
import {CalendarDays} from 'lucide-react';
import './DateField.css';

import {validIsoDate,displayDate,maskDate,isoFromDisplay,inRange} from './dateFormat.js';

export default function DateField({value = '', onChange, min, max, disabled = false, required = false, name, id, 'aria-label': ariaLabel}) {
  const safeValue = validIsoDate(value) ? value : '';
  const [text, setText] = useState(() => displayDate(safeValue));
  const [error, setError] = useState('');
  const pickerRef = useRef(null);
  const typedRef = useRef(null);
  const replaceOnType = useRef(false);
  useEffect(() => {
    setText(displayDate(safeValue));
    setError('');
  }, [safeValue]);
  const commit = iso => {
    setError('');
    setText(displayDate(iso));
    if (iso !== value) onChange?.({target: {value: iso}});
  };
  // Primera cifra en un campo con fecha existente: comenzar desde cero.
  // La fecha persistida solo se sustituye al completar una fecha válida.
  function startReplacement(fragment) {
    const formatted=maskDate(fragment);
    replaceOnType.current=false;
    setText(formatted);
    setError('');
    if (formatted.length === 10) {
      const parsed=isoFromDisplay(formatted);
      if (parsed && inRange(parsed,min,max)) { commit(parsed); return; }
    }
    requestAnimationFrame(()=>typedRef.current?.setSelectionRange(formatted.length,formatted.length));
  }
  function onFirstKey(event) {
    if (!replaceOnType.current || event.ctrlKey || event.altKey || event.metaKey) return;
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      startReplacement(event.key);
    }
  }
  function onFirstInput(event) {
    const typed=event.data;
    if (replaceOnType.current && typed && /^[0-9]+$/.test(typed)) {
      event.preventDefault();
      startReplacement(typed);
    }
  }
  function edit(event) {
    replaceOnType.current=false;
    const formatted = maskDate(event.target.value);
    setText(formatted);
    setError('');
    if (!formatted) {
      if (value) onChange?.({target:{value:''}});
      return;
    }
    if (formatted.length === 10) {
      const iso = isoFromDisplay(formatted);
      if (iso && inRange(iso, min, max)) commit(iso);
      else setError('Fecha inválida. Usa DD/MM/AAAA y un año de cuatro cifras.');
    }
  }
  function finish() {
    replaceOnType.current=false;
    if (!text) return;
    if (isoFromDisplay(text) && inRange(isoFromDisplay(text), min, max)) return;
    // Nunca dejar que una fecha incompleta sobrescriba una fecha persistida.
    setText(displayDate(safeValue));
    setError('Fecha no válida: usa DD/MM/AAAA (año de cuatro cifras).');
  }
  function openCalendar() {
    const picker = pickerRef.current;
    if (!picker) return;
    try {
      if (typeof picker.showPicker === 'function') picker.showPicker();
      else { picker.focus(); picker.click(); }
    } catch {
      picker.focus();
      picker.click();
    }
  }
  return <span className="fixed-date-container">
    <span className="fixed-date-control">
      <input ref={typedRef} type="text" id={id} name={name} value={text} disabled={disabled} required={required}
        inputMode="numeric" autoComplete="off" maxLength={10} placeholder="DD/MM/AAAA"
        pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" aria-label={ariaLabel}
        aria-invalid={Boolean(error)} onChange={edit} onBlur={finish}
        onFocus={event=>{replaceOnType.current=Boolean(safeValue);if(safeValue)event.target.select();}}
        onKeyDown={onFirstKey} onBeforeInput={onFirstInput}
        title="Fecha DD/MM/AAAA, con cuatro cifras para el año"/>
      <input ref={pickerRef} className="fixed-date-native" aria-hidden="true" tabIndex={-1}
        type="date" disabled={disabled} min={validIsoDate(min)?min:undefined}
        max={validIsoDate(max)?max:'9999-12-31'} value={safeValue}
        onChange={event => {
          const iso = event.target.value;
          if (validIsoDate(iso) && inRange(iso, min, max)) commit(iso);
        }}/>
      <button type="button" className="fixed-date-button" aria-label="Elegir fecha en calendario"
        title="Abrir calendario" disabled={disabled} onClick={openCalendar}>
        <CalendarDays size={17} aria-hidden="true"/>
      </button>
    </span>
    {error && <span className="fixed-date-error" role="alert">{error}</span>}
  </span>;
}
