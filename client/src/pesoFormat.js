export const pesoDigits=value=>String(value??'').replace(/[^0-9]/g,'');
export function formatPeso(value){
 if(value===null||value===undefined||value==='')return '';
 const digits=pesoDigits(value),n=Number(digits);
 return digits&&Number.isSafeInteger(n)?'$ '+n.toLocaleString('es-CL'):'';
}
