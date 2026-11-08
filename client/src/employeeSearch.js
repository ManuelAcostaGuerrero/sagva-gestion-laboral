import { normalizeRut } from '../../server/src/rut.js';
// No cambiar la búsqueda textual ni forzar un RUT válido durante una búsqueda parcial.
export function matchesEmployeeSearch(file, rawSearch) {
  const text = String(rawSearch ?? '').trim();
  if (!text) return true;
  const lower = text.toLocaleLowerCase('es-CL');
  if ([file.fullName, file.company, file.documentId].some(value =>
    String(value ?? '').toLocaleLowerCase('es-CL').includes(lower))) return true;
  if (!/^[\d.\s-kK]+$/.test(text)) return false;
  const lookup = normalizeRut(text);
  return Boolean(lookup) && normalizeRut(file.documentId).includes(lookup);
}
