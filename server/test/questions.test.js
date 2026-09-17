import request from 'supertest';
import { app, mockPool } from './app.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret-key-for-testing-only';

function createToken(userId, role = 'vendor', email = `user-${userId}@example.com`) {
  return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: '24h' });
}

// Real middleware/auth.js spends the first two pool queries of every authenticated
// request on the user lookup and the user_roles lookup, so key the mock on SQL text
// instead of fragile positional mockResolvedValueOnce chains.
function mockQueries(questionRows) {
  mockPool.query.mockImplementation(async (sql) => {
    if (sql.includes('FROM users')) {
      return { rows: [{ id: 'user-id', email: 'user-user-id@example.com', full_name: 'Test User', company: 'Acme' }] };
    }
    if (sql.includes('FROM user_roles')) {
      return { rows: [{ role: 'vendor' }] };
    }
    if (sql.includes('FROM questions')) {
      return { rows: questionRows };
    }
    throw new Error(`Unexpected query: ${sql}`);
  });
}

describe('Questions Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
  });

  describe('GET /api/questions', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/questions');
      expect(response.status).toBe(401);
    });

    it('should return questions for authenticated user', async () => {
      const token = createToken('user-id', 'vendor');
      mockQueries([
        { id: 'q1', question: 'Question 1', category: 'Security', type: 'text', display_order: 1 },
        { id: 'q2', question: 'Question 2', category: 'Compliance', type: 'boolean', display_order: 2 }
      ]);

      const response = await request(app)
        .get('/api/questions')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].question).toBe('Question 1');
    });

    it('should return empty array when no questions', async () => {
      const token = createToken('user-id', 'vendor');
      mockQueries([]);

      const response = await request(app)
        .get('/api/questions')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });
  });
});