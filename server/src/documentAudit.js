const cleanWords = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const validDate = value => /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(String(value || ''));

export function canonicalDocumentName(value) {
  const normalized = cleanWords(value);
  if (!normalized) return 'SIN NOMBRE';
  const compact = normalized.replace(/\s+/g, '');
  if (compact === 'IRL' || /^IRL20\d{2}$/.test(compact) || normalized === 'INFORME IRL' || normalized === 'INFORME LABORAL') {
    return 'IRL';
  }
  if (normalized.includes('PACTO') && normalized.includes('HORAS')) return 'PACTO DE HORAS';
  return normalized;
}

export function dominantDocumentPeriod(values) {
  const counts = new Map();
  for (const value of values) {
    if (!validDate(value)) continue;
    const period = String(value).slice(0, 7);
    counts.set(period, (counts.get(period) || 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  if (!total) return null;
  const [period, count] = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0];
  return { period, count, total, ratio: count / total };
}

export function classifyDocumentAudit({
  entries = [],
  applies = false,
  peerCount = 0,
  totalPeers = 0,
  dominantPeriod = null,
  comparePeriod = false,
  today = new Date().toISOString().slice(0, 10)
}) {
  if (!entries.length) {
    if (applies) {
      return { status: 'MISSING', reason: 'No hay registro de este documento para el trabajador.' };
    }
    const ratio = totalPeers ? peerCount / totalPeers : 0;
    if (totalPeers >= 3 && peerCount >= 3 && ratio >= 0.7) {
      return {
        status: 'REVIEW',
        reason: `Posible faltante: ${peerCount} de ${totalPeers} trabajadores activos tienen este documento registrado.`
      };
    }
    return { status: 'NA', reason: 'No aplica según el catálogo actual y no tiene historial.' };
  }

  const latest = [...entries].sort((a, b) => Number(b.id || 0) - Number(a.id || 0))[0];
  const referenceDate = latest.deliveredOn || latest.startOn || null;
  if (!validDate(referenceDate)) {
    return { status: 'INCOMPLETE', reason: 'El documento existe, pero no tiene una fecha válida registrada.', latest };
  }

  if (['PERIOD', 'MANUAL'].includes(latest.expiryMode)) {
    if (!validDate(latest.startOn)) {
      return { status: 'INCOMPLETE', reason: 'El documento existe, pero falta una fecha de inicio válida.', latest };
    }
    if (!validDate(latest.expiresOn)) {
      return { status: 'INCOMPLETE', reason: 'El documento existe, pero falta una fecha de término o vencimiento válida.', latest };
    }
  }

  if (validDate(latest.expiresOn) && latest.expiresOn < today) {
    return { status: 'REVIEW', reason: `El último registro venció el ${latest.expiresOn}.`, latest };
  }

  if (
    comparePeriod &&
    dominantPeriod &&
    dominantPeriod.total >= 3 &&
    dominantPeriod.ratio >= 0.6 &&
    referenceDate.slice(0, 7) !== dominantPeriod.period
  ) {
    return {
      status: 'REVIEW',
      reason: `La fecha registrada (${referenceDate.slice(0, 7)}) es distinta del patrón predominante (${dominantPeriod.period}).`,
      latest
    };
  }

  return { status: 'CORRECT', reason: 'Documento registrado sin faltas detectadas por esta auditoría.', latest };
}
