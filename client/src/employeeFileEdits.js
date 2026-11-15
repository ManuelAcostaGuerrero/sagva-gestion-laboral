import {assembledWorkerName,normalizeLabel} from '../../server/src/workerFileStandards.js';
import {normalizeRut} from '../../server/src/rut.js';

// La normalización de espacios SOLO se hace al guardar; hacerlo en cada tecla
// impedía escribir nombres compuestos como "MARÍA JOSÉ".
const nameParts=['firstName','secondName','otherNames','firstLastName','secondLastName'];
const uppercaseFields=new Set([...nameParts,'fullName','legalFullName','email','company','terminationReason']);
export const clearablePersonalFields=[
  'email','positionName','workAreaId','company','workSchedule','hireDate',
  'terminationDate','contractType','birthDate','address','phone','mobile',
  'observations','firstName','secondName','otherNames','firstLastName',
  'secondLastName','validationNotes','terminationReason','employmentStatus'
];

export function changeEmployeeDraft(current,key,value) {
  const normalized=key==='address'||uppercaseFields.has(key)
    ? String(value??'').toLocaleUpperCase('es-CL') : value;
  const next={...current,[key]:normalized};
  if(nameParts.includes(key)){
    const assembled=assembledWorkerName(next);
    if(assembled)next.fullName=assembled;
    // Si el nombre legal era espejo del nombre completo, mantener ambos
    // alineados. No sobrescribir un nombre legal que se editó explícitamente.
    const legal=normalizeLabel(current.legalFullName);
    const previousAuto=normalizeLabel(assembledWorkerName(current));
    const previousFull=normalizeLabel(current.fullName);
    if(assembled&&(!current.id||!legal||legal===previousAuto||legal===previousFull))
      next.legalFullName=assembled;
  }
  return next;
}

const trimmed=value=>String(value??'').trim();

export function unconfirmedEmployeeClears(draft,saved) {
  const allowed=new Set(draft?.clearFields||[]);
  return clearablePersonalFields.filter(key=>
    trimmed(saved?.[key])&&!trimmed(draft?.[key])&&!allowed.has(key)
  );
}

const comparison=(key,value)=>key==='documentId'
  ? normalizeRut(value):normalizeLabel(value);

export function unpersistedPersonalEdits(before,submitted,returned) {
  // Solo los campos modificados: no bloquea fichas históricas con datos antiguos
  // que fueron preservados expresamente por el servidor.
  const keys=[...nameParts,'legalFullName','email','documentId','address','phone','mobile','birthDate'];
  return keys.filter(key=>
    comparison(key,submitted?.[key])!==comparison(key,before?.[key]) &&
    comparison(key,submitted?.[key])!==comparison(key,returned?.[key])
  );
}
