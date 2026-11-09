// Estado exclusivamente de interfaz: la validación temporal no modifica el
// guardado de la ficha ni reemplaza el estado laboral del trabajador.
export function pendingFileSections({general = false, medical = false, contract = false, documents = false, family = false, bank = false} = {}) {
  return [
    general && 'Ficha general',
    medical && 'Ficha médica',
    contract && 'Condiciones contractuales',
    family && 'Cargas familiares',
    bank && 'Cuenta bancaria',
    documents && 'Documento laboral en preparación'
  ].filter(Boolean);
}

export function canCloseAfterValidation({completed = false, validated = false, medical = false, contract = false} = {}) {
  return completed && validated && !medical && !contract;
}

// El botón aparece para trabajadores que todavía requieren revisión y fichas nuevas.
// Una vez revisados todos, no queda acción de validación visible en fichas validadas.
export function showReviewAction({status = 'NO_VALIDADO'} = {}) {
  return status !== 'VALIDADO';
}

export function canCloseAfterSuccessfulSave({savedSections=[],documents=false}={}){
  return savedSections.length>0 && !documents;
}
