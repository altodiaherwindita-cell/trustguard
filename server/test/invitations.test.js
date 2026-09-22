import request from 'supertest';
import { app, mockPool } from './app.js';
import jwt from 'jsonwebtoken';
import { sendAssessmentInvitation } from '../services/emailService.js';

const JWT_SECRET = 'test-secret-key-for-testing-only';

// SMTP is an external boundary; the real service opens a connection to
// test.smtp.com on import and on send. Mock it so the suite stays offline.
jest.mock('../services/emailService.js', () => ({
  sendAssessmentInvitation: jest.fn().mockResolvedValue({ success: true }),
}));

function createToken(userId, role = 'vendor', email = `user-${userId}@example.com`) {
  return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: '24h' });
}

// The real chain issues, in order: authenticateToken user lookup,
// authenticateToken user_roles lookup, requireRole user_roles lookup, then the
// route's own queries. Keying on SQL text keeps the chain from drifting every
// time a middleware query is added.
function mockDb({ user = { id: 'u1', email: 'analyst@test.com', full_name: 'Analyst', company: 'Org' }, roles = ['tprm_analyst'], vendor = { name: 'Test Vendor' }, invitation = null, storedInvitation = null } = {}) {
  mockPool.query.mockImplementation((sql, params = []) => {
    // requireRole filters in SQL: honour $2 so a vendor-only user is denied.
    if (sql.includes('AND role = ANY')) {
      const allowed = roles.filter(r => (params[1] || []).includes(r));
      return Promise.resolve({ rows: allowed.map(r => ({ role: r })) });
    }
    if (sql.includes('FROM user_roles')) return Promise.resolve({ rows: roles.map(r => ({ role: r })) });
    if (sql.includes('FROM users WHERE id')) return Promise.resolve({ rows: user ? [user] : [] });
    if (sql.includes('FROM vendors WHERE id')) return Promise.resolve({ rows: vendor ? [vendor] : [] });
    // Accept's lookup joins vendors, so it must be matched before the plain
    // vendor query above would swallow it.
    if (sql.includes('FROM assessment_invitations ai')) {
      return Promise.resolve({ rows: storedInvitation ? [storedInvitation] : [] });
    }
    if (sql.includes('INSERT INTO assessment_invitations')) return Promise.resolve({ rows: [invitation] });
    if (sql.includes('UPDATE assessment_invitations')) return Promise.resolve({ rows: [] });
    // The binding itself: record the params so tests can assert on them.
    if (sql.includes('UPDATE vendors SET owner_user_id')) {
      mockDb.boundOwner = params;
      return Promise.resolve({ rows: [] });
    }
    return Promise.reject(new Error(`Unmocked query: ${sql}`));
  });
}

const invitationRow = {
  id: 'inv1',
  vendor_id: 'v1',
  assessment_id: 'a1',
  email: 'vendor@test.com',
  status: 'pending',
  token: 'test-token-123',
};

describe('Invitations Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
    mockDb.boundOwner = undefined;
  });

  describe('GET /api/invitations/:token', () => {
    it('should return 401 without token for other routes (but GET /:token is public)', async () => {
      // This endpoint doesn't require auth - it validates the invitation token
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/invitations/invalid-token');
      expect(response.status).toBe(404);
      expect(response.body.valid).toBe(false);
    });

    it('should return 404 for invalid token', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/invitations/invalid-token');
      expect(response.status).toBe(404);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBe('Invalid or expired invitation');
    });

    it('should return invitation details for valid token', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'inv1',
          assessment_id: 'a1',
          vendor_id: 'v1',
          email: 'vendor@test.com',
          token: 'valid-token',
          status: 'pending',
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          vendor_name: 'Test Vendor'
        }]
      });

      const response = await request(app).get('/api/invitations/valid-token');
      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
      expect(response.body.assessment_id).toBe('a1');
      expect(response.body.vendor_name).toBe('Test Vendor');
      expect(response.body.email).toBe('vendor@test.com');
    });
  });

  describe('POST /api/invitations/:token/accept', () => {
    const stored = (over = {}) => ({
      id: 'inv1',
      vendor_id: 'v1',
      assessment_id: 'a1',
      email: 'vendor@test.com',
      token: 'test-token-123',
      status: 'sent',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      vendor_name: 'Test Vendor',
      ...over,
    });

    it('should return 401 without a token', async () => {
      const response = await request(app).post('/api/invitations/test-token-123/accept');
      expect(response.status).toBe(401);
    });

    it('should return 404 for an unknown token', async () => {
      mockDb({ storedInvitation: null });
      const response = await request(app)
        .post('/api/invitations/nope/accept')
        .set('Authorization', `Bearer ${createToken('u1', 'vendor', 'vendor@test.com')}`);
      expect(response.status).toBe(404);
    });

    it('should bind the vendor to the signed-in account', async () => {
      mockDb({
        user: { id: 'u1', email: 'vendor@test.com', full_name: 'V', company: 'C' },
        roles: ['vendor'],
        storedInvitation: stored(),
      });

      const response = await request(app)
        .post('/api/invitations/test-token-123/accept')
        .set('Authorization', `Bearer ${createToken('u1', 'vendor', 'vendor@test.com')}`);

      expect(response.status).toBe(200);
      expect(response.body.assessment_id).toBe('a1');
      // The whole point: owner_user_id must be the accepting user, not NULL.
      expect(mockDb.boundOwner).toEqual(['u1', 'v1']);
    });

    it('should refuse an account that is not the invited recipient', async () => {
      mockDb({
        user: { id: 'u2', email: 'someone-else@test.com', full_name: 'X', company: 'C' },
        roles: ['vendor'],
        storedInvitation: stored(),
      });

      const response = await request(app)
        .post('/api/invitations/test-token-123/accept')
        .set('Authorization', `Bearer ${createToken('u2', 'vendor', 'someone-else@test.com')}`);

      expect(response.status).toBe(403);
      // Nothing may be written on a rejected accept, or the link is consumed.
      expect(mockDb.boundOwner).toBeUndefined();
    });

    it('should return 410 for an expired invitation', async () => {
      mockDb({
        user: { id: 'u1', email: 'vendor@test.com', full_name: 'V', company: 'C' },
        roles: ['vendor'],
        storedInvitation: stored({ expires_at: new Date(Date.now() - 86400000).toISOString() }),
      });

      const response = await request(app)
        .post('/api/invitations/test-token-123/accept')
        .set('Authorization', `Bearer ${createToken('u1', 'vendor', 'vendor@test.com')}`);

      expect(response.status).toBe(410);
      expect(mockDb.boundOwner).toBeUndefined();
    });
  });

  describe('POST /api/invitations', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/invitations')
        .send({ vendorId: 'v1', assessmentId: 'a1', email: 'test@test.com' });
      expect(response.status).toBe(401);
    });

    it('should return 400 for missing required fields', async () => {
      const token = createToken('admin-id', 'tprm_analyst');
      mockDb();

      const response = await request(app)
        .post('/api/invitations')
        .set('Authorization', `Bearer ${token}`)
        .send({ vendorId: 'v1' }); // missing assessmentId and email

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('vendorId, assessmentId, and email are required');
    });

    it('should return 404 for non-existent vendor', async () => {
      const token = createToken('admin-id', 'tprm_analyst');
      mockDb({ vendor: null });

      const response = await request(app)
        .post('/api/invitations')
        .set('Authorization', `Bearer ${token}`)
        .send({ vendorId: 'nonexistent', assessmentId: 'a1', email: 'test@test.com' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Vendor not found');
    });

    it('should create invitation for tprm_analyst', async () => {
      const token = createToken('admin-id', 'tprm_analyst');
      mockDb({ invitation: invitationRow });

      const response = await request(app)
        .post('/api/invitations')
        .set('Authorization', `Bearer ${token}`)
        .send({ vendorId: 'v1', assessmentId: 'a1', email: 'vendor@test.com' });

      expect(response.status).toBe(201);
      expect(response.body.invitation).toBeDefined();
      expect(response.body.invitation.id).toBe('inv1');
      expect(response.body.message).toBe('Invitation created successfully');
      // default sendEmailNotification=true, so the mailer must have been hit
      expect(sendAssessmentInvitation).toHaveBeenCalled();
    });

    it('should email a link on the configured frontend origin', async () => {
      process.env.FRONTEND_URL = 'https://trustguard.example.com';
      const token = createToken('admin-id', 'tprm_analyst');
      mockDb({ invitation: invitationRow });

      try {
        const response = await request(app)
          .post('/api/invitations')
          .set('Authorization', `Bearer ${token}`)
          .send({ vendorId: 'v1', assessmentId: 'a1', email: 'vendor@test.com' });

        expect(response.status).toBe(201);
        // Third arg is assessmentLink. A wrong origin here is a dead link in the
        // recipient's inbox, which no other assertion in this file catches.
        expect(sendAssessmentInvitation.mock.calls[0][2])
          .toMatch(/^https:\/\/trustguard\.example\.com\/invite\/[0-9a-f]{64}$/);
      } finally {
        delete process.env.FRONTEND_URL;
      }
    });

    it('should fall back to the port the app actually serves on', async () => {
      delete process.env.FRONTEND_URL;
      const token = createToken('admin-id', 'tprm_analyst');
      mockDb({ invitation: invitationRow });

      await request(app)
        .post('/api/invitations')
        .set('Authorization', `Bearer ${token}`)
        .send({ vendorId: 'v1', assessmentId: 'a1', email: 'vendor@test.com' });

      // 5173 was the old default and nothing serves the app there (Vite: 8080,
      // compose nginx: 80), so unconfigured deployments emailed dead links.
      expect(sendAssessmentInvitation.mock.calls[0][2])
        .toMatch(/^http:\/\/localhost:8080\/invite\/[0-9a-f]{64}$/);
    });

    it('should create invitation with sendEmailNotification false', async () => {
      const token = createToken('admin-id', 'tprm_analyst');
      mockDb({ invitation: invitationRow });

      const response = await request(app)
        .post('/api/invitations')
        .set('Authorization', `Bearer ${token}`)
        .send({ vendorId: 'v1', assessmentId: 'a1', email: 'vendor@test.com', sendEmailNotification: false });

      expect(response.status).toBe(201);
      expect(response.body.emailSent).toBe(false);
      expect(sendAssessmentInvitation).not.toHaveBeenCalled();
    });

    it('should return 403 for vendor role', async () => {
      const token = createToken('vendor-id', 'vendor');
      mockDb({ roles: ['vendor'] });

      const response = await request(app)
        .post('/api/invitations')
        .set('Authorization', `Bearer ${token}`)
        .send({ vendorId: 'v1', assessmentId: 'a1', email: 'test@test.com' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient permissions');
    });
  });
});
