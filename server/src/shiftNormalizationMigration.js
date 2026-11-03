import { normalizeSegments } from './shiftTime.js';

function signatureOf(model) {
  return JSON.stringify({
    breakMinutes: model.breakMinutes,
    segments: model.segments.map((segment) => ({
      startTime: segment.startTime,
      endTime: segment.endTime,
      startDayOffset: segment.startDayOffset,
      endDayOffset: segment.endDayOffset,
    })),
  });
}

function archivedName(shift) {
  return `Archivado ${shift.id} · ${shift.name}`;
}

export async function migrateRotativoShiftLibrary(connection) {
  const id = '20261006_006_normalize_rotativo_shift_library';
  if ((await connection.execute('SELECT id FROM schema_migrations WHERE id=?', [id]))[0].length) return;

  const [groups] = await connection.execute(
    "SELECT id FROM shift_groups WHERE lower(name)='rotativo' AND is_active=1 LIMIT 1",
  );
  if (!groups.length) throw new Error('No existe el turno Rotativo para normalizar horarios.');
  const rotativoId = groups[0].id;

  const [activeShifts] = await connection.execute(
    'SELECT id,name,start_time AS startTime,end_time AS endTime,break_minutes AS breakMinutes,group_id AS groupId FROM work_shifts WHERE is_active=1 AND group_id=? ORDER BY id',
    [rotativoId],
  );
  const [allSegments] = await connection.execute(
    'SELECT shift_id AS shiftId,segment_order AS segmentOrder,start_time AS startTime,end_time AS endTime,start_day_offset AS startDayOffset,end_day_offset AS endDayOffset FROM work_shift_segments ORDER BY shift_id,segment_order',
  );

  const segmentsByShift = new Map();
  for (const segment of allSegments) {
    if (!segmentsByShift.has(segment.shiftId)) segmentsByShift.set(segment.shiftId, []);
    segmentsByShift.get(segment.shiftId).push(segment);
  }

  const groupsBySignature = new Map();
  for (const shift of activeShifts) {
    const storedSegments = segmentsByShift.get(shift.id) || [
      { startTime: String(shift.startTime).slice(0, 5), endTime: String(shift.endTime).slice(0, 5) },
    ];
    const model = normalizeSegments(
      storedSegments.map((segment) => ({
        startTime: String(segment.startTime).slice(0, 5),
        endTime: String(segment.endTime).slice(0, 5),
      })),
      Number(shift.breakMinutes),
    );
    const signature = signatureOf(model);
    const item = { ...shift, model };
    if (!groupsBySignature.has(signature)) groupsBySignature.set(signature, []);
    groupsBySignature.get(signature).push(item);
  }

  const models = [...groupsBySignature.values()].map((items) => {
    const model = items[0].model;
    return {
      items,
      model,
      baseName: `Rotativo ${model.label}`,
    };
  });

  const byBaseName = new Map();
  for (const item of models) {
    const key = item.baseName.toLocaleLowerCase();
    if (!byBaseName.has(key)) byBaseName.set(key, []);
    byBaseName.get(key).push(item);
  }

  for (const sameName of byBaseName.values()) {
    sameName.sort((a, b) => a.model.breakMinutes - b.model.breakMinutes || a.items[0].id - b.items[0].id);
    sameName.forEach((item, index) => {
      item.desiredName = index === 0
        ? item.baseName
        : `${item.baseName} · colación ${item.model.breakMinutes} min`;
    });
  }

  const activeIds = new Set(activeShifts.map((shift) => Number(shift.id)));
  for (const item of models) {
    const [conflicts] = await connection.execute(
      'SELECT id,name,is_active AS isActive FROM work_shifts WHERE name=? COLLATE NOCASE',
      [item.desiredName],
    );
    for (const conflict of conflicts) {
      if (activeIds.has(Number(conflict.id))) continue;
      if (conflict.isActive) {
        throw new Error(`El nombre normalizado ${item.desiredName} ya está usado por otro horario activo.`);
      }
      await connection.execute('UPDATE work_shifts SET name=? WHERE id=?', [
        archivedName(conflict),
        conflict.id,
      ]);
    }
  }

  let merged = 0;
  const mergeMap = [];

  for (const item of models) {
    const exact = item.items.find(
      (shift) => String(shift.name).toLocaleLowerCase() === item.desiredName.toLocaleLowerCase(),
    );
    const canonical = exact || [...item.items].sort((a, b) => a.id - b.id)[0];

    for (const duplicate of item.items) {
      if (duplicate.id === canonical.id) continue;

      await connection.execute(
        'UPDATE employee_shift_assignments SET shift_id=? WHERE shift_id=?',
        [canonical.id, duplicate.id],
      );
      await connection.execute(
        'UPDATE employee_shift_calendar SET shift_id=? WHERE shift_id=?',
        [canonical.id, duplicate.id],
      );
      await connection.execute(
        'UPDATE planner_cells SET shift_id=? WHERE shift_id=?',
        [canonical.id, duplicate.id],
      );

      const [references] = await connection.execute(
        'SELECT area_id AS areaId,source,reference_frequency AS referenceFrequency FROM shift_area_references WHERE shift_id=?',
        [duplicate.id],
      );
      for (const reference of references) {
        await connection.execute(
          `INSERT INTO shift_area_references(area_id,shift_id,source,reference_frequency)
           VALUES(?,?,?,?)
           ON CONFLICT(area_id,shift_id) DO UPDATE SET
             reference_frequency=shift_area_references.reference_frequency+excluded.reference_frequency`,
          [reference.areaId, canonical.id, reference.source, reference.referenceFrequency],
        );
      }
      await connection.execute('DELETE FROM shift_area_references WHERE shift_id=?', [duplicate.id]);
      await connection.execute('UPDATE work_shifts SET is_active=0 WHERE id=?', [duplicate.id]);
      merged += 1;
      mergeMap.push({ from: duplicate.id, to: canonical.id });
    }

    await connection.execute(
      'UPDATE work_shifts SET name=?,group_id=? WHERE id=?',
      [item.desiredName, rotativoId, canonical.id],
    );
  }

  await connection.execute(
    `INSERT INTO audit_logs(admin_username,action,entity_type,entity_id,details)
     VALUES('system','normalize_shift_library','work_shift_library',?,?)`,
    [
      id,
      JSON.stringify({
        before: activeShifts.length,
        after: models.length,
        merged,
        referencesReassigned: mergeMap,
      }),
    ],
  );
  await connection.execute('INSERT INTO schema_migrations(id) VALUES(?)', [id]);
}
