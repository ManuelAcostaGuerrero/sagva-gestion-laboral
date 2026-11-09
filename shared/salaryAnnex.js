// Regla única para la vista previa y la aprobación de anexos salariales.
const salaryLimit=1000000000000;
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
export function calculateApprovedSalary({currentSalary,amountMeaning,agreedAmount}){
 if(!Number.isSafeInteger(agreedAmount)||agreedAmount<=0||agreedAmount>salaryLimit)
   fail('El monto del anexo debe ser un entero positivo en pesos.');
 if(amountMeaning==='NEW_BASE')return agreedAmount;
 if(amountMeaning!=='INCREASE')fail('Indica nuevo sueldo base o monto de aumento.');
 if(!Number.isSafeInteger(currentSalary)||currentSalary<=0)
   fail('Para sumar un aumento primero registra el sueldo base vigente.');
 const total=currentSalary+agreedAmount;
 if(!Number.isSafeInteger(total)||total>salaryLimit)
   fail('El nuevo sueldo supera el máximo permitido.');
 return total;
}
