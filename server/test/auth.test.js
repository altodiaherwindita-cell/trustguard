import request from 'supertest';
import { app, mockPool } from './app.js';
import { resetActivityClock } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = 'test-secret-key-for-testing-only';

const USER_ROW = {
  id: 'test-uuid',
  email: 'test@example.com',
  full_name: 'Test User',
  company: 'Test Co',
  is_active: true,
  must_change_password: false,
  created_at: new Date().toISOString(),
};

// Real routers issue different numbers of queries per request (authenticateToken
// does a users lookup then a user_roles lookup; requireRole adds a third), so
// positional mockResolvedValueOnce chains drift. Key on the SQL text instead.
function mockDb(handlers) {
  mockPool.query.mockImplementation(async (sql) => {
    for (const [needle, result] of handlers) {
      if (sql.includes(needle)) return result;
    }
    throw new Error(`Unmocked query: ${sql}`);
  });
}

const authHandlers = (extra = []) => [
  ['FROM users WHERE id', { rows: [USER_ROW] }],
  ['FROM user_roles', { rows: [{ role: 'vendor' }] }],
  ...extra,
];

const freshToken = () =>
  jwt.sign({ userId: 'test-uuid', email: 'test@example.com' }, JWT_SECRET);

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // register tests deleted: the real server has no POST /api/auth/register route
  // (it returns 404 "Registration is disabled."), so the old mock-only coverage
  // tested the harness rather than the server.

  describe('POST /api/auth/login', () => {
    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 401 for non-existent user', async () => {
      mockDb([['FROM users WHERE email', { rows: [] }]]);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Test123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should login successfully with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('Test123!', 10);

      mockDb([
        ['FROM users WHERE email', {
          rows: [{ ...USER_ROW, password_hash: hashedPassword }],
        }],
        ['FROM user_roles', { rows: [{ role: 'vendor' }] }],
      ]);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.roles).toEqual(['vendor']);
    });

    it('should reject wrong password', async () => {
      const hashedPassword = await bcrypt.hash('Test123!', 10);

      mockDb([
        ['FROM users WHERE email', {
          rows: [{ ...USER_ROW, password_hash: hashedPassword }],
        }],
      ]);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject inactive user', async () => {
      const hashedPassword = await bcrypt.hash('Test123!', 10);

      mockDb([
        ['FROM users WHERE email', {
          rows: [{ ...USER_ROW, is_active: false, password_hash: hashedPassword }],
        }],
      ]);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('deactivated');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      mockDb(authHandlers());

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${freshToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty('email', 'test@example.com');
      expect(response.body.user.roles).toEqual(['vendor']);
    });

    it('should reject request without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      // 401, not 403: src/lib/api.ts only clears storage and redirects to
      // /auth on 401. A 403 left the dead token in localStorage and surfaced
      // as a generic error on every subsequent request.
      expect(response.status).toBe(401);
    });

    it('should reject expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: 'test-uuid', email: 'test@example.com' },
        JWT_SECRET,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });

    it('should reject token whose user no longer exists', async () => {
      mockDb([['FROM users WHERE id', { rows: [] }]]);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${freshToken()}`);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      mockDb(authHandlers());

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${freshToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Logged out successfully');
    });

    it('should reject logout without token', async () => {
      const response = await request(app).post('/api/auth/logout');

      expect(response.status).toBe(401);
    });
  });

  describe('Session inactivity timeout', () => {
    // Regression: the check compared `now` against the token's `iat` (issue
    // time), so every session died 15 minutes after login no matter how
    // continuously the user was working. Nothing tracked last activity.
    afterEach(() => {
      jest.restoreAllMocks();
      resetActivityClock();
    });

    // Do NOT pass `{ noTimestamp: true }` with an explicit `iat`: jsonwebtoken@9
    // deletes a caller-supplied `iat` whenever noTimestamp is set, so the token
    // came out with no `iat` at all and `tokenAge` was NaN — which made every
    // `NaN > threshold` age check silently pass. Backdate the clock instead.
    const tokenIssuedMinutesAgo = (minutes) => {
      const spy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() - minutes * 60 * 1000);
      const token = jwt.sign({ userId: 'test-uuid', email: 'test@example.com' }, JWT_SECRET);
      spy.mockRestore();
      return token;
    };

    it('rejects a token with no iat rather than treating its age as zero', async () => {
      mockDb(authHandlers());
      const iatless = jwt.sign(
        { userId: 'test-uuid', email: 'test@example.com' },
        JWT_SECRET,
        { noTimestamp: true }
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${iatless}`);

      expect(response.status).toBe(401);
    });

    it('rejects a token issued more than 8 hours ago even if active', async () => {
      mockDb(authHandlers());

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokenIssuedMinutesAgo(9 * 60)}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Session expired');
    });

    it('accepts a token issued 20 minutes ago when the user is active', async () => {
      mockDb(authHandlers());

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokenIssuedMinutesAgo(20)}`);

      expect(response.status).toBe(200);
    });

    it('keeps accepting requests as long as they are under 15 minutes apart', async () => {
      mockDb(authHandlers());
      const token = tokenIssuedMinutesAgo(0);
      const base = Date.now();

      // Logged in 40 minutes ago, but requesting every 10 minutes throughout.
      for (const elapsed of [0, 10, 20, 30, 40]) {
        jest.spyOn(Date, 'now').mockReturnValue(base + elapsed * 60 * 1000);
        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${token}`);
        if (response.status !== 200) {
          throw new Error(`expected 200 at +${elapsed}min, got ${response.status}`);
        }
      }
    });

    // Regression: logging in did not reset the clock. A user who was idle for
    // >15 minutes and then signed in kept the stale timestamp from their
    // previous session, so their FIRST request with a brand-new token 401'd as
    // "inactivity_timeout" while the second one passed — which made it look
    // like a flake rather than a bug.
    it('a fresh login clears a stale clock from the previous session', async () => {
      const hashedPassword = await bcrypt.hash('Test123!', 10);
      const base = Date.now();

      // A request in an earlier session sets the clock at `base`.
      jest.spyOn(Date, 'now').mockReturnValue(base);
      mockDb(authHandlers());
      const earlier = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${freshToken()}`);
      expect(earlier.status).toBe(200);

      // 16 minutes pass. The user signs in again, getting a brand-new token.
      jest.spyOn(Date, 'now').mockReturnValue(base + 16 * 60 * 1000);
      mockDb([
        ['FROM users WHERE email', { rows: [{ ...USER_ROW, password_hash: hashedPassword }] }],
        ['FROM user_roles', { rows: [{ role: 'vendor' }] }],
      ]);
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'Test123!' });
      expect(login.status).toBe(200);

      // The new token's first use must succeed: signing in is activity.
      mockDb(authHandlers());
      const first = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${login.body.token}`);

      if (first.status !== 200) {
        throw new Error(
          `first request after a fresh login must succeed, got ${first.status} ${JSON.stringify(first.body)}`
        );
      }
    });

    it('rejects after 15 minutes of inactivity', async () => {
      mockDb(authHandlers());
      const token = tokenIssuedMinutesAgo(0);
      const base = Date.now();

      jest.spyOn(Date, 'now').mockReturnValue(base);
      const first = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(first.status).toBe(200);

      jest.spyOn(Date, 'now').mockReturnValue(base + 16 * 60 * 1000);
      const idle = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(idle.status).toBe(401);
      expect(idle.body.reason).toBe('inactivity_timeout');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});
