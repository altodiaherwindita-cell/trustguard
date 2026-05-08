import { Router } from 'express';
import { pool } from '../index.js';

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

export default router;
