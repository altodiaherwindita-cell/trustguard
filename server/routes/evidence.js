import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { pool } from '../index.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_PATH || './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png', 'image/jpeg', 'image/jpg'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 }, // 10MB default
  fileFilter
});

// Helper function to calculate file hash
function calculateFileHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Upload evidence document
router.post('/', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { assessment_id, question_id, description } = req.body;

    if (!assessment_id) {
      return res.status(400).json({ error: 'Assessment ID is required' });
    }

    // Verify permissions
    const assessmentResult = await pool.query(
      `SELECT a.*, v.owner_user_id FROM assessments a
       JOIN vendors v ON a.vendor_id = v.id
       WHERE a.id = $1`,
      [assessment_id]
    );

    if (assessmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const assessment = assessmentResult.rows[0];
    const isOwner = assessment.owner_user_id === req.userId;
    const hasTPRMRole = req.userRole === 'admin' || req.userRole === 'tprm_analyst';

    if (!isOwner && !hasTPRMRole) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const fileHash = calculateFileHash(req.file.buffer);
    const isVendorUpload = req.userRole === 'vendor';

    const result = await pool.query(
      `INSERT INTO evidence_documents 
       (assessment_id, question_id, file_name, file_path, file_size, file_type, 
        file_hash, description, uploaded_by, is_vendor_upload, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        assessment_id,
        question_id || null,
        req.file.originalname,
        req.file.path,
        req.file.size,
        req.file.mimetype,
        fileHash,
        description || null,
        req.userId,
        isVendorUpload,
        isVendorUpload ? 'pending' : 'validated'
      ]
    );

    // Log audit event
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'evidence_uploaded', 'evidence_document', $2, $3)`,
      [req.userId, result.rows[0].id, JSON.stringify({ fileName: req.file.originalname })]
    );

    res.status(201).json({ 
      evidence: result.rows[0], 
      message: 'Evidence uploaded successfully' 
    });
  } catch (error) {
    console.error('Upload evidence error:', error);
    res.status(500).json({ error: 'Failed to upload evidence' });
  }
});

// Get all evidence for an assessment
router.get('/:assessmentId', authenticateToken, async (req, res) => {
  try {
    const assessmentId = req.params.assessmentId;

    // Verify permissions
    const assessmentResult = await pool.query(
      `SELECT a.*, v.owner_user_id FROM assessments a
       JOIN vendors v ON a.vendor_id = v.id
       WHERE a.id = $1`,
      [assessmentId]
    );

    if (assessmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const assessment = assessmentResult.rows[0];
    const isOwner = assessment.owner_user_id === req.userId;
    const hasTPRMRole = req.userRole === 'admin' || req.userRole === 'tprm_analyst';

    if (!isOwner && !hasTPRMRole) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `SELECT e.*, u.full_name as uploaded_by_name, u.email as uploaded_by_email,
              v.full_name as validated_by_name
       FROM evidence_documents e
       LEFT JOIN users u ON e.uploaded_by = u.id
       LEFT JOIN users v ON e.validated_by = v.id
       WHERE e.assessment_id = $1
       ORDER BY e.created_at DESC`,
      [assessmentId]
    );

    res.json({ evidence: result.rows });
  } catch (error) {
    console.error('Get evidence error:', error);
    res.status(500).json({ error: 'Failed to get evidence' });
  }
});

// Download evidence file
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, a.id as assessment_id FROM evidence_documents e
       JOIN assessments a ON e.assessment_id = a.id
       JOIN vendors v ON a.vendor_id = v.id
       WHERE e.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    const evidence = result.rows[0];
    
    // Verify permissions
    const isOwner = v.owner_user_id === req.userId;
    const hasTPRMRole = req.userRole === 'admin' || req.userRole === 'tprm_analyst';

    if (!isOwner && !hasTPRMRole) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(evidence.file_path)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Log download
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id)
       VALUES ($1, 'evidence_downloaded', 'evidence_document', $2)`,
      [req.userId, req.params.id]
    );

    res.download(evidence.file_path, evidence.file_name);
  } catch (error) {
    console.error('Download evidence error:', error);
    res.status(500).json({ error: 'Failed to download evidence' });
  }
});

// Verify evidence (TPRM only)
router.patch('/:id/verify', authenticateToken, requireRole('admin', 'tprm_analyst'), async (req, res) => {
  try {
    const { status, validation_notes } = req.body;
    
    if (!['validated', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await pool.query(
      `UPDATE evidence_documents
       SET status = $1, 
           validated_by = $2, 
           validated_at = now(),
           validation_notes = $3,
           rejection_reason = CASE WHEN $1 = 'rejected' THEN $3 ELSE NULL END
       WHERE id = $4
       RETURNING *`,
      [status, req.userId, validation_notes, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    // Log audit event
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'evidence_verified', 'evidence_document', $2, $3)`,
      [req.userId, req.params.id, JSON.stringify({ status, notes: validation_notes })]
    );

    res.json({ 
      evidence: result.rows[0], 
      message: `Evidence ${status} successfully` 
    });
  } catch (error) {
    console.error('Verify evidence error:', error);
    res.status(500).json({ error: 'Failed to verify evidence' });
  }
});

// Delete evidence
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, a.id as assessment_id, v.owner_user_id 
       FROM evidence_documents e
       JOIN assessments a ON e.assessment_id = a.id
       JOIN vendors v ON a.vendor_id = v.id
       WHERE e.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    const evidence = result.rows[0];
    const isOwner = evidence.owner_user_id === req.userId;
    const hasTPRMRole = req.userRole === 'admin' || req.userRole === 'tprm_analyst';
    const isUploader = evidence.uploaded_by === req.userId;

    if (!isOwner && !hasTPRMRole && !isUploader) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete file from disk
    if (fs.existsSync(evidence.file_path)) {
      fs.unlinkSync(evidence.file_path);
    }

    await pool.query('DELETE FROM evidence_documents WHERE id = $1', [req.params.id]);

    // Log audit event
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id)
       VALUES ($1, 'evidence_deleted', 'evidence_document', $2)`,
      [req.userId, req.params.id]
    );

    res.json({ message: 'Evidence deleted successfully' });
  } catch (error) {
    console.error('Delete evidence error:', error);
    res.status(500).json({ error: 'Failed to delete evidence' });
  }
});

export default router;
