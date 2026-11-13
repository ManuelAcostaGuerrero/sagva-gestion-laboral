import React,{useState} from 'react';
import {pesoDigits,formatPeso} from './pesoFormat.js';
// Mientras se escribe, nunca vuelve a formatear el texto ni mueve el cursor.
export default function PesoField({value,onChange,disabled=false,required=false,...props}){
 const [editing,setEditing]=useState(false),[raw,setRaw]=useState('');
 const digits=pesoDigits(value);
 return <input {...props} type="text" inputMode="numeric" autoComplete="off" value={editing?raw:formatPeso(value)} disabled={disabled} required={required}
  onFocus={()=>{setRaw(digits);setEditing(true);}} onBlur={()=>setEditing(false)}
  onChange={event=>{const next=pesoDigits(event.target.value);if(next.length>15||!Number.isSafeInteger(Number(next)))return;setRaw(next);onChange(next);}}/>;
}
