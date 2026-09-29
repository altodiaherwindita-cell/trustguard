import { pool } from '../db.js';

// App-wide config (SMTP, AI) that an admin can change from Settings without a
// redeploy. Values live in app_settings; process.env is the fallback for any key
// with no row, so an existing .env-only deployment behaves exactly as before.
//
// A blank value means "not set" and falls through to env. That is what lets
// clearing a field in the UI restore the environment default instead of writing
// an empty string into the config.
export const SETTING_KEYS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_SECURE',
  'SMTP_FROM',
  'SMTP_REJECT_UNAUTHORIZED',
  'AI_PROVIDER',
  'AI_API_KEY',
  'AI_MODEL',
  'AI_BASE_URL',
];

// Never sent to the browser. The API reports only whether each is set.
export const SECRET_KEYS = ['SMTP_PASSWORD', 'AI_API_KEY'];

// null until loadSettings() runs. Callers before that get the env fallback,
// which is also what keeps this module importable from tests with no database.
let cache = null;

export function getSetting(key) {
  const stored = cache?.[key];
  if (stored !== undefined && stored !== '') return stored;
  return process.env[key];
}

export function isSecretSet(key) {
  return Boolean(getSetting(key));
}

export async function loadSettings() {
  const { rows } = await pool.query('SELECT key, value FROM app_settings');
  cache = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return cache;
}

/**
 * Upsert the given keys. Unknown keys are ignored; blank values are written so
 * they clear a previously stored override.
 */
export async function saveSettings(updates) {
  const entries = Object.entries(updates).filter(([k]) => SETTING_KEYS.includes(k));
  if (entries.length === 0) return loadSettings();

  // One statement rather than a query per key. Both arrays are parameters and
  // UNNEST zips them positionally, so nothing here is interpolated.
  await pool.query(
    `INSERT INTO app_settings (key, value)
     SELECT k, v FROM UNNEST($1::text[], $2::text[]) AS t(k, v)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [entries.map(([k]) => k), entries.map(([, v]) => String(v ?? ''))]
  );

  return loadSettings();
}
