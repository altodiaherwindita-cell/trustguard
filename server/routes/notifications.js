import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { pool } from '../index.js';

const router = Router();

// Get user notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, unreadOnly = false } = req.query;

    let query = `
      SELECT * FROM notifications
      WHERE (user_id = $1 OR recipient_email = $2)
    `;

    const params = [req.userId, req.userEmail];
    let paramIndex = 3;

    if (unreadOnly === 'true') {
      query += ` AND status != 'read'`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM notifications WHERE (user_id = $1 OR recipient_email = $2)`,
      [req.userId, req.userEmail]
    );

    const unreadCount = await pool.query(
      `SELECT COUNT(*) FROM notifications 
       WHERE (user_id = $1 OR recipient_email = $2) AND status != 'read'`,
      [req.userId, req.userEmail]
    );

    res.json({ 
      notifications: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      },
      unreadCount: parseInt(unreadCount.rows[0].count)
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const checkResult = await pool.query(
      `SELECT * FROM notifications 
       WHERE id = $1 AND (user_id = $2 OR recipient_email = $3)`,
      [id, req.userId, req.userEmail]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const result = await pool.query(
      `UPDATE notifications
       SET status = 'read', read_at = now()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    res.json({ notification: result.rows[0], message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE notifications
       SET status = 'read', read_at = now()
       WHERE (user_id = $1 OR recipient_email = $2) AND status != 'read'
       RETURNING *`,
      [req.userId, req.userEmail]
    );

    res.json({ 
      updated: result.rowCount,
      message: `Marked ${result.rowCount} notifications as read` 
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// Get unread count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as unread_count FROM notifications 
       WHERE (user_id = $1 OR recipient_email = $2) AND status != 'read'`,
      [req.userId, req.userEmail]
    );

    res.json({ unreadCount: parseInt(result.rows[0].unread_count) });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Create notification (internal use - TPRM/Admin only)
router.post('/', authenticateToken, requireRole('admin', 'tprm_analyst'), async (req, res) => {
  try {
    const { 
      user_id, 
      recipient_email, 
      template_name, 
      type = 'in-app',
      subject, 
      body, 
      priority = 'normal',
      scheduled_at,
      metadata 
    } = req.body;

    if (!user_id && !recipient_email) {
      return res.status(400).json({ error: 'Either user_id or recipient_email is required' });
    }

    const result = await pool.query(
      `INSERT INTO notifications 
       (user_id, recipient_email, template_name, type, subject, body, priority, scheduled_at, metadata, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        user_id || null,
        recipient_email || null,
        template_name || null,
        type,
        subject || null,
        body,
        priority,
        scheduled_at || null,
        metadata ? JSON.stringify(metadata) : null,
        scheduled_at ? 'pending' : 'sent'
      ]
    );

    res.status(201).json({ 
      notification: result.rows[0], 
      message: 'Notification created successfully' 
    });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// Get notification templates (TPRM/Admin only)
router.get('/templates', authenticateToken, requireRole('admin', 'tprm_analyst'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notification_templates ORDER BY name`
    );

    res.json({ templates: result.rows });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to get notification templates' });
  }
});

// Update notification template (Admin only)
router.patch('/templates/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, body, variables } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (subject !== undefined) {
      updates.push(`subject = $${paramIndex}`);
      values.push(subject);
      paramIndex++;
    }
    if (body !== undefined) {
      updates.push(`body = $${paramIndex}`);
      values.push(body);
      paramIndex++;
    }
    if (variables !== undefined) {
      updates.push(`variables = $${paramIndex}`);
      values.push(JSON.stringify(variables));
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE notification_templates SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    res.json({ 
      template: result.rows[0], 
      message: 'Template updated successfully' 
    });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ error: 'Failed to update notification template' });
  }
});

export default router;
