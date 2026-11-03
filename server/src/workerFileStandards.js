import {checkRut} from './rut.js';
import {validContractDate} from './employeeContracts.js';

export const SEX_OPTIONS=['MASCULINO','FEMENINO','OTRO','PREFIERO NO DECIRLO'];
export const CIVIL_STATUS_OPTIONS=['SOLTERO/A','CASADO/A','DIVORCIADO/A','VIUDO/A','CONVIVIENTE CIVIL','PREFIERO NO DECIRLO'];
export const NATIONALITIES=['CHILENA','VENEZOLANA','PERUANA','COLOMBIANA','ARGENTINA','BOLIVIANA','ECUATORIANA','BRASILEÑA','PARAGUAYA','URUGUAYA','HAITIANA','CUBANA','DOMINICANA','MEXICANA','ESPAÑOLA','OTRA'];
export const normalizeLabel=value=>String(value??'').trim().replace(/\s+/g,' ').toLocaleUpperCase('es-CL');
export const workerNumberFromRut=value=>{
  const rut=checkRut(value);
  return rut.valid?rut.normalized.slice(0,-1):'';
};
export function assembledWorkerName(data){
  return ['firstName','secondName','otherNames','firstLastName','secondLastName']
    .map(k=>normalizeLabel(data[k])).filter(Boolean).join(' ');
}
// Only normalize a telephone when a user edits it; old imported strings are preserved.
export function phoneResult(value,{mobile=false}={}){
  const raw=String(value??'').trim();
  if(!raw)return {value:'',valid:true};
  if(!/^\+?[\d\s().-]+$/.test(raw))return {value:raw,valid:false};
  const digits=raw.replace(/\D/g,'');
  let international;
  if(raw.startsWith('+'))international=digits;
  else if(digits.startsWith('56')&&digits.length===11)international=digits;
  else if(digits.length===9)international='56'+digits;
  else return {value:raw,valid:false};
  if(!/^\d{8,15}$/.test(international))return {value:raw,valid:false};
  if(international.startsWith('56')){
    if(international.length!==11)return {value:raw,valid:false};
    const local=international.slice(2);
    if(mobile && !/^9\d{8}$/.test(local))return {value:raw,valid:false};
    if(!mobile && !/^[2-9]\d{8}$/.test(local))return {value:raw,valid:false};
  }
  return {value:'+'+international,valid:true};
}
export function completeFileMissing(file){
  const missing=[];
  if(!String(file.firstName||'').trim())missing.push('Primer nombre');
  if(!String(file.firstLastName||'').trim())missing.push('Primer apellido');
  if(!checkRut(file.documentId).valid)missing.push('RUT válido');
  for(const [key,label] of [['birthDate','Fecha de nacimiento'],['address','Dirección'],['company','Empresa'],['positionName','Cargo'],['workAreaId','Área'],['workSchedule','Jornada'],['contractType','Tipo de contrato'],['hireDate','Fecha de inicio'],['email','Correo electrónico']]){
    if(!String(file[key]??'').trim())missing.push(label);
  }
  if(!String(file.mobile||file.phone||'').trim())missing.push('Teléfono o celular');
  for(const [key,label] of [['birthDate','Fecha de nacimiento'],['hireDate','Fecha de inicio']]){
    if(file[key]&&!validContractDate(file[key]))missing.push(label+' válida');
  }
  if(file.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(file.email))missing.push('Correo electrónico válido');
  if(file.mobile&&!phoneResult(file.mobile,{mobile:true}).valid)missing.push('Celular válido');
  if(file.phone&&!phoneResult(file.phone,{mobile:false}).valid)missing.push('Teléfono válido');
  if(file.contractType==='PLAZO_FIJO'){
    if(!file.terminationDate)missing.push('Fecha de término de contrato');
    else if(!validContractDate(file.terminationDate)||file.hireDate&&file.terminationDate<file.hireDate)missing.push('Fecha de término válida');
  }
  return missing;
}
