import React, {useEffect, useState} from 'react';
import DateField from './DateField.jsx';
import {validIsoDate} from './dateFormat.js';
import './DateField.css';

// Evita el campo nativo datetime-local (año sin límite de dígitos) y conserva el
// valor ISO YYYY-MM-DDTHH:mm que ya consume el servidor de marcación manual.
const split = value => {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return match && validIsoDate(match[1]) ? {date:match[1],time:match[2]} : {date:'',time:''};
};
export default function DateTimeField({value='', onChange, disabled=false, required=false}) {
  const [draft,setDraft]=useState(()=>split(value));
  useEffect(()=>setDraft(split(value)),[value]);
  function update(part,newValue) {
    const next={...draft,[part]:newValue};
    setDraft(next);
    const joined=next.date && /^([01]\d|2[0-3]):[0-5]\d$/.test(next.time) ? next.date+'T'+next.time : '';
    if(joined!==value)onChange?.({target:{value:joined}});
  }
  return <span className="fixed-datetime-container">
    <DateField value={draft.date} disabled={disabled} required={required} aria-label="Fecha (día, mes y año)"
      onChange={event=>update('date',event.target.value)}/>
    <input type="time" aria-label="Hora de marcación" value={draft.time}
      disabled={disabled} required={required} onChange={event=>update('time',event.target.value)}/>
  </span>;
}
