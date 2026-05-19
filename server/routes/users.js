import { Router } from 'express';
import bcrypt from 'bcrypt';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { pool } from '../index.js';

const router = Router();

// Password policy validation
function validatePasswordPolicy(password) {
  const errors = [];
  
  // Minimum 8 characters
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  // Must contain lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  // Must contain uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  // Must contain a number
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  // Must contain a special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Get password strength score (0-4)
function getPasswordStrength(password) {
  let score = 0;
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;
  
  return Math.min(score, 4);
}

// Create new user (admin only)
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { email, password, full_name, company, roles } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Validate password policy
    const passwordValidation = validatePasswordPolicy(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        error: 'Password does not meet policy requirements',
        details: passwordValidation.errors
      });
    }
    
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, company, must_change_password)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, company, is_active, created_at`,
      [email, passwordHash, full_name || null, company || null, false]
    );
    
    const newUser = result.rows[0];
    
    // Assign roles (default to vendor if not specified)
    const userRoles = roles && roles.length > 0 ? roles : ['vendor'];
    
    for (const role of userRoles) {
      if (!['admin', 'tprm_analyst', 'vendor'].includes(role)) {
        await pool.query('DELETE FROM users WHERE id = $1', [newUser.id]);
        return res.status(400).json({ error: `Invalid role: ${role}` });
      }
      
      await pool.query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
        [newUser.id, role]
      );
    }
    
    res.status(201).json({ 
      user: {
        ...newUser,
        roles: userRoles
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Get all users (admin only)
router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.company, u.is_active, u.created_at,
              COALESCE(ARRAY_AGG(ur.role) FILTER (WHERE ur.role IS NOT NULL), ARRAY[]::app_role[]) as roles
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get user by ID (admin or TPRM only)
router.get('/:id', authenticateToken, requireRole('admin', 'tprm_analyst'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.company, u.is_active, u.created_at,
              COALESCE(ARRAY_AGG(ur.role) FILTER (WHERE ur.role IS NOT NULL), ARRAY[]::app_role[]) as roles
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       WHERE u.id = $1
       GROUP BY u.id`
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update user role (admin only)
router.patch('/:id/role', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.params.id;

    if (!['admin', 'tprm_analyst', 'vendor'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Remove existing roles and add new one
    await pool.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
    await pool.query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [userId, role]);

    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Deactivate/activate user (admin only)
router.patch('/:id/status', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { isActive } = req.body;
    const userId = req.params.id;

    await pool.query(
      'UPDATE users SET is_active = $1, updated_at = now() WHERE id = $2',
      [isActive, userId]
    );

    res.json({ message: `User ${isActive ? 'activated' : 'deactivated'} successfully` });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

export default router;
