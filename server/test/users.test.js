import request from 'supertest';
import { app, mockPool } from './app.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret-key-for-testing-only';

function createToken(userId, role = 'vendor', email = 'test@example.com') {
  return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: '24h' });
}

const ADMIN_USER = { id: 'admin-id', email: 'admin@test.com', full_name: 'Admin', company: 'TrustGuard' };

// The real middleware chain issues three queries before a route's own SQL:
//   authenticateToken -> SELECT users WHERE id = $1 AND is_active = true
//   authenticateToken -> SELECT role FROM user_roles WHERE user_id = $1
//   requireRole       -> SELECT role FROM user_roles WHERE user_id = $1 AND role = ANY($2)
// `allowed` is what the ANY() query returns; pass [] to exercise a 403.
// `queries` are [pattern, rows] pairs matched against the route's own SQL.
function mockDb({ user = ADMIN_USER, roles = ['admin'], allowed = roles, queries = [] } = {}) {
  mockPool.query.mockImplementation(async (sql) => {
    const q = String(sql).replace(/\s+/g, ' ').trim();
    for (const [pattern, rows] of queries) {
      if (pattern.test(q)) return { rows };
    }
    if (q === 'SELECT id, email, full_name, company FROM users WHERE id = $1 AND is_active = true') {
      return { rows: user ? [user] : [] };
    }
    if (q === 'SELECT role FROM user_roles WHERE user_id = $1 AND role = ANY($2)') {
      return { rows: allowed.map(role => ({ role })) };
    }
    if (q === 'SELECT role FROM user_roles WHERE user_id = $1') {
      return { rows: roles.map(role => ({ role })) };
    }
    throw new Error(`Unmocked query: ${q}`);
  });
}

describe('User Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
  });

  describe('POST /api/users', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ email: 'new@test.com', password: 'Test123!' });
      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin role', async () => {
      const token = createToken('user-id', 'tprm_analyst');
      mockDb({ roles: ['tprm_analyst'], allowed: [] });

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'new@test.com', password: 'Test123!' });
      expect(response.status).toBe(403);
    });

    it('should return 400 for missing email', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb();

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'Test123!' });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email and password are required');
    });

    it('should return 400 for missing password', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb();

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'new@test.com' });
      expect(response.status).toBe(400);
    });

    it('should return 400 for weak password', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb();

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'new@test.com', password: 'weak' });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Password does not meet policy requirements');
      // 'weak' is lowercase but short and has no digit/upper/special, so the
      // length rule is the one it trips.
      expect(response.body.details).toContain('Password must be at least 8 characters long');
    });

    it('should return 400 for duplicate email', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb({
        queries: [[/^SELECT id FROM users WHERE email = \$1$/, [{ id: 'existing-id' }]]],
      });

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'existing@test.com', password: 'Test123!' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('User with this email already exists');
    });

    it('should create user with default vendor role', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb({
        queries: [
          [/^SELECT id FROM users WHERE email = \$1$/, []],
          [/^INSERT INTO users/, [{
            id: 'new-user-id',
            email: 'new@test.com',
            full_name: 'New User',
            company: 'Test Co',
            is_active: true,
            created_at: new Date().toISOString()
          }]],
          [/^INSERT INTO user_roles/, []],
        ],
      });

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'new@test.com', password: 'Test123!', full_name: 'New User' });

      expect(response.status).toBe(201);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('new@test.com');
      expect(response.body.user.roles).toContain('vendor');
    });

    it('should create user with custom roles', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb({
        queries: [
          [/^SELECT id FROM users WHERE email = \$1$/, []],
          [/^INSERT INTO users/, [{
            id: 'new-user-id',
            email: 'analyst@test.com',
            full_name: 'Analyst',
            company: 'Test Co',
            is_active: true,
            created_at: new Date().toISOString()
          }]],
          [/^INSERT INTO user_roles/, []],
        ],
      });

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'analyst@test.com', password: 'Test123!', roles: ['tprm_analyst'] });

      expect(response.status).toBe(201);
      expect(response.body.user.roles).toContain('tprm_analyst');
    });

    it('should return 400 for invalid role', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb({
        queries: [
          [/^SELECT id FROM users WHERE email = \$1$/, []],
          [/^INSERT INTO users/, [{
            id: 'new-user-id', email: 'new@test.com', full_name: 'New',
            is_active: true, created_at: new Date().toISOString()
          }]],
          [/^DELETE FROM users WHERE id = \$1$/, []],
        ],
      });

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'new@test.com', password: 'Test123!', roles: ['invalid_role'] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid role: invalid_role');
    });
  });

  describe('GET /api/users', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/users');
      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin role', async () => {
      const token = createToken('user-id', 'tprm_analyst');
      mockDb({ roles: ['tprm_analyst'], allowed: [] });

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
    });

    it('should return list of users for admin', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb({
        queries: [[/FROM users u LEFT JOIN user_roles ur/, [
          {
            id: '1',
            email: 'user1@test.com',
            full_name: 'User One',
            company: 'Co1',
            is_active: true,
            created_at: new Date().toISOString(),
            roles: ['vendor']
          },
          {
            id: '2',
            email: 'user2@test.com',
            full_name: 'User Two',
            company: 'Co2',
            is_active: true,
            created_at: new Date().toISOString(),
            roles: ['tprm_analyst']
          }
        ]]],
      });

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(2);
      expect(response.body.users[0].email).toBe('user1@test.com');
      expect(response.body.users[1].roles).toContain('tprm_analyst');
    });

    it('should return empty array when no users', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb({ queries: [[/FROM users u LEFT JOIN user_roles ur/, []]] });

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(0);
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/users/1');
      expect(response.status).toBe(401);
    });

    it('should return 403 for vendor role', async () => {
      const token = createToken('user-id', 'vendor');
      mockDb({ roles: ['vendor'], allowed: [] });

      const response = await request(app)
        .get('/api/users/1')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent user', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb({ queries: [[/WHERE u.id = \$1 GROUP BY u.id/, []]] });

      const response = await request(app)
        .get('/api/users/nonexistent')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should return user for admin', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb({
        queries: [[/WHERE u.id = \$1 GROUP BY u.id/, [{
          id: '1',
          email: 'user@test.com',
          full_name: 'Test User',
          company: 'Test Co',
          is_active: true,
          created_at: new Date().toISOString(),
          roles: ['vendor']
        }]]],
      });

      const response = await request(app)
        .get('/api/users/1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('user@test.com');
      expect(response.body.user.roles).toContain('vendor');
    });

    it('should return user for tprm_analyst', async () => {
      const token = createToken('analyst-id', 'tprm_analyst');
      mockDb({
        roles: ['tprm_analyst'],
        queries: [[/WHERE u.id = \$1 GROUP BY u.id/, [{
          id: '1',
          email: 'user@test.com',
          full_name: 'Test User',
          company: 'Test Co',
          is_active: true,
          created_at: new Date().toISOString(),
          roles: ['vendor']
        }]]],
      });

      const response = await request(app)
        .get('/api/users/1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('user@test.com');
    });
  });

  describe('PATCH /api/users/:id/role', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .patch('/api/users/1/role')
        .send({ role: 'tprm_analyst' });
      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin role', async () => {
      const token = createToken('analyst-id', 'tprm_analyst');
      mockDb({ roles: ['tprm_analyst'], allowed: [] });

      const response = await request(app)
        .patch('/api/users/1/role')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'tprm_analyst' });
      expect(response.status).toBe(403);
    });

    it('should return 400 for invalid role', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb();

      const response = await request(app)
        .patch('/api/users/1/role')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'invalid' });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid role');
    });

    it('should update user role for admin', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb({
        queries: [
          [/^DELETE FROM user_roles WHERE user_id = \$1$/, []],
          [/^INSERT INTO user_roles/, []],
        ],
      });

      const response = await request(app)
        .patch('/api/users/1/role')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'tprm_analyst' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('User role updated successfully');
    });
  });

  describe('PATCH /api/users/:id/status', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .patch('/api/users/1/status')
        .send({ isActive: false });
      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin role', async () => {
      const token = createToken('analyst-id', 'tprm_analyst');
      mockDb({ roles: ['tprm_analyst'], allowed: [] });

      const response = await request(app)
        .patch('/api/users/1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false });
      expect(response.status).toBe(403);
    });

    it('should deactivate user for admin', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb({ queries: [[/^UPDATE users SET is_active/, [{ id: '1', is_active: false }]]] });

      const response = await request(app)
        .patch('/api/users/1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('User deactivated successfully');
    });

    it('should activate user for admin', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb({ queries: [[/^UPDATE users SET is_active/, [{ id: '1', is_active: true }]]] });

      const response = await request(app)
        .patch('/api/users/1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: true });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('User activated successfully');
    });
  });
});
