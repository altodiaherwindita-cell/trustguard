import request from 'supertest';
import { app, mockPool } from './app.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret-key-for-testing-only';

function createToken(userId, role = 'vendor', email = `user-${userId}@example.com`) {
  return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: '24h' });
}

const USER_ROW = { id: 'admin-id', email: 'admin@example.com', full_name: 'Admin', company: 'ACME' };

// Every authenticated request burns 2 queries in authenticateToken (user lookup,
// then user_roles) and admins burn a 3rd in requireRole. Positional
// mockResolvedValueOnce chains get fragile past 4 entries, so dispatch on SQL text.
function mockDb({ role = 'admin', logs = [], total = 0, stats = null } = {}) {
  mockPool.query.mockImplementation(async (sql) => {
    if (sql.includes('FROM users WHERE id = $1 AND is_active')) return { rows: [USER_ROW] };
    if (sql.includes('AND role = ANY($2)')) return { rows: role === 'admin' ? [{ role: 'admin' }] : [] };
    if (sql.includes('FROM user_roles WHERE user_id = $1')) return { rows: [{ role }] };
    if (sql.includes('total_actions')) return { rows: [stats] };
    if (sql.includes('GROUP BY action')) return { rows: [{ action: 'vendor_created', count: '5' }] };
    if (sql.includes('GROUP BY resource_type')) return { rows: [{ resource_type: 'vendor', count: '8' }] };
    if (sql.includes('COUNT(*)')) return { rows: [{ count: String(total) }] };
    return { rows: logs };
  });
}

describe('Audit Logs Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
  });

  describe('GET /api/audit-logs', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/audit-logs');
      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin role', async () => {
      const token = createToken('user-id', 'tprm_analyst');
      mockDb({ role: 'tprm_analyst' });

      const response = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
    });

    it('should return audit logs for admin', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb({
        role: 'admin',
        total: 1,
        logs: [
          { id: 'al1', user_id: 'user1', action: 'vendor_created', resource_type: 'vendor', resource_id: 'v1', created_at: new Date().toISOString(), user_email: 'user@test.com', user_name: 'User' }
        ],
      });

      const response = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.logs).toHaveLength(1);
      expect(response.body.pagination.total).toBe(1);
    });

    it('should filter by userId', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb({ role: 'admin' });

      const response = await request(app)
        .get('/api/audit-logs?userId=user1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it('should filter by action', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb({ role: 'admin' });

      const response = await request(app)
        .get('/api/audit-logs?action=vendor_created')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it('should paginate results', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb({ role: 'admin' });

      const response = await request(app)
        .get('/api/audit-logs?limit=10&offset=20')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/audit-logs/user/:userId', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/audit-logs/user/user1');
      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin accessing other user', async () => {
      const token = createToken('other-user', 'tprm_analyst');
      mockDb({ role: 'tprm_analyst' });

      const response = await request(app)
        .get('/api/audit-logs/user/user1')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
    });

    it('should allow admin to access any user logs', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb({ role: 'admin' });

      const response = await request(app)
        .get('/api/audit-logs/user/user1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it('should allow user to access own logs', async () => {
      const token = createToken('user1', 'vendor');
      mockDb({ role: 'vendor' });

      const response = await request(app)
        .get('/api/audit-logs/user/user1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/audit-logs/export', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/audit-logs/export');
      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin', async () => {
      const token = createToken('user-id', 'tprm_analyst');
      mockDb({ role: 'tprm_analyst' });

      const response = await request(app)
        .get('/api/audit-logs/export')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
    });

    it('should export as JSON for admin', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb({ role: 'admin' });

      const response = await request(app)
        .get('/api/audit-logs/export')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it('should export as CSV', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb({ role: 'admin' });

      const response = await request(app)
        .get('/api/audit-logs/export?format=csv')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/audit-logs/stats', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/audit-logs/stats');
      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin', async () => {
      const token = createToken('user-id', 'tprm_analyst');
      mockDb({ role: 'tprm_analyst' });

      const response = await request(app)
        .get('/api/audit-logs/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
    });

    it('should return stats for admin', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb({ role: 'admin', stats: { total_actions: '10', unique_users: '5', resource_types: '3' } });

      const response = await request(app)
        .get('/api/audit-logs/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.totalActions).toBe(10);
      expect(response.body.activeUsers).toBe(5);
      expect(response.body.topActions).toHaveLength(1);
    });
  });
});
