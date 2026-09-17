import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

const SESSION_TIMEOUT_MINUTES = 15; // 15 minutes of inactivity
const FORCE_RELOGIN_HOURS = 8; // Force relogin after 8 hours

// Last-seen timestamps, keyed by user id. A real inactivity timeout needs a
// last-activity value, and the JWT only carries `iat` (issue time). Comparing
// against `iat` logged every user out 15 minutes after login no matter how
// continuously they were working.
// ponytail: process-local, so a restart hands everyone a fresh 15-minute window
// and a second API instance would not share state. Move to Redis or a sessions
// column when either matters. Size is bounded by distinct users.
const lastActivityAt = new Map();

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('JWT_SECRET environment variable must be set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
  } catch (error) {
    // Malformed, bad signature, or past `exp` — all mean "authenticate again",
    // which is a 401. This used to share the generic catch below and return 403,
    // but src/lib/api.ts only clears storage and redirects on 401, so a token
    // that expired mid-session left a dead token in localStorage and every
    // subsequent request failed with a generic error instead of a re-login.
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Both age checks below read `iat`. A token carrying no `iat` (or a
  // non-numeric one) makes `tokenAge` NaN, and every `NaN > x` comparison is
  // false — the 8-hour force-relogin check passed silently. Fail closed.
  if (typeof decoded.iat !== 'number') {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Force relogin after 8 hours regardless of how active the user is.
  const tokenAge = Date.now() - decoded.iat * 1000;
  if (tokenAge > FORCE_RELOGIN_HOURS * 60 * 60 * 1000) {
    lastActivityAt.delete(decoded.userId);
    return res.status(401).json({ error: 'Session expired. Please login again.' });
  }

  // 15 minutes of *inactivity*: measured from this user's previous request, not
  // from token issue time. Checked before the DB work below so an idle session
  // is rejected cheaply.
  const now = Date.now();
  const lastSeen = lastActivityAt.get(decoded.userId);
  if (lastSeen !== undefined && now - lastSeen > SESSION_TIMEOUT_MINUTES * 60 * 1000) {
    lastActivityAt.delete(decoded.userId);
    return res.status(401).json({
      error: 'Session timed out due to inactivity',
      reason: 'inactivity_timeout'
    });
  }

  try {
    // Verify user exists and is active
    const result = await pool.query(
      'SELECT id, email, full_name, company FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      lastActivityAt.delete(decoded.userId);
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Resolve roles here so routes on the authenticateToken-only path can read
    // req.userRole. Previously only requireRole set it, so ownership checks in
    // routes without requireRole saw undefined and denied admins/analysts.
    const rolesResult = await pool.query(
      'SELECT role FROM user_roles WHERE user_id = $1',
      [decoded.userId]
    );
    const roles = rolesResult.rows.map(r => r.role);

    req.user = result.rows[0];
    req.userId = decoded.userId;
    // notifications.js matches on `user_id = $1 OR recipient_email = $2`; without
    // this the email half of that predicate was always NULL and never matched.
    req.userEmail = result.rows[0].email;
    req.userRoles = roles;
    // Most privileged role wins, so `req.userRole === 'admin'` holds for admins
    // who also carry tprm_analyst.
    req.userRole = ['admin', 'tprm_analyst', 'vendor'].find(r => roles.includes(r));
    req.tokenIssuedAt = decoded.iat;

    // Only a fully authenticated request counts as activity.
    lastActivityAt.set(decoded.userId, now);

    next();
  } catch (error) {
    // A DB failure is a server fault, not a credentials problem — 500, so the
    // client does not throw away a perfectly good token over it.
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Server error during authentication' });
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

// Removed: `checkSessionActivity` was a second, never-registered copy of the
// inactivity check. It had the same `iat` bug, nothing imported it, and
// authenticateToken owns the check now — one implementation, one place to fix.
// Exposed for tests: clear a user's activity clock.
export const resetActivityClock = (userId) => {
  if (userId === undefined) lastActivityAt.clear();
  else lastActivityAt.delete(userId);
};
