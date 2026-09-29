import request from 'supertest';
import { app, mockPool } from './app.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret-key-for-testing-only';

function createToken(userId, role = 'vendor', email = `user-${userId}@example.com`) {
  return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: '24h' });
}

// authenticateToken issues TWO queries per request: the user lookup, then the
// user_roles lookup. requireRole issues a THIRD. Queue them first, in order.
function mockAuth(userId = 'user-id', role = 'vendor') {
  mockPool.query
    .mockResolvedValueOnce({ rows: [{ id: userId, email: `${userId}@example.com`, full_name: 'U', company: 'C' }] })
    .mockResolvedValueOnce({ rows: [{ role }] });
}

function mockRequireRole(role) {
  mockPool.query.mockResolvedValueOnce({ rows: [{ role }] });
}

describe('Remediation Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
  });

  describe('GET /api/remediation/:assessmentId', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/remediation/a1');
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent assessment', async () => {
      const token = createToken('user-id', 'vendor');
      mockAuth('user-id', 'vendor');
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // assessment lookup

      const response = await request(app)
        .get('/api/remediation/nonexistent')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(404);
    });

    it('should return 403 for unauthorized user', async () => {
      const token = createToken('other-user', 'vendor');
      mockAuth('other-user', 'vendor');
      mockPool.query.mockResolvedValueOnce({ rows: [{ owner_user_id: 'user-id' }] }); // assessment

      const response = await request(app)
        .get('/api/remediation/a1')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
    });

    it('should return remediation items for owner', async () => {
      const token = createToken('user-id', 'vendor');
      mockAuth('user-id', 'vendor');
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ owner_user_id: 'user-id' }] }) // assessment
        .mockResolvedValueOnce({
          rows: [{
            id: 'r1', assessment_id: 'a1', vendor_id: 'v1', title: 'Fix SSL', priority: 'high', due_date: '2026-01-15',
            vendor_name: 'Test Vendor', assigned_to_email: 'user@test.com'
          }]
        });

      const response = await request(app)
        .get('/api/remediation/a1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.remediation).toHaveLength(1);
    });
  });

  describe('POST /api/remediation (TPRM only)', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/remediation')
        .send({ assessment_id: 'a1', vendor_id: 'v1', title: 'New Item' });
      expect(response.status).toBe(401);
    });

    it('should return 403 for vendor role', async () => {
      const token = createToken('user-id', 'vendor');
      mockAuth('user-id', 'vendor');
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // requireRole: no admin/tprm role

      const response = await request(app)
        .post('/api/remediation')
        .set('Authorization', `Bearer ${token}`)
        .send({ assessment_id: 'a1', vendor_id: 'v1', title: 'New Item' });
      expect(response.status).toBe(403);
    });

    // Real route requires assessment_id, title AND description (description is
    // NOT NULL with no DB default). It does not validate vendor_id at all --
    // that is derived from the assessment.
    it('should return 400 for missing fields', async () => {
      const token = createToken('admin-id', 'tprm_analyst');
      mockAuth('admin-id', 'tprm_analyst');
      mockRequireRole('tprm_analyst');

      const response = await request(app)
        .post('/api/remediation')
        .set('Authorization', `Bearer ${token}`)
        .send({ assessment_id: 'a1' });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('assessment_id, title, and description are required');
    });

    it('should create remediation item for tprm_analyst', async () => {
      const token = createToken('admin-id', 'tprm_analyst');
      mockAuth('admin-id', 'tprm_analyst');
      mockRequireRole('tprm_analyst');
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ vendor_id: 'v1' }] }) // assessment -> derived vendor_id
        .mockResolvedValueOnce({
          rows: [{ id: 'r1', assessment_id: 'a1', vendor_id: 'v1', title: 'New Item', description: 'Fix it', priority: 'medium' }]
        }) // insert
        .mockResolvedValueOnce({ rows: [] }); // audit log

      const response = await request(app)
        .post('/api/remediation')
        .set('Authorization', `Bearer ${token}`)
        .send({ assessment_id: 'a1', vendor_id: 'ignored-by-server', title: 'New Item', description: 'Fix it' });

      expect(response.status).toBe(201);
      expect(response.body.remediation.title).toBe('New Item');
      expect(response.body.remediation.vendor_id).toBe('v1');
    });
  });
});
