export const HISTORY_LIMIT = 50;
const clone = (value) => structuredClone(value);

// Restore only editable contents: the current revision must remain valid on save.
export function restoreDraft(current, snapshot) {
  return {
    ...current,
    rows: clone(snapshot.rows),
    requiredStaff: clone(snapshot.requiredStaff),
  };
}
export function copySchedule(
  current,
  source,
  activeEmployees,
  keepEmployees = false,
  makeId = () => `r-${crypto.randomUUID()}`,
) {
  return {
    ...current,
    requiredStaff: clone(source.requiredStaff),
    rows: source.rows.map((row) => ({
      id: makeId(),
      label: row.label,
      employeeId:
        keepEmployees && activeEmployees.includes(row.employeeId)
          ? row.employeeId
          : null,
      days: row.days.map((cell) =>
        cell ? { ...cell, availability: null } : null,
      ),
    })),
  };
}


export function assignEmployeeToRow(rows, targetIndex, employeeId, people = []) {
  const target = rows[targetIndex];
  if (!target) return;

  const nextEmployeeId = employeeId ? Number(employeeId) : null;
  if (!nextEmployeeId) {
    target.employeeId = null;
    target.label = "Por asignar";
    return;
  }

  const previousIndex = rows.findIndex(
    (row, index) =>
      index !== targetIndex && Number(row.employeeId) === nextEmployeeId,
  );
  if (previousIndex >= 0) {
    rows[previousIndex].employeeId = null;
    rows[previousIndex].label = "Por asignar";
  }

  const person = people.find((item) => Number(item.id) === nextEmployeeId);
  target.employeeId = nextEmployeeId;
  target.label =
    person?.displayName ||
    person?.fullName ||
    target.label ||
    `Personal ${targetIndex + 1}`;
}
