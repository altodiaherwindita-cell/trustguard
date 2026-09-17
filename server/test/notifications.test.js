import request from 'supertest';
import { app, mockPool } from './app.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret-key-for-testing-only';

function createToken(userId, role = 'vendor', email = `user-${userId}@example.com`) {
  return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: '24h' });
}

// The real app runs authenticateToken on every route, which issues two queries
// (users lookup, then user_roles) before the route body runs, and requireRole
// issues a third. Positional mockResolvedValueOnce chains broke on that, so the
// mock is keyed on SQL text instead: first matching substring wins.
function mockDb(role = 'vendor', routes = []) {
  const handlers = [
    ['FROM users WHERE id', { rows: [{ id: 'user-id', email: 'user@test.com', full_name: 'Test User', company: 'Acme' }] }],
    ['FROM user_roles', (params) => {
      const allowed = params?.[1];
      if (Array.isArray(allowed)) return { rows: allowed.includes(role) ? [{ role }] : [] };
      return { rows: role ? [{ role }] : [] };
    }],
    ...routes
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

describe('Notifications Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
  });

  describe('GET /api/notifications', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/notifications');
      expect(response.status).toBe(401);
    });

    it('should return notifications for authenticated user', async () => {
      const token = createToken('user-id', 'vendor', 'user@test.com');
      mockDb('vendor', [
        ['SELECT * FROM notifications', {
          rows: [
            { id: 'n1', user_id: 'user-id', subject: 'Test 1', status: 'unread', created_at: new Date().toISOString() },
            { id: 'n2', user_id: 'user-id', subject: 'Test 2', status: 'read', created_at: new Date().toISOString() }
          ]
        }],
        // GET / counts unread with COUNT(*) too; only `status != 'read'` tells them apart
        ["status != 'read'", { rows: [{ count: '1' }] }],
        ['COUNT(*) FROM notifications', { rows: [{ count: '2' }] }]
      ]);

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.notifications).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);
      expect(response.body.unreadCount).toBe(1);
    });

    it('should filter unread only', async () => {
      const token = createToken('user-id', 'vendor', 'user@test.com');
      mockDb('vendor', [
        ['SELECT * FROM notifications', { rows: [] }],
        ['unread_count', { rows: [{ unread_count: '0' }] }],
        ['COUNT(*) FROM notifications', { rows: [{ count: '0' }] }]
      ]);

      const response = await request(app)
        .get('/api/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(issued("status != 'read'")).toBe(true);
    });

    it('should support pagination', async () => {
      const token = createToken('user-id', 'vendor', 'user@test.com');
      mockDb('vendor', [
        ['SELECT * FROM notifications', { rows: [] }],
        ['unread_count', { rows: [{ unread_count: '0' }] }],
        ['COUNT(*) FROM notifications', { rows: [{ count: '0' }] }]
      ]);

      const response = await request(app)
        .get('/api/notifications?limit=10&offset=20')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      const [listCall] = mockPool.query.mock.calls.filter(([sql]) => sql.includes('SELECT * FROM notifications'));
      expect(listCall[1]).toContain(10);
      expect(listCall[1]).toContain(20);
    });
  });

  describe('PATCH /api/notifications/:id/read', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).patch('/api/notifications/n1/read');
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent notification', async () => {
      const token = createToken('user-id', 'vendor', 'user@test.com');
      mockDb('vendor', [['SELECT * FROM notifications', { rows: [] }]]);

      const response = await request(app)
        .patch('/api/notifications/n1/read')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Notification not found');
    });

    it('should mark notification as read for owner', async () => {
      const token = createToken('user-id', 'vendor', 'user@test.com');
      mockDb('vendor', [
        ['SELECT * FROM notifications', { rows: [{ id: 'n1', user_id: 'user-id', status: 'unread' }] }],
        ['UPDATE notifications', { rows: [{ id: 'n1', status: 'read', read_at: new Date().toISOString() }] }]
      ]);

      const response = await request(app)
        .patch('/api/notifications/n1/read')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.notification.status).toBe('read');
    });
  });

  describe('PATCH /api/notifications/read-all', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).patch('/api/notifications/read-all');
      expect(response.status).toBe(401);
    });

    it('should mark all as read', async () => {
      const token = createToken('user-id', 'vendor', 'user@test.com');
      mockDb('vendor', [['UPDATE notifications', { rows: [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }], rowCount: 3 }]]);

      const response = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.updated).toBe(3);
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/notifications/unread-count');
      expect(response.status).toBe(401);
    });

    it('should return unread count', async () => {
      const token = createToken('user-id', 'vendor', 'user@test.com');
      mockDb('vendor', [['unread_count', { rows: [{ unread_count: '5' }] }]]);

      const response = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.unreadCount).toBe(5);
    });
  });

  describe('POST /api/notifications (TPRM/Admin only)', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/notifications')
        .send({ user_id: 'user1', body: 'Test' });
      expect(response.status).toBe(401);
    });

    it('should return 403 for vendor role', async () => {
      const token = createToken('user-id', 'vendor');
      mockDb('vendor');

      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${token}`)
        .send({ user_id: 'user1', body: 'Test' });
      expect(response.status).toBe(403);
    });

    it('should return 400 for missing recipient', async () => {
      const token = createToken('admin-id', 'tprm_analyst');
      mockDb('tprm_analyst');

      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${token}`)
        .send({ body: 'Test' });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Either user_id or recipient_email is required');
    });

    it('should create notification for tprm_analyst', async () => {
      const token = createToken('admin-id', 'tprm_analyst');
      mockDb('tprm_analyst', [
        ['INSERT INTO notifications', {
          rows: [{
            id: 'n1',
            user_id: 'user1',
            body: 'Test notification',
            status: 'sent',
            created_at: new Date().toISOString()
          }]
        }]
      ]);

      const response = await request(app)
        .post('/api/notifications')
        .set('Authorization', `Bearer ${token}`)
        .send({ user_id: 'user1', body: 'Test notification', subject: 'Test' });

      expect(response.status).toBe(201);
      expect(response.body.notification.user_id).toBe('user1');
    });
  });

  describe('GET /api/notifications/templates (TPRM/Admin only)', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/notifications/templates');
      expect(response.status).toBe(401);
    });

    it('should return 403 for vendor', async () => {
      const token = createToken('user-id', 'vendor');
      mockDb('vendor');

      const response = await request(app)
        .get('/api/notifications/templates')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
    });

    it('should return templates for tprm_analyst', async () => {
      const token = createToken('admin-id', 'tprm_analyst');
      mockDb('tprm_analyst', [
        ['FROM notification_templates', {
          rows: [{ id: 't1', name: 'Welcome', subject: 'Welcome!', body: 'Welcome {{name}}' }]
        }]
      ]);

      const response = await request(app)
        .get('/api/notifications/templates')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.templates).toHaveLength(1);
    });
  });

  describe('PATCH /api/notifications/templates/:id (Admin only)', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .patch('/api/notifications/templates/t1')
        .send({ subject: 'Updated' });
      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin', async () => {
      const token = createToken('admin-id', 'tprm_analyst');
      mockDb('tprm_analyst');

      const response = await request(app)
        .patch('/api/notifications/templates/t1')
        .set('Authorization', `Bearer ${token}`)
        .send({ subject: 'Updated' });
      expect(response.status).toBe(403);
    });

    it('should update template for admin', async () => {
      const token = createToken('admin-id', 'admin');
      mockDb('admin', [
        ['UPDATE notification_templates', {
          rows: [{ id: 't1', name: 'Welcome', subject: 'Updated Subject', body: 'Welcome {{name}}' }]
        }]
      ]);

      const response = await request(app)
        .patch('/api/notifications/templates/t1')
        .set('Authorization', `Bearer ${token}`)
        .send({ subject: 'Updated Subject' });

      expect(response.status).toBe(200);
      expect(response.body.template.subject).toBe('Updated Subject');
    });
  });
});
