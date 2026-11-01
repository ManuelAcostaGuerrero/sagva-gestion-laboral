import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../auth.js';
import { asyncHandler } from '../asyncHandler.js';
import { getSystemSettings, saveSystemSettings } from '../systemSettings.js';
import { recordAudit } from '../auditLog.js';

export const settingsRouter = Router();

const settingsSchema = z.object({
  timeMode: z.enum(['auto', 'manual']),
  country: z.string().min(2),
  timeZone: z.string().min(3),
  manualUtcOffset: z.string().regex(/^[+-]\d{2}:\d{2}$/),
  companyName: z.string().min(3).max(120),
  companyTagline: z.string().min(3).max(180),
  workdayTargetHours: z.coerce.number().min(1).max(24),
  lateToleranceMinutes: z.coerce.number().min(0).max(240)
});

settingsRouter.get('/', requireAdmin, asyncHandler(async (_req, res) => {
  res.json({ settings: await getSystemSettings() });
}));

settingsRouter.put('/', requireAdmin, asyncHandler(async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Configuracion invalida' });
  }

  const settings = await saveSystemSettings(parsed.data);
  await recordAudit(req.admin, 'update', 'system_settings', 'global', parsed.data);
  res.json({ settings });
}));
