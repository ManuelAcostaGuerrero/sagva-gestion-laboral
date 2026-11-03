import React from 'react';
const COUNTRY_CODES=[['+56','Chile (+56)'],['+58','Venezuela (+58)'],['+57','Colombia (+57)'],['+51','Perú (+51)'],['+54','Argentina (+54)'],['+1','EE. UU./Canadá (+1)'],['+34','España (+34)'],['+593','Ecuador (+593)'],['+591','Bolivia (+591)'],['+55','Brasil (+55)']];
export default function PhoneField({label,value,onChange,mobile=false}){
 const raw=String(value||'');
 const found=COUNTRY_CODES.map(v=>v[0]).sort((a,b)=>b.length-a.length).find(prefix=>raw.startsWith(prefix));
 const code=found||(!raw?'+56':'OTHER');
 const local=found?raw.slice(found.length).trim():raw;
 return <label>{label}
  <span className="ef-phone-input">
   <select aria-label={'Código de país de '+label} value={code} onChange={e=>{
    const next=e.target.value;
    if(next==='OTHER')onChange(raw.startsWith('+')?raw:'+'+local.replace(/\D/g,''));
    else onChange(local?next+local.replace(/\D/g,''):'');
   }}>
    {COUNTRY_CODES.map(([value,text])=><option key={value} value={value}>{text}</option>)}
    <option value="OTHER">Otro código</option>
   </select>
   <input type="tel" autoComplete="tel" aria-label={label}
    placeholder={code==='OTHER'?'+Código y número':mobile?'9XXXXXXXX':'XXXXXXXXX'}
    value={local} onChange={e=>onChange(code==='OTHER'?e.target.value:(e.target.value.trim()?code+e.target.value.replace(/[^\d]/g,''):''))}/>
  </span>
 </label>;
}
