import assert from 'node:assert/strict';
import test from 'node:test';
import { attachAttendanceDurations } from '../attendancePairing.js';

test('calcula permanencia descontando colacion cerrada con marcas opuestas', () => {
  const records = attachAttendanceDurations([
    row('entrada', '2026-05-14T08:00:00'),
    row('salida_colacion', '2026-05-14T12:00:00'),
    row('entrada_colacion', '2026-05-14T12:30:00'),
    row('salida', '2026-05-14T17:00:00')
  ]);

  const exit = records.find((record) => record.type === 'salida');
  assert.equal(exit.durationSeconds, 30600);
  assert.equal(exit.deductedMealSeconds, 1800);
});

test('acepta colacion iniciada con entrada_colacion y cerrada con salida_colacion', () => {
  const records = attachAttendanceDurations([
    row('entrada', '2026-05-14T08:00:00'),
    row('entrada_colacion', '2026-05-14T12:00:00'),
    row('salida_colacion', '2026-05-14T12:20:00'),
    row('salida', '2026-05-14T16:00:00')
  ]);

  const mealClose = records.find((record) => record.type === 'salida_colacion');
  const exit = records.find((record) => record.type === 'salida');
  assert.equal(mealClose.mealDurationSeconds, 1200);
  assert.equal(exit.durationSeconds, 27600);
});

test('filtra por fecha y tipo despues de calcular pares', () => {
  const records = attachAttendanceDurations([
    row('entrada', '2026-05-13T08:00:00'),
    row('salida', '2026-05-13T17:00:00'),
    row('entrada', '2026-05-14T08:05:00'),
    row('salida', '2026-05-14T17:00:00')
  ], { from: '2026-05-14', to: '2026-05-14', type: 'salida' });

  assert.equal(records.length, 1);
  assert.equal(records[0].type, 'salida');
  assert.equal(records[0].pairId, '1-2');
});

function row(type, registeredAt) {
  return {
    id: `${type}-${registeredAt}`,
    employeeId: 1,
    type,
    registeredAt,
    recordDate: registeredAt.slice(0, 10)
  };
}
