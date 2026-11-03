const clock = (value) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw new Error("Hora invalida; usa HH:MM.");
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};
export function normalizeSegments(segments, breakMinutes = 30) {
  if (!Array.isArray(segments) || segments.length < 1 || segments.length > 4)
    throw new Error("Define entre uno y cuatro tramos.");
  let previousEnd = 0;
  const normalized = segments.map((segment, index) => {
    const startTime = String(segment.startTime).slice(0, 5),
      endTime = String(segment.endTime).slice(0, 5);
    const startClock = clock(startTime),
      endClock = clock(endTime);
    if (startClock === endClock)
      throw new Error("Inicio y fin del tramo deben ser distintos.");
    const startDayOffset = index === 0 ? 0 : Math.floor(previousEnd / 1440);
    const endDayOffset = startDayOffset + (endClock < startClock ? 1 : 0);
    const start = startDayOffset * 1440 + startClock,
      end = endDayOffset * 1440 + endClock;
    if (index && start < previousEnd)
      throw new Error("Los tramos se superponen o estan fuera de orden.");
    if (end > 2880)
      throw new Error("El turno no puede extenderse mas de dos dias.");
    previousEnd = end;
    return {
      startTime,
      endTime,
      startDayOffset,
      endDayOffset,
      startMinute: start,
      endMinute: end,
    };
  });
  const grossMinutes = normalized.reduce(
    (sum, s) => sum + s.endMinute - s.startMinute,
    0,
  );
  const meal = Number(breakMinutes);
  if (!Number.isInteger(meal) || meal < 0 || meal > 240 || meal >= grossMinutes)
    throw new Error(
      "La colacion debe ser entre 0 y 240 minutos y menor que la jornada.",
    );
  if (grossMinutes > 1440) throw new Error("Los tramos suman mas de 24 horas.");
  const kind =
    normalized.length > 1
      ? "split"
      : normalized[0].endDayOffset
        ? "night"
        : normalized[0].startMinute < 720
          ? "morning"
          : "middle";
  return {
    segments: normalized,
    breakMinutes: meal,
    grossMinutes,
    workMinutes: grossMinutes - meal,
    kind,
    label: normalized
      .map(
        (s) =>
          `${s.startTime}–${s.endTime}`,
      )
      .join(" / "),
  };
}
export function shiftPresentation(row, segments) {
  const model = normalizeSegments(
    segments?.length
      ? segments
      : [{ startTime: row.startTime, endTime: row.endTime }],
    Number(row.breakMinutes),
  );
  return { ...row, ...model };
}
export function weekDates(weekStart) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart))
    throw new Error("Fecha de semana invalida.");
  const date = new Date(`${weekStart}T12:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== weekStart ||
    date.getUTCDay() !== 1
  )
    throw new Error("La semana debe comenzar un lunes valido.");
  return Array.from({ length: 7 }, (_, i) =>
    new Date(date.getTime() + i * 86400000).toISOString().slice(0, 10),
  );
}
