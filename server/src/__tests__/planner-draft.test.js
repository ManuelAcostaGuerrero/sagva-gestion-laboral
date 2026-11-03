import test from "node:test";
import assert from "node:assert/strict";
import {
  HISTORY_LIMIT,
  restoreDraft,
  copySchedule,
  assignEmployeeToRow,
} from "../../../client/src/plannerDraft.js";

test("Deshacer conserva la revision actual incluso despues de guardar y mantiene mas de cinco movimientos", () => {
  assert.ok(HISTORY_LIMIT >= 5);
  const current = {
    id: 10,
    revision: 8,
    status: "draft",
    requiredStaff: [2, 2, 2, 2, 2, 2, 2],
    rows: [{ id: "current", label: "Nuevo" }],
  };
  const previous = {
    id: 10,
    revision: 3,
    status: "draft",
    requiredStaff: [1, 1, 1, 1, 1, 1, 1],
    rows: [{ id: "old", label: "Anterior" }],
  };
  const restored = restoreDraft(current, previous);
  assert.equal(restored.revision, 8);
  assert.equal(restored.id, 10);
  assert.equal(restored.rows[0].label, "Anterior");
  restored.rows[0].label = "Editado";
  assert.equal(previous.rows[0].label, "Anterior");
  assert.equal(current.rows[0].label, "Nuevo");
});
test("Copiar horario conserva semana destino, crea filas nuevas y elimina indisponibilidad historica", () => {
  const destination = {
    id: 20,
    revision: 5,
    status: "draft",
    weekStart: "2026-10-05",
    rows: [],
    requiredStaff: Array(7).fill(0),
  };
  const source = {
    id: 10,
    revision: 7,
    status: "published",
    weekStart: "2026-09-21",
    requiredStaff: Array(7).fill(2),
    rows: [
      {
        id: "first",
        label: "Puesto 1",
        employeeId: 1,
        days: [
          { dayType: "work", shiftId: 12, availability: "leave" },
          ...Array(6).fill(null),
        ],
      },
      {
        id: "second",
        label: "Puesto 2",
        employeeId: 2,
        days: Array(7).fill(null),
      },
    ],
  };
  let id = 0;
  const makeId = () => `new-${++id}`;
  const copied = copySchedule(destination, source, [1], false, makeId);
  assert.equal(copied.id, 20);
  assert.equal(copied.revision, 5);
  assert.equal(copied.status, "draft");
  assert.equal(copied.weekStart, "2026-10-05");
  assert.deepEqual(
    copied.rows.map((row) => row.employeeId),
    [null, null],
  );
  assert.equal(copied.rows[0].days[0].availability, null);
  assert.equal(copied.rows[0].days[0].shiftId, 12);
  const assigned = copySchedule(destination, source, [1], true, makeId);
  assert.deepEqual(
    assigned.rows.map((row) => row.employeeId),
    [1, null],
  );
  assert.equal(source.rows[0].id, "first");
  assert.equal(source.rows[0].days[0].availability, "leave");
  assert.notEqual(assigned.rows[0].id, copied.rows[0].id);
});


test("Cambiar una persona de fila la mueve solo dentro de la semana y deja la anterior por asignar", () => {
  const rows = [
    {
      id: "a",
      label: "Ana",
      employeeId: 1,
      days: [{ dayType: "work", shiftId: 10 }, null, null, null, null, null, null],
    },
    {
      id: "b",
      label: "Bruno",
      employeeId: 2,
      days: [{ dayType: "work", shiftId: 20 }, null, null, null, null, null, null],
    },
  ];
  const people = [
    { id: 1, displayName: "Ana" },
    { id: 2, displayName: "Bruno" },
  ];

  assignEmployeeToRow(rows, 0, 2, people);

  assert.equal(rows[0].employeeId, 2);
  assert.equal(rows[0].label, "Bruno");
  assert.equal(rows[1].employeeId, null);
  assert.equal(rows[1].label, "Por asignar");
  assert.equal(rows[0].days[0].shiftId, 10);
  assert.equal(rows[1].days[0].shiftId, 20);
});
