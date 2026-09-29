import request from 'supertest';
import { app, mockPool } from './app.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret-key-for-testing-only';

function createToken(userId, role = 'vendor', email = `user-${userId}@example.com`) {
  return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: '24h' });
}

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const USER = { id: 'admin-id', email: 'admin@example.com', full_name: 'Admin', company: 'TrustGuard' };

const ASSESSMENT = {
  id: 'assessment-1',
  vendor_id: 'vendor-1',
  vendor_name: 'Acme Corp',
  industry: 'Technology',
  status: 'completed',
  created_at: '2026-01-01T00:00:00.000Z',
  submitted_at: null,
  reviewed_at: null,
  risk_score: 42,
  risk_level: 'Medium',
  overall_score: 80,
  strengths: ['Good encryption'],
  weaknesses: ['No MFA'],
  recommendations: ['Enable MFA'],
};

const RESPONSE_ROWS = [
  { answer: 'Yes', question: 'Do you encrypt data at rest?', category: 'Data Protection', type: 'boolean', weight: 2, risk_impact: 'High', display_order: 1 },
];

/**
 * authenticateToken runs two queries (user, then user_roles) before the route's
 * own queries, and requireRole adds a third, so positional mockResolvedValueOnce
 * chains are fragile. Key on SQL text instead.
 */
function mockQueries({ roles = ['admin'], user = USER, assessment = ASSESSMENT, vendorOwner = 'admin-id', responses = RESPONSE_ROWS, vendors = [] } = {}) {
  mockPool.query.mockImplementation((sql, params = []) => {
    // requireRole filters with `role = ANY($2)`; the user_roles lookup in
    // authenticateToken does not, so honour the filter or vendors pass role checks.
    if (sql.includes('role = ANY')) return Promise.resolve({ rows: roles.filter(role => params[1]?.includes(role)).map(role => ({ role })) });
    if (sql.includes('FROM user_roles')) return Promise.resolve({ rows: roles.map(role => ({ role })) });
    if (sql.includes('FROM assessments a')) return Promise.resolve({ rows: assessment ? [assessment] : [] });
    if (sql.includes('owner_user_id FROM vendors')) return Promise.resolve({ rows: vendorOwner ? [{ owner_user_id: vendorOwner }] : [] });
    if (sql.includes('FROM assessment_responses')) return Promise.resolve({ rows: responses });
    if (sql.includes('FROM vendors v')) return Promise.resolve({ rows: vendors });
    if (sql.includes('FROM users')) return Promise.resolve({ rows: user ? [user] : [] });
    return Promise.resolve({ rows: [] });
  });
}

describe('Reports Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
  });

  // The old mock harness implemented GET /api/reports/dashboard and
  // GET /api/reports/risk-summary; the real server has no such routes.

  describe('GET /api/reports/assessment/:id/pdf', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/reports/assessment/assessment-1/pdf');
      expect(response.status).toBe(401);
    });

    it('should return 404 when assessment does not exist', async () => {
      mockQueries({ assessment: null });
      const token = createToken('admin-id', 'admin');

      const response = await request(app)
        .get('/api/reports/assessment/missing/pdf')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Assessment not found');
    });

    it('should stream a PDF for an admin', async () => {
      mockQueries({ roles: ['admin'] });
      const token = createToken('admin-id', 'admin');

      const response = await request(app)
        .get('/api/reports/assessment/assessment-1/pdf')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(Buffer.isBuffer(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/reports/assessment/:id/excel', () => {
    it('should stream an XLSX for an admin', async () => {
      mockQueries({ roles: ['admin'] });
      const token = createToken('admin-id', 'admin');

      const response = await request(app)
        .get('/api/reports/assessment/assessment-1/excel')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe(XLSX_TYPE);
      // supertest only buffers application/octet-stream as a Buffer; the xlsx
      // mime type falls through to the text parser.
      expect(response.text.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/reports/vendors/summary/excel', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/reports/vendors/summary/excel');
      expect(response.status).toBe(401);
    });

    it('should return 403 for vendor role', async () => {
      mockQueries({ roles: ['vendor'] });
      const token = createToken('user-id', 'vendor');

      const response = await request(app)
        .get('/api/reports/vendors/summary/excel')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
    });

    it('should stream an XLSX for an admin', async () => {
      mockQueries({
        roles: ['admin'],
        vendors: [{ name: 'Acme Corp', category: 'SaaS', industry: 'Technology', contact_email: 'a@acme.test', status: 'active', latest_status: 'completed', risk_score: 42, risk_level: 'Medium', last_assessment_date: '2026-01-01T00:00:00.000Z', owner_email: 'owner@example.com' }],
      });
      const token = createToken('admin-id', 'admin');

      const response = await request(app)
        .get('/api/reports/vendors/summary/excel')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe(XLSX_TYPE);
      expect(response.text.length).toBeGreaterThan(0);
    });
  });
});
