// En una cuenta propia, el titular SIEMPRE se deriva de la ficha actual.
// Nunca reenviar datos cifrados antiguos como si siguieran siendo los vigentes.
export function bankPayloadForSave(data,{thirdParty,workerName,workerRut}) {
  return {...data,bankId:Number(data.bankId),
    holderName:thirdParty?data.holderName:workerName,
    holderRut:thirdParty?data.holderRut:workerRut
  };
}
