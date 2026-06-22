import { Router } from 'express';
import { pool } from '../index.js';
import { sendAssessmentInvitation } from '../services/emailService.js';

const router = Router();

// Validate invitation token
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const result = await pool.query(
      `SELECT ai.*, v.name as vendor_name
       FROM assessment_invitations ai
       JOIN vendors v ON ai.vendor_id = v.id
       WHERE ai.token = $1 AND ai.status = 'pending' AND ai.expires_at > now()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ valid: false, error: 'Invalid or expired invitation' });
    }

    const invitation = result.rows[0];

    res.json({
      valid: true,
      assessment_id: invitation.assessment_id,
      vendor_name: invitation.vendor_name,
      email: invitation.email,
      requires_auth: true,
    });
  } catch (error) {
    console.error('Get invitation error:', error);
    res.status(500).json({ valid: false, error: 'Failed to validate invitation' });
  }
});

// Create invitation and send email
router.post('/', async (req, res) => {
  try {
    const { vendorId, assessmentId, email, sendEmailNotification = true } = req.body;

    if (!vendorId || !assessmentId || !email) {
      return res.status(400).json({ error: 'vendorId, assessmentId, and email are required' });
    }

    // Generate secure token
    const token = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Get vendor name for email
    const vendorResult = await pool.query(
      'SELECT name FROM vendors WHERE id = $1',
      [vendorId]
    );

    if (vendorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const vendorName = vendorResult.rows[0].name;

    // Create invitation
    const result = await pool.query(
      `INSERT INTO assessment_invitations (vendor_id, assessment_id, email, token, expires_at, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [vendorId, assessmentId, email, token, expiresAt, req.userId || null]
    );

    const invitation = result.rows[0];

    // Send email notification if requested
    if (sendEmailNotification) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const assessmentLink = `${frontendUrl}/invite/${token}`;

      const emailResult = await sendAssessmentInvitation(email, vendorName, assessmentLink, expiresAt);

      // Update invitation with email status
      if (emailResult.success) {
        await pool.query(
          'UPDATE assessment_invitations SET status = $1 WHERE id = $2',
          ['sent', invitation.id]
        );
      } else {
        console.warn('Failed to send invitation email:', emailResult.message || emailResult.error);
      }
    }

    res.status(201).json({ 
      invitation: result.rows[0], 
      message: 'Invitation created successfully',
      emailSent: sendEmailNotification
    });
  } catch (error) {
    console.error('Create invitation error:', error);
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

export default router;
