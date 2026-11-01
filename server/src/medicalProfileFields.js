// Catálogo común de campos; no contiene información de trabajadores.
export const MEDICAL_GROUPS = [
  { title: 'Enfermedades', items: [
    { key: 'epilepsia', label: 'Epilepsia' },
    { key: 'lumbago', label: 'Lumbago' },
    { key: 'hipertensionArterial', label: 'Hipertensión arterial' },
    { key: 'diabetes', label: 'Diabetes' },
    { key: 'asma', label: 'Asma' },
    { key: 'claustrofobia', label: 'Claustrofobia' },
    { key: 'enfermedadInmunodepresora', label: 'Enfermedad inmunodepresora' },
    { key: 'otrasEnfermedades', label: 'Otras enfermedades' }
  ] },
  { title: 'Antecedentes generales', items: [
    { key: 'accidente', label: 'Accidente / fractura / esguince / TEC' },
    { key: 'tratamientosMedicos', label: 'Tratamientos médicos' }
  ] },
  { title: 'Otras consideraciones', items: [
    { key: 'alergias', label: 'Alergia' },
    { key: 'protesis', label: 'Prótesis' },
    { key: 'ortesis', label: 'Órtesis (apoyo externo al cuerpo)' },
    { key: 'discapacidad', label: 'Discapacidad' },
    { key: 'otrasConsideraciones', label: 'Otras' }
  ] }
];
export const MEDICAL_KEYS = MEDICAL_GROUPS.flatMap(group => group.items.map(item => item.key));
export const BLOOD_TYPES = ['', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
export function emptyMedicalProfile() {
  return {
    revision: 0,
    filledOn: '',
    bloodType: '',
    bloodNotes: '',
    conditions: Object.fromEntries(MEDICAL_KEYS.map(key => [key, { answer: '', notes: '' }]))
  };
}
