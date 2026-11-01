import { pool } from './db.js';
import { runMigrations } from './migrations.js';

const defaultSettings = {
  timeMode: 'auto',
  country: 'Chile',
  timeZone: 'America/Santiago',
  manualUtcOffset: '-03:00',
  companyName: 'Red Taurus Codex Asistencia',
  companyTagline: 'Control de asistencia y permanencia',
  workdayTargetHours: '8',
  lateToleranceMinutes: '10'
};

let ensured = false;

export async function ensureSystemSettingsTable() {
  if (ensured) return;

  await runMigrations();

  for (const [key, value] of Object.entries(defaultSettings)) {
    await pool.execute(
      `INSERT INTO system_settings (setting_key, setting_value)
       VALUES (:key, :value)
       ON CONFLICT(setting_key) DO NOTHING`,
      { key, value }
    );
  }

  ensured = true;
}

export async function getSystemSettings() {
  await ensureSystemSettingsTable();
  const [rows] = await pool.execute('SELECT setting_key AS settingKey, setting_value AS settingValue FROM system_settings');
  const settings = { ...defaultSettings };

  for (const row of rows) {
    settings[row.settingKey] = row.settingValue;
  }

  return settings;
}

export async function saveSystemSettings(settings) {
  await ensureSystemSettingsTable();

  for (const [key, value] of Object.entries(settings)) {
    await pool.execute(
      `INSERT INTO system_settings (setting_key, setting_value)
       VALUES (:key, :value)
       ON CONFLICT DO UPDATE SET setting_value = excluded.setting_value`,
      { key, value: String(value) }
    );
  }

  return getSystemSettings();
}

export function getConfiguredDateTime(settings) {
  const now = new Date();

  if (settings.timeMode === 'manual') {
    return formatWithManualOffset(now, settings.manualUtcOffset || '-03:00');
  }

  return formatInTimeZone(now, settings.timeZone || 'America/Santiago');
}

function formatInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

function formatWithManualOffset(date, utcOffset) {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(utcOffset);
  const sign = match?.[1] === '-' ? -1 : 1;
  const hours = Number(match?.[2] || 0);
  const minutes = Number(match?.[3] || 0);
  const offsetMs = sign * ((hours * 60 + minutes) * 60 * 1000);
  const adjusted = new Date(date.getTime() + offsetMs);
  return adjusted.toISOString().slice(0, 19).replace('T', ' ');
}
