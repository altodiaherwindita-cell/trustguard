import jwt from 'jsonwebtoken';
import { pool } from '../index.js';

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    
    // Verify user exists and is active
    const result = await pool.query(
      'SELECT id, email, full_name, company FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = result.rows[0];
    req.userId = decoded.userId;
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (...roles) => {
  return async (req, res, next) => {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const result = await pool.query(
        'SELECT role FROM user_roles WHERE user_id = $1 AND role = ANY($2)',
        [req.userId, roles]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      req.userRole = result.rows[0].role;
      next();
    } catch (error) {
      console.error('Role check error:', error);
      return res.status(500).json({ error: 'Server error during authorization' });
    }
  };
};
