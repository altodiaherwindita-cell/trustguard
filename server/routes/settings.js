import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { sendEmail, initializeEmailTransporter } from '../services/emailService.js';
import { chat, PROVIDER_NAMES, resolveProvider } from '../services/aiProvider.js';
import {
  SETTING_KEYS,
  SECRET_KEYS,
  getSetting,
  isSecretSet,
  saveSettings,
  ensureSettings,
} from '../services/settings.js';

const router = Router();

// Secrets are never returned — the client only learns whether one is set, so a
// saved API key cannot be read back out of the UI by a later admin session.
function currentSettings() {
  const values = {};
  for (const key of SETTING_KEYS) {
    if (!SECRET_KEYS.includes(key)) values[key] = getSetting(key) ?? '';
  }
  return {
    settings: values,
    secretsSet: Object.fromEntries(SECRET_KEYS.map((k) => [k, isSecretSet(k)])),
  };
}

// Which of these can actually work right now, without calling the provider.
function configStatus() {
  const host = getSetting('SMTP_HOST');
  const user = getSetting('SMTP_USER');
  const pass = getSetting('SMTP_PASSWORD');
  const ai = resolveProvider();
  return {
    email: {
      configured: Boolean(host && user && pass),
      missing: [
        !host && 'SMTP_HOST',
        !user && 'SMTP_USER',
        !pass && 'SMTP_PASSWORD',
      ].filter(Boolean),
    },
    ai: {
      configured: !ai.error,
      provider: getSetting('AI_PROVIDER') || 'openai',
      model: getSetting('AI_MODEL') || '',
    },
  };
}

router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
  await ensureSettings();
  res.json({ ...currentSettings(), status: configStatus() });
});

router.patch('/', authenticateToken, requireRole('admin'), async (req, res) => {
  const body = req.body || {};

  // A key sent as undefined is untouched; sent as '' it clears the override and
  // falls back to the environment. Secrets accept null/'' the same way, but a
  // non-string (the masked placeholder echoed back) is ignored rather than
  // stored.
  const updates = {};
  for (const key of SETTING_KEYS) {
    const value = body[key];
    if (value === undefined) continue;
    if (typeof value !== 'string') continue;
    updates[key] = value.trim();
  }

  if (updates.SMTP_PORT && !/^\d+$/.test(updates.SMTP_PORT)) {
    return res.status(400).json({ error: 'SMTP_PORT must be a number' });
  }
  if (updates.SMTP_SECURE && !['true', 'false'].includes(updates.SMTP_SECURE)) {
    return res.status(400).json({ error: 'SMTP_SECURE must be "true" or "false"' });
  }
  if (updates.AI_PROVIDER && !PROVIDER_NAMES.includes(updates.AI_PROVIDER)) {
    return res.status(400).json({ error: `AI_PROVIDER must be one of: ${PROVIDER_NAMES.join(', ')}` });
  }

  try {
    await saveSettings(updates);
    // SMTP changes only take effect on a new transporter; the module builds one
    // at import, so rebuild it here or a saved host would need a restart.
    if (Object.keys(updates).some((k) => k.startsWith('SMTP_'))) {
      initializeEmailTransporter();
    }
    res.json({ ...currentSettings(), status: configStatus(), message: 'Settings saved' });
  } catch (error) {
    console.error('Save settings error:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Send a message to the caller's own address. The only way to tell a working
// SMTP config from a plausible-looking broken one — nodemailer's verify() only
// proves the credentials authenticate, not that a message is deliverable.
router.post('/test-email', authenticateToken, requireRole('admin'), async (req, res) => {
  const to = req.user?.email;
  if (!to) return res.status(400).json({ error: 'No email address on your account' });

  // A "test connection" button has to test the config as it stands now, not the
  // transporter built at boot from whatever the settings were then.
  await ensureSettings();
  initializeEmailTransporter();

  const result = await sendEmail({
    to,
    subject: 'TrustGuard SMTP test',
    html: '<p>This is a test message from TrustGuard. Your SMTP settings are working.</p>',
  });

  if (!result.success) {
    return res.status(502).json({ error: result.error || result.message || 'Email could not be sent' });
  }
  res.json({ message: `Test email sent to ${to}` });
});

// Same idea for AI: one cheap round trip against the configured provider. A 503
// when unconfigured mirrors POST /api/ai/chat, so the two agree on what
// "not configured" means.
router.post('/test-ai', authenticateToken, requireRole('admin'), async (req, res) => {
  await ensureSettings();
  const result = await chat('Reply with the single word: ok', [{ role: 'user', content: 'ping' }]);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ message: `Connected to ${result.provider}${result.model ? ` (${result.model})` : ''}` });
});

export default router;
