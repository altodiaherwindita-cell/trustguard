import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { pool } from '../index.js';

const router = Router();

// Get audit logs (Admin only)
router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { 
      userId, 
      action, 
      resourceType, 
      startDate, 
      endDate, 
      limit = 100, 
      offset = 0 
    } = req.query;

    let query = `
      SELECT al.*, u.email as user_email, u.full_name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    if (userId) {
      query += ` AND al.user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    if (action) {
      query += ` AND al.action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }

    if (resourceType) {
      query += ` AND al.resource_type = $${paramIndex}`;
      params.push(resourceType);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND al.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND al.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM audit_logs WHERE 1=1`;
    const countParams = [];
    let countIndex = 1;

    if (userId) {
      countQuery += ` AND user_id = $${countIndex}`;
      countParams.push(userId);
      countIndex++;
    }
    if (action) {
      countQuery += ` AND action = $${countIndex}`;
      countParams.push(action);
      countIndex++;
    }
    if (resourceType) {
      countQuery += ` AND resource_type = $${countIndex}`;
      countParams.push(resourceType);
      countIndex++;
    }
    if (startDate) {
      countQuery += ` AND created_at >= $${countIndex}`;
      countParams.push(startDate);
      countIndex++;
    }
    if (endDate) {
      countQuery += ` AND created_at <= $${countIndex}`;
      countParams.push(endDate);
      countIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);

    res.json({ 
      logs: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

// Get audit logs for a specific user (Admin or self)
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if admin or requesting own logs
    if (req.userRole !== 'admin' && req.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { limit = 100, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT * FROM audit_logs 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit), parseInt(offset)]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM audit_logs WHERE user_id = $1`,
      [userId]
    );

    res.json({ 
      logs: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get user audit logs error:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

// Export audit logs (Admin only)
router.get('/export', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;

    let query = `
      SELECT al.*, u.email as user_email, u.full_name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND al.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND al.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` ORDER BY al.created_at ASC`;

    const result = await pool.query(query, params);

    if (format === 'csv') {
      // Generate CSV
      const logs = result.rows;
      const headers = ['id', 'user_id', 'user_email', 'user_name', 'action', 'resource_type', 
                       'resource_id', 'resource_name', 'ip_address', 'created_at'];
      
      const csvRows = [headers.join(',')];
      
      logs.forEach(log => {
        const row = headers.map(h => {
          const val = log[h];
          if (val === null || val === undefined) return '';
          return `"${String(val).replace(/"/g, '""')}"`;
        });
        csvRows.push(row.join(','));
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString()}.csv"`);
      res.send(csvRows.join('\n'));
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString()}.json"`);
      res.json(result.rows);
    }
  } catch (error) {
    console.error('Export audit logs error:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

// Get audit statistics (Admin only)
router.get('/stats', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const daysInt = parseInt(days);

    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_actions,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT resource_type) as resource_types,
        MODE() WITHIN GROUP (ORDER BY action) as most_common_action
      FROM audit_logs
      WHERE created_at >= NOW() - INTERVAL '${daysInt} days'
    `);

    const actionsBreakdown = await pool.query(`
      SELECT action, COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= NOW() - INTERVAL '${daysInt} days'
      GROUP BY action
      ORDER BY count DESC
      LIMIT 10
    `);

    const resourcesBreakdown = await pool.query(`
      SELECT resource_type, COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= NOW() - INTERVAL '${daysInt} days'
      GROUP BY resource_type
      ORDER BY count DESC
    `);

    res.json({
      summary: stats.rows[0],
      topActions: actionsBreakdown.rows,
      resourcesBreakdown: resourcesBreakdown.rows
    });
  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({ error: 'Failed to get audit statistics' });
  }
});

export default router;
