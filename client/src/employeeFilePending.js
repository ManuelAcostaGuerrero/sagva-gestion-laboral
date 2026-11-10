// Una única fuente para presentar y localizar el resultado de completeFileMissing.
// Las reglas de validación viven en server/src/workerFileStandards.js.
export const PENDING_TARGETS={
 'Primer nombre':['personal','firstName'],
 'Primer apellido':['personal','firstLastName'],
 'RUT válido':['personal','documentId'],
 'Fecha de nacimiento':['personal','birthDate'],
 'Fecha de nacimiento válida':['personal','birthDate'],
 'Dirección':['personal','address'],
 'Correo electrónico':['personal','email'],
 'Correo electrónico válido':['personal','email'],
 'Empresa':['laboral','companyId'],
 'Cargo':['laboral','positionName'],
 'Área':['laboral','workAreaId'],
 'Jornada':['laboral','workSchedule'],
 'Tipo de contrato':['laboral','contractType'],
 'Fecha de inicio':['laboral','hireDate'],
 'Fecha de inicio válida':['laboral','hireDate'],
 'Fecha de término de contrato':['laboral','terminationDate'],
 'Fecha de término válida':['laboral','terminationDate'],
 'Teléfono o celular':['personal','mobile'],
 'Teléfono válido':['personal','phone'],
 'Celular válido':['personal','mobile']
};
export const pendingTarget=label=>PENDING_TARGETS[label]||null;
export const fieldPending=(missing,field)=>missing.some(label=>pendingTarget(label)?.[1]===field);
