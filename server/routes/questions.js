import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { pool } from '../db.js';
import { randomUUID } from 'crypto';

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

// Create question (TPRM only)
router.post('/', authenticateToken, requireRole('admin', 'tprm_analyst'), async (req, res) => {
  try {
    const { category, question, type, options, weight, risk_impact, display_order } = req.body;

    if (!category || !question || !type) {
      return res.status(400).json({ error: 'category, question, and type are required' });
    }

    // questions.id is a TEXT primary key with no default, and the client sends an
    // empty string on create, so mint the id here.
    const result = await pool.query(
      `INSERT INTO questions (id, category, question, type, options, weight, risk_impact, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        `q-${randomUUID()}`,
        category,
        question,
        type,
        options ? JSON.stringify(options) : null,
        weight ?? 5,
        risk_impact || 'medium',
        display_order ?? 0
      ]
    );

    res.status(201).json({ data: result.rows[0], message: 'Question created successfully' });
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({ error: 'Failed to create question' });
  }
});

// Update question (TPRM only)
router.put('/:id', authenticateToken, requireRole('admin', 'tprm_analyst'), async (req, res) => {
  try {
    const { category, question, type, options, weight, risk_impact, display_order } = req.body;

    if (!category || !question || !type) {
      return res.status(400).json({ error: 'category, question, and type are required' });
    }

    // Direct assignment, not COALESCE: the client sends the whole form on every
    // save, so a null `options` means "this question has no options now"
    // (e.g. switched to boolean) rather than "leave it alone".
    const result = await pool.query(
      `UPDATE questions
       SET category = $1,
           question = $2,
           type = $3,
           options = $4,
           weight = $5,
           risk_impact = $6,
           display_order = $7
       WHERE id = $8
       RETURNING *`,
      [
        category,
        question,
        type,
        options ? JSON.stringify(options) : null,
        weight ?? 5,
        risk_impact || 'medium',
        display_order ?? 0,
        req.params.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json({ data: result.rows[0], message: 'Question updated successfully' });
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// Delete question (TPRM only)
router.delete('/:id', authenticateToken, requireRole('admin', 'tprm_analyst'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM questions WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

export default router;
