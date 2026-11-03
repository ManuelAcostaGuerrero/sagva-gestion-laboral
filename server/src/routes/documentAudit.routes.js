import { Router } from 'express';
import { pool } from '../db.js';
import { requireRoles } from '../auth.js';
import { asyncHandler } from '../asyncHandler.js';
import { runMigrations } from '../migrations.js';
import { canonicalDocumentName, classifyDocumentAudit, dominantDocumentPeriod } from '../documentAudit.js';

export const documentAuditRouter = Router();
documentAuditRouter.use(requireRoles('admin', 'supervisor'));

const statusCounts = rows => rows.reduce((acc, row) => {
  acc[row.status] = (acc[row.status] || 0) + 1;
  return acc;
}, { CORRECT: 0, MISSING: 0, INCOMPLETE: 0, REVIEW: 0, NA: 0 });

documentAuditRouter.get('/', asyncHandler(async (_req, res) => {
  await runMigrations();

  const [workers] = await pool.execute(
    'SELECT id,full_name AS fullName,document_id AS documentId FROM employees WHERE is_active=1 ORDER BY full_name COLLATE NOCASE,id'
  );
  const [types] = await pool.execute(
    'SELECT id,name,expiry_mode AS expiryMode,is_active AS isActive,applicability FROM employee_document_types ORDER BY id'
  );
  const [assignments] = await pool.execute(
    'SELECT type_id AS typeId,employee_id AS employeeId FROM employee_document_applicability'
  );
  const [entries] = await pool.execute(
    'SELECT h.id,h.employee_id AS employeeId,h.document_type_id AS typeId,h.document_name AS documentName,' +
    'h.expiry_mode AS expiryMode,h.delivered_on AS deliveredOn,h.start_on AS startOn,h.expires_on AS expiresOn,' +
    'h.version_label AS versionLabel,h.created_at AS createdAt ' +
    'FROM employee_document_entries h INNER JOIN employees e ON e.id=h.employee_id ' +
    'WHERE e.is_active=1 ORDER BY h.id DESC'
  );

  const selectedByType = new Map();
  for (const row of assignments) {
    if (!selectedByType.has(row.typeId)) selectedByType.set(row.typeId, new Set());
    selectedByType.get(row.typeId).add(row.employeeId);
  }

  const typeById = new Map(types.map(type => [type.id, type]));
  const groups = new Map();
  const ensureGroup = name => {
    const key = canonicalDocumentName(name);
    if (!groups.has(key)) groups.set(key, { key, name: key, aliases: new Set(), types: [], byWorker: new Map() });
    return groups.get(key);
  };

  for (const type of types) {
    const group = ensureGroup(type.name);
    group.aliases.add(type.name);
    group.types.push(type);
  }

  for (const entry of entries) {
    const currentType = typeById.get(entry.typeId);
    const group = ensureGroup(currentType?.name || entry.documentName);
    group.aliases.add(entry.documentName);
    if (!group.byWorker.has(entry.employeeId)) group.byWorker.set(entry.employeeId, []);
    group.byWorker.get(entry.employeeId).push(entry);
  }

  const totalPeers = workers.length;
  const result = [...groups.values()].map(group => {
    const presentWorkers = new Set([...group.byWorker.keys()]);
    const peerCount = presentWorkers.size;
    const latestDates = [...group.byWorker.values()]
      .map(history => history[0]?.deliveredOn || history[0]?.startOn)
      .filter(Boolean);
    const dominantPeriod = group.key === 'IRL' ? dominantDocumentPeriod(latestDates) : null;

    const rows = workers.map(worker => {
      const history = group.byWorker.get(worker.id) || [];
      const applies = group.types.some(type => Boolean(type.isActive) && (
        type.applicability === 'ALL' || selectedByType.get(type.id)?.has(worker.id)
      ));
      const classification = classifyDocumentAudit({
        entries: history,
        applies,
        peerCount,
        totalPeers,
        dominantPeriod,
        comparePeriod: group.key === 'IRL'
      });
      const latest = classification.latest || history[0] || null;
      return {
        employeeId: worker.id,
        fullName: worker.fullName,
        documentId: worker.documentId,
        applies,
        hasDocument: history.length > 0,
        status: classification.status,
        reason: classification.reason,
        deliveredOn: latest?.deliveredOn || null,
        startOn: latest?.startOn || null,
        expiresOn: latest?.expiresOn || null,
        documentName: latest?.documentName || null
      };
    });

    return {
      key: group.key,
      name: group.name,
      aliases: [...group.aliases].filter(Boolean).sort((a, b) => a.localeCompare(b, 'es')),
      configured: group.types.some(type => Boolean(type.isActive)),
      peerCount,
      totalPeers,
      presenceRatio: totalPeers ? peerCount / totalPeers : 0,
      dominantPeriod,
      counts: statusCounts(rows),
      rows
    };
  }).sort((a, b) => {
    const priority = name => name === 'IRL' ? 0 : name === 'PACTO DE HORAS' ? 1 : 2;
    return priority(a.name) - priority(b.name) || a.name.localeCompare(b.name, 'es');
  });

  res.json({
    readOnly: true,
    activeWorkers: workers.length,
    groups: result
  });
}));
