import request from 'supertest';
import { app, mockPool } from './app.js';
import { getSetting, loadSettings, saveSettings, ensureSettings } from '../services/settings.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret-key-for-testing-only';

function createToken(userId, role = 'admin', email = `user-${userId}@example.com`) {
  return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: '24h' });
}

// Same shape as the other suites: authenticateToken issues a users lookup and a
// user_roles lookup before the route body runs, and requireRole issues another.
//
// app_settings is backed by a real in-memory store rather than a fixed response,
// because saveSettings() re-reads the table after writing — a mock that always
// returns the same rows cannot tell a successful save from a lost one.
function mockDb(role = 'admin', routes = [], seed = {}) {
  const store = { ...seed };

  const handlers = [
    ['FROM users WHERE id', { rows: [{ id: 'user-id', email: 'admin@test.com', full_name: 'Admin', company: 'Acme' }] }],
    ['FROM user_roles', (params) => {
      const allowed = params?.[1];
      if (Array.isArray(allowed)) return { rows: allowed.includes(role) ? [{ role }] : [] };
      return { rows: role ? [{ role }] : [] };
    }],
    ...routes,
    ['INTO app_settings', (params) => {
      const [keys, values] = params;
      keys.forEach((key, i) => { store[key] = values[i]; });
      return { rows: [] };
    }],
    ['FROM app_settings', () => ({
      rows: Object.entries(store).map(([key, value]) => ({ key, value })),
    })],
  ];

  mockPool.query.mockImplementation(async (sql, params) => {
    for (const [match, response] of handlers) {
      if (sql.includes(match)) return typeof response === 'function' ? response(params) : response;
    }
    throw new Error(`Unmocked query: ${sql.replace(/\s+/g, ' ')}`);
  });
}

function issued(match) {
  return mockPool.query.mock.calls.some(([sql]) => sql.includes(match));
}

// setup.js seeds these so other suites' transporter init succeeds; clear them
// here so "unconfigured" means unconfigured.
const SMTP_ENV = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'];
function clearSmtpEnv() {
  for (const key of SMTP_ENV) delete process.env[key];
}
function restoreSmtpEnv() {
  process.env.SMTP_HOST = 'test.smtp.com';
  process.env.SMTP_USER = 'test';
  process.env.SMTP_PASSWORD = 'test';
}

describe('Settings Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSmtpEnv();
    delete process.env.AI_API_KEY;
  });

  afterEach(restoreSmtpEnv);

  describe('GET /api/settings', () => {
    it('should return stored values and never echo secrets', async () => {
      mockDb('admin', [
        ['FROM app_settings', { rows: [
          { key: 'SMTP_HOST', value: 'smtp.saved.com' },
          { key: 'SMTP_PASSWORD', value: 'hunter2' },
          { key: 'AI_API_KEY', value: 'sk-secret' },
        ] }],
      ]);
      await loadSettings();

      const res = await request(app).get('/api/settings').set('Authorization', `Bearer ${createToken('user-id')}`);

      expect(res.status).toBe(200);
      expect(res.body.settings.SMTP_HOST).toBe('smtp.saved.com');
      // The whole point of the secretsSet booleans: the value itself must not
      // appear anywhere in the response.
      expect(res.body.settings).not.toHaveProperty('SMTP_PASSWORD');
      expect(res.body.settings).not.toHaveProperty('AI_API_KEY');
      expect(JSON.stringify(res.body)).not.toContain('hunter2');
      expect(JSON.stringify(res.body)).not.toContain('sk-secret');
      expect(res.body.secretsSet).toEqual({ SMTP_PASSWORD: true, AI_API_KEY: true });
    });

    it('should report email as unconfigured when SMTP_* are absent', async () => {
      mockDb('admin');
      await loadSettings();

      const res = await request(app).get('/api/settings').set('Authorization', `Bearer ${createToken('user-id')}`);

      expect(res.status).toBe(200);
      expect(res.body.status.email.configured).toBe(false);
      expect(res.body.status.email.missing).toEqual(['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD']);
    });

    it('should reject non-admins', async () => {
      mockDb('tprm_analyst');
      const res = await request(app).get('/api/settings').set('Authorization', `Bearer ${createToken('user-id', 'tprm_analyst')}`);
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/settings', () => {
    it('should upsert only the keys sent', async () => {
      mockDb('admin');

      const res = await request(app)
        .patch('/api/settings')
        .set('Authorization', `Bearer ${createToken('user-id')}`)
        .send({ SMTP_HOST: 'smtp.new.com' });

      expect(res.status).toBe(200);
      expect(res.body.settings.SMTP_HOST).toBe('smtp.new.com');

      const insert = mockPool.query.mock.calls.find(([sql]) => sql.includes('INTO app_settings'));
      expect(insert[1]).toEqual([['SMTP_HOST'], ['smtp.new.com']]);
    });

    it('should ignore unknown keys', async () => {
      mockDb('admin');

      const res = await request(app)
        .patch('/api/settings')
        .set('Authorization', `Bearer ${createToken('user-id')}`)
        .send({ JWT_SECRET: 'pwned', SMTP_HOST: 'smtp.new.com' });

      expect(res.status).toBe(200);
      const insert = mockPool.query.mock.calls.find(([sql]) => sql.includes('INTO app_settings'));
      expect(insert[1][0]).toEqual(['SMTP_HOST']);
    });

    it('should reject a non-numeric SMTP_PORT', async () => {
      mockDb('admin');

      const res = await request(app)
        .patch('/api/settings')
        .set('Authorization', `Bearer ${createToken('user-id')}`)
        .send({ SMTP_PORT: 'not-a-port' });

      expect(res.status).toBe(400);
      expect(issued('INTO app_settings')).toBe(false);
    });

    it('should reject an unknown AI_PROVIDER', async () => {
      mockDb('admin');

      const res = await request(app)
        .patch('/api/settings')
        .set('Authorization', `Bearer ${createToken('user-id')}`)
        .send({ AI_PROVIDER: 'definitely-not-real' });

      expect(res.status).toBe(400);
      expect(issued('INTO app_settings')).toBe(false);
    });

    it('should accept a valid AI_PROVIDER', async () => {
      mockDb('admin');

      const res = await request(app)
        .patch('/api/settings')
        .set('Authorization', `Bearer ${createToken('user-id')}`)
        .send({ AI_PROVIDER: 'anthropic' });

      expect(res.status).toBe(200);
      expect(issued('INTO app_settings')).toBe(true);
    });
  });

  describe('POST /api/settings/test-ai', () => {
    it('should 503 when no key is configured', async () => {
      mockDb('admin');
      await loadSettings();

      const res = await request(app)
        .post('/api/settings/test-ai')
        .set('Authorization', `Bearer ${createToken('user-id')}`);

      expect(res.status).toBe(503);
    });
  });
});

describe('settings service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSmtpEnv();
  });

  afterEach(restoreSmtpEnv);

  it('falls back to process.env for keys with no stored row', async () => {
    process.env.SMTP_HOST = 'from-env.com';
    mockDb('admin', [], { SMTP_PORT: '2525' });
    await loadSettings();

    expect(getSetting('SMTP_HOST')).toBe('from-env.com');
    expect(getSetting('SMTP_PORT')).toBe('2525');
  });

  it('treats a blank stored value as unset so a cleared field restores the env default', async () => {
    process.env.SMTP_HOST = 'from-env.com';
    mockDb('admin', [], { SMTP_HOST: '' });
    await loadSettings();

    expect(getSetting('SMTP_HOST')).toBe('from-env.com');
  });

  it('drops unknown keys before writing', async () => {
    mockDb('admin');
    await saveSettings({ SMTP_HOST: 'a.com', EVIL: 'x' });

    const insert = mockPool.query.mock.calls.find(([sql]) => sql.includes('INTO app_settings'));
    expect(insert[1][0]).toEqual(['SMTP_HOST']);
  });

  // The cache refreshed only on boot and on this process's own writes, so a row
  // changed any other way (psql, another instance, a restored dump) stayed
  // invisible until a restart — the UI reported a saved password that was gone.
  describe('ensureSettings', () => {
    it('picks up a change made outside this process once the TTL expires', async () => {
      mockDb('admin', [], { SMTP_HOST: 'before.com' });
      await loadSettings();
      expect(getSetting('SMTP_HOST')).toBe('before.com');

      // Someone else edits the row.
      mockDb('admin', [], { SMTP_HOST: 'after.com' });

      await ensureSettings();
      expect(getSetting('SMTP_HOST')).toBe('before.com'); // still cached

      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 11_000);
      await ensureSettings();
      expect(getSetting('SMTP_HOST')).toBe('after.com'); // now refreshed

      Date.now.mockRestore();
    });

    it('keeps the last good values when the refresh fails', async () => {
      mockDb('admin', [], { SMTP_HOST: 'good.com' });
      await loadSettings();

      mockPool.query.mockRejectedValue(new Error('db down'));
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 11_000);

      await expect(ensureSettings()).resolves.toBeDefined();
      expect(getSetting('SMTP_HOST')).toBe('good.com');

      Date.now.mockRestore();
    });
  });
});
