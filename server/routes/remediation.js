import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { pool } from '../index.js';

const router = Router();

// Get remediation items for an assessment
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
      `SELECT r.*, v.name as vendor_name, u.email as assigned_to_email
       FROM remediation_items r
       JOIN vendors v ON r.vendor_id = v.id
       LEFT JOIN users u ON r.assigned_to = u.id
       WHERE r.assessment_id = $1
       ORDER BY 
         CASE r.priority 
           WHEN 'critical' THEN 1 
           WHEN 'high' THEN 2 
           WHEN 'medium' THEN 3 
           WHEN 'low' THEN 4 
         END,
         r.due_date ASC`,
      [assessmentId]
    );

    res.json({ remediation: result.rows });
  } catch (error) {
    console.error('Get remediation items error:', error);
    res.status(500).json({ error: 'Failed to get remediation items' });
  }
});

// Create remediation item (TPRM only)
router.post('/', authenticateToken, requireRole('admin', 'tprm_analyst'), async (req, res) => {
  try {
    const { 
      assessment_id, 
      vendor_id, 
      question_id, 
      title, 
      description, 
      risk_level, 
      priority, 
      due_date, 
      assigned_to,
      vendor_contact 
    } = req.body;

    const result = await pool.query(
      `INSERT INTO remediation_items 
       (assessment_id, vendor_id, question_id, title, description, 
        risk_level, priority, due_date, assigned_to, vendor_contact, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'open')
       RETURNING *`,
      [
        assessment_id,
        vendor_id,
        question_id || null,
        title,
        description,
        risk_level,
        priority,
        due_date || null,
        assigned_to || null,
        vendor_contact || null
      ]
    );

    // Log audit event
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'remediation_created', 'remediation_item', $2, $3)`,
      [req.userId, result.rows[0].id, JSON.stringify({ title, priority })]
    );

    res.status(201).json({ 
      remediation: result.rows[0], 
      message: 'Remediation item created successfully' 
    });
  } catch (error) {
    console.error('Create remediation error:', error);
    res.status(500).json({ error: 'Failed to create remediation item' });
  }
});

// Update remediation item
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      description, 
      priority, 
      due_date, 
      assigned_to,
      vendor_contact,
      vendor_response,
      reviewer_notes 
    } = req.body;

    // Get current remediation item
    const currentResult = await pool.query(
      `SELECT r.*, v.owner_user_id FROM remediation_items r
       JOIN assessments a ON r.assessment_id = a.id
       JOIN vendors v ON a.vendor_id = v.id
       WHERE r.id = $1`,
      [id]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Remediation item not found' });
    }

    const current = currentResult.rows[0];
    const isOwner = current.owner_user_id === req.userId;
    const hasTPRMRole = req.userRole === 'admin' || req.userRole === 'tprm_analyst';

    if (!isOwner && !hasTPRMRole) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      values.push(title);
      paramIndex++;
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(description);
      paramIndex++;
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramIndex}`);
      values.push(priority);
      paramIndex++;
    }
    if (due_date !== undefined) {
      updates.push(`due_date = $${paramIndex}`);
      values.push(due_date);
      paramIndex++;
    }
    if (assigned_to !== undefined) {
      updates.push(`assigned_to = $${paramIndex}`);
      values.push(assigned_to);
      paramIndex++;
    }
    if (vendor_contact !== undefined) {
      updates.push(`vendor_contact = $${paramIndex}`);
      values.push(vendor_contact);
      paramIndex++;
    }
    if (vendor_response !== undefined) {
      updates.push(`vendor_response = $${paramIndex}, vendor_response_at = now()`);
      values.push(vendor_response);
      paramIndex++;
    }
    if (reviewer_notes !== undefined) {
      updates.push(`reviewer_notes = $${paramIndex}`);
      values.push(reviewer_notes);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = now()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE remediation_items SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    res.json({ 
      remediation: result.rows[0], 
      message: 'Remediation item updated successfully' 
    });
  } catch (error) {
    console.error('Update remediation error:', error);
    res.status(500).json({ error: 'Failed to update remediation item' });
  }
});

// Mark remediation as completed (Vendor)
router.patch('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { completion_notes } = req.body;

    // Verify ownership
    const checkResult = await pool.query(
      `SELECT r.*, v.owner_user_id FROM remediation_items r
       JOIN assessments a ON r.assessment_id = a.id
       JOIN vendors v ON a.vendor_id = v.id
       WHERE r.id = $1`,
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Remediation item not found' });
    }

    const item = checkResult.rows[0];
    
    if (item.owner_user_id !== req.userId && req.userRole !== 'admin' && req.userRole !== 'tprm_analyst') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `UPDATE remediation_items
       SET status = 'completed',
           vendor_response = $1,
           vendor_response_at = now(),
           updated_at = now()
       WHERE id = $2
       RETURNING *`,
      [completion_notes, id]
    );

    // Log audit event
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id)
       VALUES ($1, 'remediation_completed', 'remediation_item', $2)`,
      [req.userId, id]
    );

    res.json({ 
      remediation: result.rows[0], 
      message: 'Remediation marked as completed' 
    });
  } catch (error) {
    console.error('Complete remediation error:', error);
    res.status(500).json({ error: 'Failed to complete remediation item' });
  }
});

// Verify remediation completion (TPRM only)
router.patch('/:id/verify', authenticateToken, requireRole('admin', 'tprm_analyst'), async (req, res) => {
  try {
    const { id } = req.params;
    const { verified, closure_reason } = req.body;

    const newStatus = verified ? 'verified' : 'in-progress';

    const result = await pool.query(
      `UPDATE remediation_items
       SET status = $1,
           verified_by = $2,
           verified_at = now(),
           closure_reason = $3,
           updated_at = now()
       WHERE id = $4
       RETURNING *`,
      [newStatus, req.userId, closure_reason, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Remediation item not found' });
    }

    // Log audit event
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'remediation_verified', 'remediation_item', $2, $3)`,
      [req.userId, id, JSON.stringify({ verified })]
    );

    res.json({ 
      remediation: result.rows[0], 
      message: `Remediation ${verified ? 'verified' : 'sent back for rework'}` 
    });
  } catch (error) {
    console.error('Verify remediation error:', error);
    res.status(500).json({ error: 'Failed to verify remediation item' });
  }
});

// Close remediation item (TPRM only)
router.patch('/:id/close', authenticateToken, requireRole('admin', 'tprm_analyst'), async (req, res) => {
  try {
    const { id } = req.params;
    const { closure_reason } = req.body;

    const result = await pool.query(
      `UPDATE remediation_items
       SET status = 'closed',
           closed_by = $1,
           closed_at = now(),
           closure_reason = $2,
           updated_at = now()
       WHERE id = $3
       RETURNING *`,
      [req.userId, closure_reason, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Remediation item not found' });
    }

    // Log audit event
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id)
       VALUES ($1, 'remediation_closed', 'remediation_item', $2)`,
      [req.userId, id]
    );

    res.json({ 
      remediation: result.rows[0], 
      message: 'Remediation item closed successfully' 
    });
  } catch (error) {
    console.error('Close remediation error:', error);
    res.status(500).json({ error: 'Failed to close remediation item' });
  }
});

// Get all remediation items across assessments (TPRM only)
router.get('/', authenticateToken, requireRole('admin', 'tprm_analyst'), async (req, res) => {
  try {
    const { status, priority, vendorId, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT r.*, v.name as vendor_name, u.email as assigned_to_email
      FROM remediation_items r
      JOIN vendors v ON r.vendor_id = v.id
      LEFT JOIN users u ON r.assigned_to = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (priority) {
      query += ` AND r.priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    if (vendorId) {
      query += ` AND r.vendor_id = $${paramIndex}`;
      params.push(vendorId);
      paramIndex++;
    }

    query += ` ORDER BY 
      CASE r.priority 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
      END,
      r.due_date ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    res.json({ remediation: result.rows });
  } catch (error) {
    console.error('Get all remediation items error:', error);
    res.status(500).json({ error: 'Failed to get remediation items' });
  }
});

export default router;
