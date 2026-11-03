// Local Chilean modulo-11 validation. Missing/invalid values are review warnings.
export const normalizeRut = value => String(value ?? '').replace(/[.\s-]/g, '').toUpperCase();
export function checkRut(value) {
  const normalized = normalizeRut(value);
  if (!normalized) return {status: 'PENDIENTE', normalized: '', formatted: '', valid: false};
  if (!/^\d{1,8}[\dK]$/.test(normalized)) return {status: 'REVISAR', normalized, formatted: String(value), valid: false};
  const body = normalized.slice(0, -1), digit = normalized.slice(-1);
  let sum = 0, factor = 2;
  for (const n of [...body].reverse()) {sum += Number(n) * factor; factor = factor === 7 ? 2 : factor + 1;}
  const remainder = 11 - sum % 11;
  const expected = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);
  const valid = Number(body) > 0 && digit === expected;
  return {status: valid ? 'CORRECTO' : 'REVISAR', normalized, formatted: `${body}-${digit}`, valid};
}

// Presentation only: preserve invalid values for review without inventing digits.
export function formatRut(value) {
  const normalized=normalizeRut(value);
  if(!/^\d{1,8}[\dK]$/.test(normalized))return String(value??'').toUpperCase();
  const body=normalized.slice(0,-1),digit=normalized.slice(-1);
  return body.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+'-'+digit;
}
