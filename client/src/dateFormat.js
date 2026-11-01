// ISO se conserva en toda la API/base de datos; DD/MM/AAAA es solo presentación.
export function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const year = Number(value.slice(0, 4));
  if (year < 1 || year > 9999) return false;
  const parsed = new Date(value + 'T12:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function displayDate(iso) {
  return validIsoDate(iso) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
}
export function maskDate(raw) {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/');
}
export function isoFromDisplay(value) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value || '')) return '';
  const iso = value.slice(6) + '-' + value.slice(3, 5) + '-' + value.slice(0, 2);
  return validIsoDate(iso) ? iso : '';
}
export const inRange = (iso, min, max) =>
  (!validIsoDate(min) || iso >= min) && (!validIsoDate(max) || iso <= max);

