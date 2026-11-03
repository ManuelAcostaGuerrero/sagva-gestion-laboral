export function attachAttendanceDurations(rows, filters = {}) {
  const workStateByEmployee = new Map();
  const pairCounterByEmployee = new Map();

  return rows.map((record) => {
    const registeredAt = new Date(record.registeredAt);
    let durationSeconds = null;
    let mealDurationSeconds = null;
    let deductedMealSeconds = null;
    let pairId = null;

    if (record.type === 'entrada') {
      const nextPair = (pairCounterByEmployee.get(record.employeeId) || 0) + 1;
      pairCounterByEmployee.set(record.employeeId, nextPair);
      pairId = `${record.employeeId}-${nextPair}`;
      workStateByEmployee.set(record.employeeId, {
        registeredAt,
        pairId,
        openMeal: null,
        totalMealSeconds: 0
      });
    }

    const workState = workStateByEmployee.get(record.employeeId);

    if (['entrada_colacion', 'salida_colacion'].includes(record.type) && workState) {
      pairId = workState.pairId;
      if (!workState.openMeal) {
        workState.openMeal = { type: record.type, registeredAt };
      } else if (workState.openMeal.type !== record.type) {
        mealDurationSeconds = Math.max(
          0,
          Math.round((registeredAt.getTime() - workState.openMeal.registeredAt.getTime()) / 1000)
        );
        workState.totalMealSeconds += mealDurationSeconds;
        workState.openMeal = null;
      }
    }

    if (record.type === 'salida' && workState) {
      pairId = workState.pairId;
      const grossDurationSeconds = Math.max(
        0,
        Math.round((registeredAt.getTime() - workState.registeredAt.getTime()) / 1000)
      );
      deductedMealSeconds = workState.totalMealSeconds;
      durationSeconds = Math.max(0, grossDurationSeconds - deductedMealSeconds);
      workStateByEmployee.delete(record.employeeId);
    }

    if (!pairId && workState) {
      pairId = workState.pairId;
    }

    if (record.type === 'salida' && deductedMealSeconds === null) {
      deductedMealSeconds = 0;
    }

    return {
      ...record,
      durationSeconds,
      mealDurationSeconds,
      deductedMealSeconds,
      pairId
    };
  }).filter((record) => {
    const recordDate = record.recordDate instanceof Date
      ? record.recordDate.toISOString().slice(0, 10)
      : String(record.recordDate).slice(0, 10);

    return (!filters.from || recordDate >= filters.from)
      && (!filters.to || recordDate <= filters.to)
      && (!filters.type || record.type === filters.type);
  }).reverse();
}
