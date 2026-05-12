import jwt from 'jsonwebtoken';
import { pool } from '../index.js';

const SESSION_TIMEOUT_MINUTES = 15; // 15 minutes of inactivity
const FORCE_RELOGIN_HOURS = 8; // Force relogin after 8 hours

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
  
    // Check if token has expired due to force relogin (8 hours)
    const tokenAge = Date.now() - decoded.iat * 1000;
    const maxTokenAge = FORCE_RELOGIN_HOURS * 60 * 60 * 1000; // Convert to milliseconds
    
    if (tokenAge > maxTokenAge) {
      return res.status(401).json({ error: 'Session expired. Please login again.' });
    }
    
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
    req.tokenIssuedAt = decoded.iat;
  
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

// Helper to check session activity timeout
export const checkSessionActivity = (req, res, next) => {
  if (!req.tokenIssuedAt) {
    return next();
  }
  
  const now = Math.floor(Date.now() / 1000);
  const timeSinceLastActivity = now - req.tokenIssuedAt;
  const timeoutSeconds = SESSION_TIMEOUT_MINUTES * 60;
  
  if (timeSinceLastActivity > timeoutSeconds) {
    return res.status(401).json({ 
      error: 'Session timed out due to inactivity',
      reason: 'inactivity_timeout'
    });
  }
  
  next();
};
