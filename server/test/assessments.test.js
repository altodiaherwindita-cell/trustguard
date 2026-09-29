import request from 'supertest';
import { app, mockPool } from './app.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret-key-for-testing-only';

function createToken(userId, role = 'vendor') {
  return jwt.sign({ userId, email: `user-${userId}@example.com` }, JWT_SECRET, { expiresIn: '24h' });
}

const USER_ROW = {
  id: 'user-id',
  email: 'user-id@example.com',
  full_name: 'Test User',
  company: 'Test Co',
};

// authenticateToken always runs a users lookup then a user_roles lookup before
// any handler. requireRole adds a third user_roles query. Keying the mock on SQL
// text (instead of a positional mockResolvedValueOnce chain) keeps handler rows
// from silently landing in the middleware queries.
function installMock(handlers = []) {
  mockPool.query.mockImplementation((sql, params) => {
    if (typeof sql === 'string') {
      if (/FROM users WHERE id = \$1 AND is_active/.test(sql)) {
        return Promise.resolve({ rows: [USER_ROW] });
      }
      if (/FROM user_roles WHERE user_id = \$1 AND role = ANY/.test(sql)) {
        // requireRole filters by the allowed-role list; a vendor must get no rows
        const role = handlers.find((h) => 'role' in h)?.role;
        const allowed = params && params[1];
        const granted = role && Array.isArray(allowed) && allowed.includes(role);
        return Promise.resolve({ rows: granted ? [{ role }] : [] });
      }
      if (/FROM user_roles WHERE user_id = \$1/.test(sql)) {
        const role = handlers.find((h) => 'role' in h)?.role;
        return Promise.resolve({ rows: role ? [{ role }] : [] });
      }
      const handler = handlers.find((h) => h.match && h.match.test(sql));
      if (handler) {
        // `onCall` lets a test capture the params of a write it only cares about
        // observing (the vendor rollup), without a second mock framework.
        if (handler.onCall) handler.onCall(params);
        return Promise.resolve(handler.response);
      }
    }
    return Promise.resolve({ rows: [] });
  });
}

describe('Assessments Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
  });

  describe('GET /api/assessments', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/assessments');
      expect(response.status).toBe(401);
    });

    it('should return 403 for vendor role', async () => {
      const token = createToken('user-id', 'vendor');
      // vendor role: requireRole's role = ANY(...) query returns no rows
      installMock([{ role: 'vendor' }]);

      const response = await request(app)
        .get('/api/assessments')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
    });

    it('should return assessments for tprm_analyst', async () => {
      const token = createToken('analyst-id', 'tprm_analyst');
      installMock([
        { role: 'tprm_analyst' },
        {
          match: /SELECT a\.\*, v\.name as vendor_name, v\.contact_email/,
          response: {
            rows: [
              { id: 'a1', vendor_id: 'v1', vendor_name: 'Vendor 1', vendor_email: 'v1@test.com', status: 'submitted', created_at: new Date().toISOString() },
              { id: 'a2', vendor_id: 'v2', vendor_name: 'Vendor 2', vendor_email: 'v2@test.com', status: 'approved', created_at: new Date().toISOString() }
            ]
          },
        },
      ]);

      const response = await request(app)
        .get('/api/assessments')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.assessments).toHaveLength(2);
    });

    it('should return empty array when no assessments', async () => {
      const token = createToken('analyst-id', 'tprm_analyst');
      installMock([
        { role: 'tprm_analyst' },
        { match: /SELECT a\.\*, v\.name as vendor_name, v\.contact_email/, response: { rows: [] } },
      ]);

      const response = await request(app)
        .get('/api/assessments')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.assessments).toHaveLength(0);
    });
  });

  describe('GET /api/assessments/my-assessments', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/assessments/my-assessments');
      expect(response.status).toBe(401);
    });

    it('should return user owned assessments', async () => {
      const token = createToken('user-id', 'vendor');
      installMock([
        { role: 'vendor' },
        {
          match: /WHERE v\.owner_user_id = \$1/,
          response: { rows: [{ id: 'a1', vendor_id: 'v1', vendor_name: 'My Vendor', status: 'in-progress' }] },
        },
      ]);

      const response = await request(app)
        .get('/api/assessments/my-assessments')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.assessments).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE v.owner_user_id = $1'),
        ['user-id']
      );
    });
  });

  describe('GET /api/assessments/:id/details', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/assessments/a1/details');
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent assessment', async () => {
      const token = createToken('user-id', 'vendor');
      installMock([{ role: 'vendor' }]);

      const response = await request(app)
        .get('/api/assessments/a1/details')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Assessment not found');
    });

    it('should return assessment details with responses for owner', async () => {
      const token = createToken('user-id', 'vendor');
      installMock([
        { role: 'vendor' },
        {
          match: /SELECT a\.\*, v\.name as vendor_name, v\.contact_email as vendor_email/,
          response: { rows: [{ id: 'a1', vendor_id: 'v1', vendor_name: 'Vendor 1', vendor_email: 'v@test.com', status: 'submitted' }] },
        },
        { match: /SELECT owner_user_id FROM vendors/, response: { rows: [{ owner_user_id: 'user-id' }] } },
        { match: /FROM assessment_responses WHERE assessment_id/, response: { rows: [{ id: 'r1', question_id: 'q1', answer: '{"value": "yes"}' }] } },
      ]);

      const response = await request(app)
        .get('/api/assessments/a1/details')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.assessment).toBeDefined();
      expect(response.body.responses).toHaveLength(1);
    });

    it('should return 403 for unauthorized user', async () => {
      const token = createToken('other-user', 'vendor');
      installMock([
        { role: 'vendor' },
        {
          match: /SELECT a\.\*, v\.name as vendor_name, v\.contact_email as vendor_email/,
          response: { rows: [{ id: 'a1', vendor_id: 'v1', vendor_name: 'Vendor', vendor_email: 'v@test.com', status: 'submitted' }] },
        },
        { match: /SELECT owner_user_id FROM vendors/, response: { rows: [{ owner_user_id: 'user-id' }] } },
      ]);

      const response = await request(app)
        .get('/api/assessments/a1/details')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });

    it('should allow tprm_analyst to view any assessment', async () => {
      const token = createToken('analyst-id', 'tprm_analyst');
      installMock([
        { role: 'tprm_analyst' },
        {
          match: /SELECT a\.\*, v\.name as vendor_name, v\.contact_email as vendor_email/,
          response: { rows: [{ id: 'a1', vendor_id: 'v1', vendor_name: 'Vendor', vendor_email: 'v@test.com', status: 'submitted' }] },
        },
        { match: /SELECT owner_user_id FROM vendors/, response: { rows: [{ owner_user_id: 'user-id' }] } },
        { match: /FROM assessment_responses WHERE assessment_id/, response: { rows: [] } },
      ]);

      const response = await request(app)
        .get('/api/assessments/a1/details')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/assessments/:id', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/assessments/a1');
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent assessment', async () => {
      const token = createToken('user-id', 'vendor');
      installMock([{ role: 'vendor' }]);

      const response = await request(app)
        .get('/api/assessments/a1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
    });

    it('should return assessment for owner', async () => {
      const token = createToken('user-id', 'vendor');
      installMock([
        { role: 'vendor' },
        {
          match: /SELECT a\.\*, v\.name as vendor_name\s+FROM assessments a/,
          response: { rows: [{ id: 'a1', vendor_id: 'v1', vendor_name: 'Vendor', status: 'in-progress' }] },
        },
        { match: /SELECT owner_user_id FROM vendors/, response: { rows: [{ owner_user_id: 'user-id' }] } },
      ]);

      const response = await request(app)
        .get('/api/assessments/a1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('a1');
    });
  });

  describe('GET /api/assessments/:id/responses', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/assessments/a1/responses');
      expect(response.status).toBe(401);
    });

    it('should return responses for authorized user', async () => {
      const token = createToken('user-id', 'vendor');
      installMock([
        { role: 'vendor' },
        {
          match: /SELECT a\.\*, v\.owner_user_id FROM assessments a/,
          response: { rows: [{ id: 'a1', vendor_id: 'v1', owner_user_id: 'user-id' }] },
        },
        { match: /FROM assessment_responses WHERE assessment_id/, response: { rows: [{ id: 'r1', question_id: 'q1', answer: '{"value": "test"}' }] } },
      ]);

      const response = await request(app)
        .get('/api/assessments/a1/responses')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('POST /api/assessments', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/assessments')
        .send({ vendorId: 'v1' });
      expect(response.status).toBe(401);
    });

    it('should return 403 for vendor role', async () => {
      const token = createToken('user-id', 'vendor');
      installMock([{ role: 'vendor' }]);

      const response = await request(app)
        .post('/api/assessments')
        .set('Authorization', `Bearer ${token}`)
        .send({ vendorId: 'v1' });
      expect(response.status).toBe(403);
    });

    it('should create assessment for tprm_analyst', async () => {
      const token = createToken('analyst-id', 'tprm_analyst');
      installMock([
        { role: 'tprm_analyst' },
        {
          match: /INSERT INTO assessments \(vendor_id, status\)/,
          response: { rows: [{ id: 'a1', vendor_id: 'v1', status: 'not-started', created_at: new Date().toISOString() }] },
        },
      ]);

      const response = await request(app)
        .post('/api/assessments')
        .set('Authorization', `Bearer ${token}`)
        .send({ vendorId: 'v1' });

      expect(response.status).toBe(201);
      expect(response.body.assessment).toBeDefined();
      expect(response.body.assessment.vendor_id).toBe('v1');
      expect(response.body.assessment.status).toBe('not-started');
    });
  });

  describe('POST /api/assessments/:id/responses', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/assessments/a1/responses')
        .send({ questionId: 'q1', answer: 'test' });
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent assessment', async () => {
      const token = createToken('user-id', 'vendor');
      installMock([{ role: 'vendor' }]);

      const response = await request(app)
        .post('/api/assessments/a1/responses')
        .set('Authorization', `Bearer ${token}`)
        .send({ questionId: 'q1', answer: 'test' });

      expect(response.status).toBe(404);
    });

    it('should save response for owner', async () => {
      const token = createToken('user-id', 'vendor');
      installMock([
        { role: 'vendor' },
        { match: /SELECT v\.owner_user_id FROM assessments a/, response: { rows: [{ owner_user_id: 'user-id' }] } },
        {
          match: /INSERT INTO assessment_responses/,
          response: { rows: [{ id: 'r1', assessment_id: 'a1', question_id: 'q1', answer: '{"value":"test"}' }] },
        },
      ]);

      const response = await request(app)
        .post('/api/assessments/a1/responses')
        .set('Authorization', `Bearer ${token}`)
        .send({ questionId: 'q1', answer: { value: 'test' } });

      expect(response.status).toBe(200);
      expect(response.body.response).toBeDefined();
    });

    it('should allow tprm_analyst to save response', async () => {
      const token = createToken('analyst-id', 'tprm_analyst');
      installMock([
        { role: 'tprm_analyst' },
        { match: /SELECT v\.owner_user_id FROM assessments a/, response: { rows: [{ owner_user_id: 'user-id' }] } },
        {
          match: /INSERT INTO assessment_responses/,
          response: { rows: [{ id: 'r1', assessment_id: 'a1', question_id: 'q1', answer: '{"value":"test"}' }] },
        },
      ]);

      const response = await request(app)
        .post('/api/assessments/a1/responses')
        .set('Authorization', `Bearer ${token}`)
        .send({ questionId: 'q1', answer: { value: 'test' } });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/assessments/:id/submit', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).post('/api/assessments/a1/submit');
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent assessment', async () => {
      const token = createToken('user-id', 'vendor');
      installMock([{ role: 'vendor' }]);

      const response = await request(app)
        .post('/api/assessments/a1/submit')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
    });

    it('should return 403 for non-owner', async () => {
      const token = createToken('other-user', 'vendor');
      installMock([
        { role: 'vendor' },
        { match: /SELECT v\.owner_user_id FROM assessments a/, response: { rows: [{ owner_user_id: 'user-id' }] } },
      ]);

      const response = await request(app)
        .post('/api/assessments/a1/submit')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
    });

    it('should submit assessment for owner', async () => {
      const token = createToken('user-id', 'vendor');
      installMock([
        { role: 'vendor' },
        { match: /SELECT v\.owner_user_id FROM assessments a/, response: { rows: [{ owner_user_id: 'user-id' }] } },
        // submit now re-scores before writing: questions + responses, then UPDATE
        { match: /FROM questions ORDER BY display_order/, response: { rows: [] } },
        { match: /SELECT question_id, answer FROM assessment_responses/, response: { rows: [] } },
        {
          match: /UPDATE assessments\s+SET status = 'submitted'/,
          response: { rows: [{ id: 'a1', status: 'submitted', submitted_at: new Date().toISOString() }] },
        },
      ]);

      const response = await request(app)
        .post('/api/assessments/a1/submit')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.assessment.status).toBe('submitted');
    });

    it('rolls the score up onto the vendor row after submitting', async () => {
      const token = createToken('user-id', 'vendor');
      let rollup = null;
      installMock([
        { role: 'vendor' },
        { match: /SELECT v\.owner_user_id FROM assessments a/, response: { rows: [{ owner_user_id: 'user-id' }] } },
        { match: /FROM questions ORDER BY display_order/, response: { rows: [] } },
        { match: /SELECT question_id, answer FROM assessment_responses/, response: { rows: [] } },
        {
          match: /UPDATE assessments\s+SET status = 'submitted'/,
          response: { rows: [{ id: 'a1', vendor_id: 'v1', status: 'submitted', risk_score: 80, risk_level: 'critical' }] },
        },
        {
          match: /UPDATE vendors v/,
          response: { rows: [] },
          onCall: (params) => { rollup = params; },
        },
      ]);

      const response = await request(app)
        .post('/api/assessments/a1/submit')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      // Without this the dashboard's risk distribution and the vendors table
      // stay permanently empty — vendors.current_risk_score had no writer.
      expect(rollup).toEqual(['v1']);
    });
  });

  describe('POST /api/assessments/:id/review', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/assessments/a1/review')
        .send({ action: 'approve' });
      expect(response.status).toBe(401);
    });

    it('should return 403 for vendor role', async () => {
      const token = createToken('user-id', 'vendor');
      installMock([{ role: 'vendor' }]);

      const response = await request(app)
        .post('/api/assessments/a1/review')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'approve' });
      expect(response.status).toBe(403);
    });

    it('should approve assessment for tprm_analyst', async () => {
      const token = createToken('analyst-id', 'tprm_analyst');
      installMock([
        { role: 'tprm_analyst' },
        { match: /UPDATE assessments\s+SET status = \$1/, response: { rows: [{ id: 'a1', risk_score: 50, risk_level: 'Medium' }] } },
        { match: /INSERT INTO assessment_review_history/, response: { rows: [] } },
        { match: /SELECT v\.contact_email, v\.name as vendor_name/, response: { rows: [] } },
      ]);

      const response = await request(app)
        .post('/api/assessments/a1/review')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'approve', riskScore: 45, riskLevel: 'Medium', comments: 'Approved' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Assessment approve successfully');
    });

    it('should reject assessment', async () => {
      const token = createToken('analyst-id', 'tprm_analyst');
      installMock([
        { role: 'tprm_analyst' },
        { match: /UPDATE assessments\s+SET status = \$1/, response: { rows: [{ id: 'a1', risk_score: 50, risk_level: 'Medium' }] } },
        { match: /INSERT INTO assessment_review_history/, response: { rows: [] } },
        { match: /SELECT v\.contact_email, v\.name as vendor_name/, response: { rows: [] } },
      ]);

      const response = await request(app)
        .post('/api/assessments/a1/review')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'reject', comments: 'Not compliant' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Assessment reject successfully');
    });

    it('should request revision', async () => {
      const token = createToken('analyst-id', 'tprm_analyst');
      installMock([
        { role: 'tprm_analyst' },
        { match: /UPDATE assessments\s+SET status = \$1/, response: { rows: [{ id: 'a1', risk_score: 50, risk_level: 'Medium' }] } },
        { match: /INSERT INTO assessment_review_history/, response: { rows: [] } },
        { match: /SELECT v\.contact_email, v\.name as vendor_name/, response: { rows: [{ contact_email: 'vendor@test.com', vendor_name: 'Test Vendor' }] } },
      ]);

      const response = await request(app)
        .post('/api/assessments/a1/review')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'request_revision', comments: 'Need more details' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Assessment request revision successfully');
    });

    it('should return 404 when the assessment does not exist', async () => {
      const token = createToken('analyst-id', 'tprm_analyst');
      installMock([
        { role: 'tprm_analyst' },
        { match: /UPDATE assessments\s+SET status = \$1/, response: { rows: [] } },
      ]);

      const response = await request(app)
        .post('/api/assessments/00000000-0000-0000-0000-000000000000/review')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'approve' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Assessment not found');
    });

    it('should return 400 for invalid action', async () => {
      const token = createToken('analyst-id', 'tprm_analyst');
      installMock([{ role: 'tprm_analyst' }]);

      const response = await request(app)
        .post('/api/assessments/a1/review')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'invalid_action' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid review action');
    });
  });

  describe('GET /api/assessments/:id/reviews', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/assessments/a1/reviews');
      expect(response.status).toBe(401);
    });

    it('should return review history for authorized user', async () => {
      const token = createToken('analyst-id', 'tprm_analyst');
      installMock([
        { role: 'tprm_analyst' },
        { match: /SELECT a\.\*, v\.owner_user_id FROM assessments a/, response: { rows: [{ id: 'a1', vendor_id: 'v1', owner_user_id: 'user-id' }] } },
        {
          match: /FROM assessment_review_history rh/,
          response: {
            rows: [
              { id: 'rh1', assessment_id: 'a1', reviewer_id: 'analyst-id', action: 'approve', comments: 'Good', created_at: new Date().toISOString(), reviewer_name: 'Analyst', reviewer_email: 'analyst@test.com' }
            ]
          },
        },
      ]);

      const response = await request(app)
        .get('/api/assessments/a1/reviews')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.reviews).toHaveLength(1);
    });

    it('hides internal notes from the vendor who owns the assessment', async () => {
      // The read must carry the same is_internal boundary the remediation
      // comments do, or a vendor sees the internal team's notes on its own
      // assessment — the reviewer's comments are not written for the vendor.
      const token = createToken('user-id', 'vendor');
      let historyParams = null;
      installMock([
        { role: 'vendor' },
        { match: /SELECT a\.\*, v\.owner_user_id FROM assessments a/, response: { rows: [{ id: 'a1', vendor_id: 'v1', owner_user_id: 'user-id' }] } },
        {
          match: /FROM assessment_review_history rh/,
          response: { rows: [] },
          onCall: (params) => { historyParams = params; },
        },
      ]);

      const response = await request(app)
        .get('/api/assessments/a1/reviews')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      // The vendor is the owner but not TPRM staff, so the filter must be false.
      expect(historyParams).toEqual(['a1', false]);
    });
  });

  describe('POST /api/assessments/:id/comments', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/assessments/a1/comments')
        .send({ comment: 'Test comment' });
      expect(response.status).toBe(401);
    });

    it('should return 400 for missing comment', async () => {
      const token = createToken('analyst-id', 'tprm_analyst');
      installMock([{ role: 'tprm_analyst' }]);

      const response = await request(app)
        .post('/api/assessments/a1/comments')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(response.status).toBe(400);
    });

    it('should add comment for tprm_analyst', async () => {
      const token = createToken('analyst-id', 'tprm_analyst');
      installMock([
        { role: 'tprm_analyst' },
        {
          match: /INSERT INTO assessment_review_history/,
          response: {
            rows: [{ id: 'c1', assessment_id: 'a1', reviewer_id: 'analyst-id', action: 'comment', comments: 'Test comment', is_internal: true, created_at: new Date().toISOString() }]
          },
        },
      ]);

      const response = await request(app)
        .post('/api/assessments/a1/comments')
        .set('Authorization', `Bearer ${token}`)
        .send({ comment: 'Test comment', isInternal: true });

      expect(response.status).toBe(201);
      expect(response.body.comment).toBeDefined();
      expect(response.body.comment.comments).toBe('Test comment');
    });
  });
});
