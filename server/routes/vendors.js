import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { pool } from '../index.js';

const router = Router();

// Get all vendors (TPRM only)
router.get('/', authenticateToken, requireRole('admin', 'tprm_analyst'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.*, u.email as owner_email, u.full_name as owner_name
       FROM vendors v
       LEFT JOIN users u ON v.owner_user_id = u.id
       ORDER BY v.created_at DESC`
    );

    res.json({ vendors: result.rows });
  } catch (error) {
    console.error('Get vendors error:', error);
    res.status(500).json({ error: 'Failed to get vendors' });
  }
});

// Get my vendors (vendor users)
router.get('/my-vendors', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM vendors WHERE owner_user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );

    res.json({ vendors: result.rows });
  } catch (error) {
    console.error('Get my vendors error:', error);
    res.status(500).json({ error: 'Failed to get vendors' });
  }
});

// Get vendor by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.*, u.email as owner_email, u.full_name as owner_name
       FROM vendors v
       LEFT JOIN users u ON v.owner_user_id = u.id
       WHERE v.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const vendor = result.rows[0];

    // Check permissions
    const isOwner = vendor.owner_user_id === req.userId;
    const hasTPRMRole = req.userRole === 'admin' || req.userRole === 'tprm_analyst';

    if (!isOwner && !hasTPRMRole) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ vendor });
  } catch (error) {
    console.error('Get vendor error:', error);
    res.status(500).json({ error: 'Failed to get vendor' });
  }
});

// Create vendor (TPRM only)
router.post('/', authenticateToken, requireRole('admin', 'tprm_analyst'), async (req, res) => {
  try {
    const { name, category, industry, contact_email, contactEmail, status, ownerUserId, owner_user_id } = req.body;

    const result = await pool.query(
      `INSERT INTO vendors (name, category, industry, contact_email, status, owner_user_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, category || 'General', industry, contact_email || contactEmail, status || 'pending', owner_user_id || ownerUserId, req.userId]
    );

    res.status(201).json({ vendor: result.rows[0], message: 'Vendor created successfully' });
  } catch (error) {
    console.error('Create vendor error:', error);
    res.status(500).json({ error: 'Failed to create vendor' });
  }
});

// Update vendor
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const vendorId = req.params.id;
    
    // Check ownership or TPRM role
    const checkResult = await pool.query('SELECT owner_user_id FROM vendors WHERE id = $1', [vendorId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const isOwner = checkResult.rows[0].owner_user_id === req.userId;
    const hasTPRMRole = req.userRole === 'admin' || req.userRole === 'tprm_analyst';

    if (!isOwner && !hasTPRMRole) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, category, industry, contactEmail, status } = req.body;

    const result = await pool.query(
      `UPDATE vendors 
       SET name = COALESCE($1, name),
           category = COALESCE($2, category),
           industry = COALESCE($3, industry),
           contact_email = COALESCE($4, contact_email),
           status = COALESCE($5, status),
           updated_at = now()
       WHERE id = $6
       RETURNING *`,
      [name, category, industry, contactEmail, status, vendorId]
    );

    res.json({ vendor: result.rows[0], message: 'Vendor updated successfully' });
  } catch (error) {
    console.error('Update vendor error:', error);
    res.status(500).json({ error: 'Failed to update vendor' });
  }
});

// Delete vendor (TPRM only)
router.delete('/:id', authenticateToken, requireRole('admin', 'tprm_analyst'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM vendors WHERE id = $1 RETURNING *', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    res.json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    console.error('Delete vendor error:', error);
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
});

export default router;
