import { Router } from 'express';
import { randomBytes } from 'crypto';
import { pool } from '../db.js';
import { sendAssessmentInvitation } from '../services/emailService.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Validate invitation token
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // No status filter: the token is the credential and expiry is the only real
    // constraint. Filtering on 'pending' made every emailed link 404, because
    // POST / below flips the row to 'sent' as soon as the mail goes out.
    const result = await pool.query(
      `SELECT ai.*, v.name as vendor_name
       FROM assessment_invitations ai
       JOIN vendors v ON ai.vendor_id = v.id
       WHERE ai.token = $1 AND ai.expires_at > now()`,
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
    });
  } catch (error) {
    console.error('Get invitation error:', error);
    res.status(500).json({ valid: false, error: 'Failed to validate invitation' });
  }
});

// Accept an invitation: bind the invited vendor to the signed-in account.
// Without this the vendor path is unreachable — `vendors.owner_user_id` is what
// every vendor-ownership check compares against (assessments, evidence,
// remediation, reports), and nothing else ever writes it for an invited vendor.
router.post('/:token/accept', authenticateToken, async (req, res) => {
  try {
    const { token } = req.params;

    const result = await pool.query(
      `SELECT ai.*, v.name as vendor_name
       FROM assessment_invitations ai
       JOIN vendors v ON ai.vendor_id = v.id
       WHERE ai.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid invitation' });
    }

    const invitation = result.rows[0];

    if (new Date(invitation.expires_at) <= new Date()) {
      return res.status(410).json({ error: 'Invitation has expired' });
    }

    // The invite is addressed to one mailbox. Binding it to whoever happens to
    // hold the link would hand a vendor's assessment to any signed-in account.
    // Checked before anything is written, so a wrong-account click leaves the
    // invitation usable by its real recipient.
    if (invitation.email.toLowerCase() !== (req.userEmail || '').toLowerCase()) {
      return res.status(403).json({
        error: 'This invitation was sent to a different email address. Sign in as the invited user.',
      });
    }

    await pool.query(
      'UPDATE vendors SET owner_user_id = $1 WHERE id = $2',
      [req.userId, invitation.vendor_id]
    );

    await pool.query(
      `UPDATE assessment_invitations
       SET status = 'accepted', accepted_at = now()
       WHERE id = $1`,
      [invitation.id]
    );

    res.json({
      message: 'Invitation accepted',
      assessment_id: invitation.assessment_id,
      vendor_id: invitation.vendor_id,
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// Create invitation and send email
router.post('/', authenticateToken, requireRole('admin', 'tprm_analyst'), async (req, res) => {
  try {
    const { vendorId, assessmentId, email, sendEmailNotification = true } = req.body;

    if (!vendorId || !assessmentId || !email) {
      return res.status(400).json({ error: 'vendorId, assessmentId, and email are required' });
    }

    // Generate secure token
    const token = randomBytes(32).toString('hex');
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
      // Must be the origin the *recipient's browser* can reach. The 5173 default
      // here pointed every emailed link at a port nothing listens on: Vite runs
      // on 8080 (vite.config.ts) and nginx serves :80 in compose.
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
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
