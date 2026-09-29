import request from 'supertest';
import { app, mockPool } from './app.js';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import os from 'os';
import path from 'path';

const JWT_SECRET = 'test-secret-key-for-testing-only';

// The real route uses multer diskStorage, so uploads must land in a real temp
// directory and the download/delete paths must point inside it (isValidFilePath
// rejects anything outside UPLOAD_PATH).
const UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-evidence-'));
process.env.UPLOAD_PATH = UPLOAD_DIR;

function createToken(userId, role = 'vendor', email = `user-${userId}@example.com`) {
  return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: '24h' });
}

// authenticateToken always issues two queries (users, then user_roles) before
// the route runs; requireRole adds a third. Every chain starts with these.
function prime(role, userId, ...responses) {
  const q = mockPool.query;
  q.mockResolvedValueOnce({
    rows: [{ id: userId, email: `${userId}@example.com`, full_name: 'User', company: null }],
  });
  q.mockResolvedValueOnce({ rows: [{ role }] });
  for (const r of responses) q.mockResolvedValueOnce(r);
  return q;
}

const attachFile = (req) =>
  req.attach('file', Buffer.from('%PDF-1.4 test'), {
    filename: 'test.pdf',
    contentType: 'application/pdf',
  });

function writeUploadedFile(name) {
  const p = path.join(UPLOAD_DIR, name);
  fs.writeFileSync(p, '%PDF-1.4 test');
  return p;
}

describe('Evidence Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
  });

  afterEach(() => {
    for (const f of fs.readdirSync(UPLOAD_DIR)) {
      fs.rmSync(path.join(UPLOAD_DIR, f), { recursive: true, force: true });
    }
  });

  afterAll(() => {
    fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
  });

  describe('POST /api/evidence', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/evidence')
        .send({ assessment_id: 'a1' });
      expect(response.status).toBe(401);
    });

    it('should return 400 when no file is uploaded', async () => {
      const token = createToken('user-id', 'vendor');
      prime('vendor', 'user-id');

      const response = await request(app)
        .post('/api/evidence')
        .set('Authorization', `Bearer ${token}`)
        .send({ assessment_id: 'a1' });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No file uploaded');
    });

    it('should return 400 for missing assessment_id', async () => {
      const token = createToken('user-id', 'vendor');
      prime('vendor', 'user-id');

      const response = await attachFile(
        request(app).post('/api/evidence').set('Authorization', `Bearer ${token}`)
      ).field('description', 'no assessment');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Assessment ID is required');
    });

    it('should return 404 for non-existent assessment', async () => {
      const token = createToken('user-id', 'vendor');
      prime('vendor', 'user-id', { rows: [] });

      const response = await attachFile(
        request(app).post('/api/evidence').set('Authorization', `Bearer ${token}`)
      ).field('assessment_id', 'nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Assessment not found');
    });

    it('should return 403 for unauthorized user', async () => {
      const token = createToken('other-user', 'vendor');
      prime('vendor', 'other-user', { rows: [{ owner_user_id: 'user-id', vendor_id: 'v1' }] });

      const response = await attachFile(
        request(app).post('/api/evidence').set('Authorization', `Bearer ${token}`)
      ).field('assessment_id', 'a1');

      expect(response.status).toBe(403);
    });

    it('should upload evidence for owner', async () => {
      const token = createToken('user-id', 'vendor');
      prime(
        'vendor',
        'user-id',
        { rows: [{ owner_user_id: 'user-id', vendor_id: 'v1' }] }, // assessment
        {
          rows: [{
            id: 'e1',
            assessment_id: 'a1',
            file_name: 'test.pdf',
            file_path: path.join(UPLOAD_DIR, 'stored.pdf'),
            file_size: 1024,
            file_type: 'application/pdf',
            file_hash: 'mock-hash',
            description: 'Test evidence',
            uploaded_by: 'user-id',
            is_vendor_upload: true,
            status: 'pending',
            created_at: new Date().toISOString()
          }]
        }, // insert
        { rows: [] } // audit log
      );

      const response = await attachFile(
        request(app).post('/api/evidence').set('Authorization', `Bearer ${token}`)
      )
        .field('assessment_id', 'a1')
        .field('description', 'Test evidence');

      expect(response.status).toBe(201);
      expect(response.body.evidence).toBeDefined();
      expect(response.body.evidence.file_name).toBe('test.pdf');
      expect(response.body.evidence.status).toBe('pending');
    });

    it('should upload evidence for tprm_analyst', async () => {
      const token = createToken('analyst-id', 'tprm_analyst');
      prime(
        'tprm_analyst',
        'analyst-id',
        { rows: [{ owner_user_id: 'user-id', vendor_id: 'v1' }] },
        { rows: [{ id: 'e1', assessment_id: 'a1', file_name: 'test.pdf', status: 'validated' }] },
        { rows: [] }
      );

      const response = await attachFile(
        request(app).post('/api/evidence').set('Authorization', `Bearer ${token}`)
      ).field('assessment_id', 'a1');

      expect(response.status).toBe(201);
      expect(response.body.evidence.status).toBe('validated');
    });
  });

  describe('GET /api/evidence/:assessmentId', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/evidence/a1');
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent assessment', async () => {
      const token = createToken('user-id', 'vendor');
      prime('vendor', 'user-id', { rows: [] });

      const response = await request(app)
        .get('/api/evidence/nonexistent')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(404);
    });

    it('should return 403 for unauthorized user', async () => {
      const token = createToken('other-user', 'vendor');
      prime('vendor', 'other-user', { rows: [{ owner_user_id: 'user-id' }] });

      const response = await request(app)
        .get('/api/evidence/a1')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
    });

    it('should return evidence for owner', async () => {
      const token = createToken('user-id', 'vendor');
      prime(
        'vendor',
        'user-id',
        { rows: [{ owner_user_id: 'user-id' }] }, // assessment
        {
          rows: [{
            id: 'e1', assessment_id: 'a1', file_name: 'test.pdf', status: 'pending',
            uploaded_by_name: 'User', uploaded_by_email: 'user@test.com'
          }]
        }
      );

      const response = await request(app)
        .get('/api/evidence/a1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.evidence).toHaveLength(1);
    });
  });

  describe('GET /api/evidence/:id/download', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/evidence/e1/download');
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent evidence', async () => {
      const token = createToken('user-id', 'vendor');
      prime('vendor', 'user-id', { rows: [] });

      const response = await request(app)
        .get('/api/evidence/e1/download')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(404);
    });

    it('should stream the file to the owner', async () => {
      const filePath = writeUploadedFile('e1.pdf');
      const token = createToken('user-id', 'vendor');
      prime(
        'vendor',
        'user-id',
        { rows: [{ id: 'e1', file_name: 'test.pdf', file_path: filePath, owner_user_id: 'user-id' }] },
        { rows: [] } // audit log
      );

      const response = await request(app)
        .get('/api/evidence/e1/download')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toContain('test.pdf');
    });

    it('should return 404 when the file is missing from disk', async () => {
      const token = createToken('user-id', 'vendor');
      prime('vendor', 'user-id', {
        rows: [{
          id: 'e1', file_name: 'gone.pdf',
          file_path: path.join(UPLOAD_DIR, 'gone.pdf'), owner_user_id: 'user-id'
        }]
      });

      const response = await request(app)
        .get('/api/evidence/e1/download')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('File not found');
    });
  });

  describe('PATCH /api/evidence/:id/verify', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .patch('/api/evidence/e1/verify')
        .send({ status: 'validated' });
      expect(response.status).toBe(401);
    });

    it('should return 403 for vendor role', async () => {
      const token = createToken('user-id', 'vendor');
      prime('vendor', 'user-id', { rows: [] }); // requireRole lookup

      const response = await request(app)
        .patch('/api/evidence/e1/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'validated' });
      expect(response.status).toBe(403);
    });

    it('should return 400 for invalid status', async () => {
      const token = createToken('analyst-id', 'tprm_analyst');
      prime('tprm_analyst', 'analyst-id', { rows: [{ role: 'tprm_analyst' }] }); // requireRole

      const response = await request(app)
        .patch('/api/evidence/e1/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'invalid' });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid status');
    });

    it('should verify evidence for tprm_analyst', async () => {
      const token = createToken('analyst-id', 'tprm_analyst');
      prime(
        'tprm_analyst',
        'analyst-id',
        { rows: [{ role: 'tprm_analyst' }] }, // requireRole
        { rows: [{ id: 'e1', status: 'validated', validated_by: 'analyst-id' }] }, // update
        { rows: [] } // audit log
      );

      const response = await request(app)
        .patch('/api/evidence/e1/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'validated', validation_notes: 'Looks good' });

      expect(response.status).toBe(200);
      expect(response.body.evidence.status).toBe('validated');
    });
  });

  describe('DELETE /api/evidence/:id', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).delete('/api/evidence/e1');
      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent evidence', async () => {
      const token = createToken('user-id', 'vendor');
      prime('vendor', 'user-id', { rows: [] });

      const response = await request(app)
        .delete('/api/evidence/e1')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(404);
    });

    it('should delete evidence for owner', async () => {
      const filePath = writeUploadedFile('e1.pdf');
      const token = createToken('user-id', 'vendor');
      prime(
        'vendor',
        'user-id',
        { rows: [{ id: 'e1', file_path: filePath, owner_user_id: 'user-id', uploaded_by: 'user-id' }] },
        { rows: [] }, // delete
        { rows: [] } // audit log
      );

      const response = await request(app)
        .delete('/api/evidence/e1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Evidence deleted successfully');
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });
});
