// Cálculo de consulta con tramos oficiales suministrados por API.
// Requiere renta semestral acreditada y cargas reconocidas vigentes.
export function familyAllowancePreview({status,dependents=[],averageIncomeClp=null,incomeVerified=false,brackets=[],on}={}){
 const recognized=status==='RECOGNIZED'?dependents.filter(d=>d.recognitionStatus==='RECOGNIZED'&&(!d.validFrom||d.validFrom<=on)&&(!d.validUntil||d.validUntil>=on)).length:0;
 const validIncome=incomeVerified&&Number.isSafeInteger(averageIncomeClp)&&averageIncomeClp>=0;
 const bracket=validIncome?brackets.find(t=>averageIncomeClp>=t.incomeFrom&&(t.incomeTo===null||averageIncomeClp<=t.incomeTo)):null;
 return {recognized,bracket:bracket||null,unitClp:bracket?.amountClp??null,totalClp:bracket?bracket.amountClp*recognized:null,
  ready:Boolean(bracket),automaticPayroll:false};
}
