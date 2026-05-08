import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../index.js';

const router = Router();

// Get all questions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM questions ORDER BY display_order ASC'
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ error: 'Failed to get questions' });
  }
});

export default router;
