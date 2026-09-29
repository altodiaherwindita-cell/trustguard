import request from 'supertest';
import { app, mockPool } from './app.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret-key-for-testing-only';

// authenticateToken issues TWO queries per authenticated request (user lookup,
// then user_roles) and requireRole issues a THIRD, all before the handler's own
// query. Positional .mockResolvedValueOnce chains get consumed by those and the
// handler then sees `undefined`. Keying on SQL text instead is order-independent.
const primeAuth = (userId = 'user-id', roles = ['tprm_analyst'], handler = () => ({ rows: [] })) => {
  mockPool.query.mockImplementation((sql, params) => {
    if (sql.includes('user_roles')) {
      // requireRole filters by its own allow-list; authenticateToken's query does not.
      const allowed = sql.includes('ANY($2)') ? params[1] : null;
      const effective = allowed ? roles.filter(r => allowed.includes(r)) : roles;
      return Promise.resolve({ rows: effective.map(role => ({ role })) });
    }
    if (sql.includes('FROM users')) {
      return Promise.resolve({
        rows: [{ id: userId, email: 'test@example.com', full_name: 'Test User', company: 'Test Co' }]
      });
    }
    return Promise.resolve(handler(sql, params));
  });
};

describe('Vendor Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createToken = (userId = 'test-user-id', role = 'tprm_analyst', email = 'test@example.com') => {
    return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: '24h' });
  };

  describe('GET /api/vendors', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/vendors');
      expect(response.status).toBe(401);
    });

    it('should return 403 for vendor role', async () => {
      const token = createToken('user-id', 'vendor');
      primeAuth('user-id', ['vendor']);

      const response = await request(app)
        .get('/api/vendors')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
    });

    it('should return vendors for tprm_analyst', async () => {
      const token = createToken('user-id', 'tprm_analyst');
      primeAuth('user-id', ['tprm_analyst'], () => ({
        rows: [
          { id: 'v1', name: 'Vendor 1', category: 'SaaS', status: 'active', owner_user_id: 'user-id', owner_email: 'owner@test.com', owner_name: 'Owner' }
        ]
      }));

      const response = await request(app)
        .get('/api/vendors')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.vendors).toHaveLength(1);
      expect(response.body.vendors[0].name).toBe('Vendor 1');
    });

    it('should return empty array when no vendors', async () => {
      const token = createToken('user-id', 'tprm_analyst');
      primeAuth('user-id', ['tprm_analyst'], () => ({ rows: [] }));

      const response = await request(app)
        .get('/api/vendors')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.vendors).toHaveLength(0);
    });
  });

  describe('GET /api/vendors/my-vendors', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/vendors/my-vendors');
      expect(response.status).toBe(401);
    });

    it('should return vendors owned by the user', async () => {
      const token = createToken('user-id', 'vendor');
      primeAuth('user-id', ['vendor'], () => ({
        rows: [{ id: 'v1', name: 'My Vendor', owner_user_id: 'user-id' }]
      }));

      const response = await request(app)
        .get('/api/vendors/my-vendors')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.vendors).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM vendors WHERE owner_user_id = $1 ORDER BY created_at DESC',
        ['user-id']
      );
    });
  });

  describe('GET /api/vendors/:id', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/vendors/v1');
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent vendor', async () => {
      const token = createToken('user-id', 'tprm_analyst');
      primeAuth('user-id', ['tprm_analyst'], () => ({ rows: [] }));

      const response = await request(app)
        .get('/api/vendors/v1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Vendor not found');
    });

    it('should return vendor for owner', async () => {
      const token = createToken('user-id', 'vendor');
      primeAuth('user-id', ['vendor'], () => ({
        rows: [{ id: 'v1', name: 'My Vendor', owner_user_id: 'user-id' }]
      }));

      const response = await request(app)
        .get('/api/vendors/v1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.vendor.name).toBe('My Vendor');
    });

    it('should return 403 for unauthorized user', async () => {
      const token = createToken('other-user-id', 'vendor');
      primeAuth('other-user-id', ['vendor'], () => ({
        rows: [{ id: 'v1', name: 'Vendor', owner_user_id: 'user-id' }]
      }));

      const response = await request(app)
        .get('/api/vendors/v1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });

    it('should allow tprm_analyst to view any vendor', async () => {
      const token = createToken('analyst-id', 'tprm_analyst');
      primeAuth('analyst-id', ['tprm_analyst'], () => ({
        rows: [{ id: 'v1', name: 'Vendor', owner_user_id: 'user-id' }]
      }));

      const response = await request(app)
        .get('/api/vendors/v1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/vendors', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/vendors')
        .send({ name: 'Test Vendor' });
      expect(response.status).toBe(401);
    });

    it('should return 403 for vendor role', async () => {
      const token = createToken('user-id', 'vendor');
      primeAuth('user-id', ['vendor']);

      const response = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Vendor' });
      expect(response.status).toBe(403);
    });

    it('should create vendor for tprm_analyst', async () => {
      const token = createToken('user-id', 'tprm_analyst');
      primeAuth('user-id', ['tprm_analyst'], () => ({
        rows: [{ id: 'v1', name: 'Test Vendor', category: 'SaaS', industry: 'Tech', contact_email: 'contact@test.com', status: 'pending', owner_user_id: 'user-id', created_by: 'user-id' }]
      }));

      const response = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Vendor',
          category: 'SaaS',
          industry: 'Tech',
          contact_email: 'contact@test.com'
        });

      expect(response.status).toBe(201);
      expect(response.body.vendor.name).toBe('Test Vendor');
      expect(response.body.message).toBe('Vendor created successfully');
    });
  });

  describe('PATCH /api/vendors/:id', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .patch('/api/vendors/v1')
        .send({ name: 'Updated' });
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent vendor', async () => {
      const token = createToken('user-id', 'tprm_analyst');
      primeAuth('user-id', ['tprm_analyst'], () => ({ rows: [] }));

      const response = await request(app)
        .patch('/api/vendors/v1')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
    });

    it('should update vendor for owner', async () => {
      const token = createToken('user-id', 'vendor');
      primeAuth('user-id', ['vendor'], (sql) => {
        if (sql.includes('UPDATE vendors')) {
          return { rows: [{ id: 'v1', name: 'Updated', category: 'SaaS' }] };
        }
        return { rows: [{ owner_user_id: 'user-id' }] }; // ownership check
      });

      const response = await request(app)
        .patch('/api/vendors/v1')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated' });

      expect(response.status).toBe(200);
      expect(response.body.vendor.name).toBe('Updated');
    });

    it('should return 403 for unauthorized user', async () => {
      const token = createToken('other-user', 'vendor');
      primeAuth('other-user', ['vendor'], () => ({ rows: [{ owner_user_id: 'user-id' }] }));

      const response = await request(app)
        .patch('/api/vendors/v1')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/vendors/:id', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).delete('/api/vendors/v1');
      expect(response.status).toBe(401);
    });

    it('should return 403 for vendor role', async () => {
      const token = createToken('user-id', 'vendor');
      primeAuth('user-id', ['vendor']);

      const response = await request(app)
        .delete('/api/vendors/v1')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
    });

    it('should delete vendor for tprm_analyst', async () => {
      const token = createToken('user-id', 'tprm_analyst');
      primeAuth('user-id', ['tprm_analyst'], () => ({ rows: [{ id: 'v1' }] }));

      const response = await request(app)
        .delete('/api/vendors/v1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Vendor deleted successfully');
    });

    it('should return 404 for non-existent vendor', async () => {
      const token = createToken('user-id', 'tprm_analyst');
      primeAuth('user-id', ['tprm_analyst'], () => ({ rows: [] }));

      const response = await request(app)
        .delete('/api/vendors/v1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
    });
  });
});
