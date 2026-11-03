// Estado exclusivamente de interfaz: la validación temporal no modifica el
// guardado de la ficha ni reemplaza el estado laboral del trabajador.
export function pendingFileSections({general = false, medical = false, contract = false} = {}) {
  return [
    general && 'Ficha general',
    medical && 'Ficha médica',
    contract && 'Condiciones contractuales'
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
