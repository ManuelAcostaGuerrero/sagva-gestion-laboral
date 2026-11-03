import React, {useEffect, useRef, useState} from 'react';
import {CalendarDays} from 'lucide-react';
import './DateField.css';

const validMonth = value => /^\d{4}-(0[1-9]|1[0-2])$/.test(value || '') && Number(value.slice(0,4)) >= 1;
const display = value => validMonth(value) ? value.slice(5,7)+'/'+value.slice(0,4) : '';
export default function MonthField({value='',onChange,disabled=false}) {
  const safe=validMonth(value)?value:'';
  const [text,setText]=useState(()=>display(safe));
  const [error,setError]=useState('');
  const picker=useRef(null);
  const typedRef=useRef(null);
  const replaceOnType=useRef(false);
  useEffect(()=>{setText(display(safe));setError('');},[safe]);
  function startReplacement(fragment){
    const digits=String(fragment).replace(/\D/g,'').slice(0,6);
    replaceOnType.current=false;
    const formatted=digits.slice(0,2)+(digits.length>2?'/'+digits.slice(2):'');
    setText(formatted);
    setError('');
    if (formatted.length===7) {
      const iso=formatted.slice(3)+'-'+formatted.slice(0,2);
      if (validMonth(iso)) { onChange?.({target:{value:iso}}); return; }
    }
    requestAnimationFrame(()=>typedRef.current?.setSelectionRange(formatted.length,formatted.length));
  }
  function firstKey(event){
    if(replaceOnType.current && !event.ctrlKey && !event.altKey && !event.metaKey && /^[0-9]$/.test(event.key)){
      event.preventDefault();startReplacement(event.key);
    }
  }
  function firstInput(event){
    if(replaceOnType.current && event.data && /^[0-9]+$/.test(event.data)){
      event.preventDefault();startReplacement(event.data);
    }
  }
  function edit(event){
    replaceOnType.current=false;
    const digits=event.target.value.replace(/\D/g,'').slice(0,6);
    const formatted=digits.slice(0,2)+(digits.length>2?'/'+digits.slice(2):'');
    setText(formatted);setError('');
    if(!formatted && value){onChange?.({target:{value:''}});return;}
    if(/^\d{2}\/\d{4}$/.test(formatted)){
      const iso=formatted.slice(3)+'-'+formatted.slice(0,2);
      if(validMonth(iso)){
        if(iso!==value)onChange?.({target:{value:iso}});
      } else setError('Mes inválido. Usa MM/AAAA.');
    }
  }
  function finish(){
    replaceOnType.current=false;
    if(text && !(text.length===7 && validMonth(text.slice(3)+'-'+text.slice(0,2)))){
      setText(display(safe));setError('Usa MM/AAAA con un año de cuatro cifras.');
    }
  }
  function open(){
    try{picker.current?.showPicker?.();}catch{picker.current?.focus();}
  }
  return <span className="fixed-date-container">
    <span className="fixed-date-control">
      <input ref={typedRef} type="text" inputMode="numeric" value={text} disabled={disabled}
        maxLength={7} placeholder="MM/AAAA" pattern="[0-9]{2}/[0-9]{4}"
        aria-invalid={!!error} onBlur={finish} onChange={edit}
        onFocus={event=>{replaceOnType.current=Boolean(safe);if(safe)event.target.select();}}
        onKeyDown={firstKey} onBeforeInput={firstInput}/>
      <input ref={picker} className="fixed-date-native" tabIndex={-1} aria-hidden="true"
        type="month" value={safe} disabled={disabled} max="9999-12"
        onChange={e=>{if(validMonth(e.target.value)){setText(display(e.target.value));setError('');onChange?.({target:{value:e.target.value}});}}}/>
      <button type="button" className="fixed-date-button" disabled={disabled} onClick={open}
        title="Seleccionar mes" aria-label="Elegir mes en calendario">
        <CalendarDays size={17} aria-hidden="true"/>
      </button>
    </span>
    {error&&<span className="fixed-date-error" role="alert">{error}</span>}
  </span>;
}
