import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { pool } from '../db.js';
import { calculateRiskScore } from '../services/riskScoring.js';

const router = Router();

// Roll the newest score up onto the vendor row. `vendors.current_risk_score` /
// `current_risk_level` are what the dashboard distribution and the vendors table
// read, and nothing else ever wrote them — every widget rendered "Not assessed"
// no matter how many assessments were scored. Best-effort: a failed rollup must
// not fail the submit or review that already succeeded.
// ponytail: an upsert-safe single UPDATE, no trigger, no history table. Move the
// rollup into a trigger if vendors ever need score history.
async function rollUpVendorRisk(vendorId) {
  if (!vendorId) return;
  try {
    await pool.query(
      `UPDATE vendors v
       SET current_risk_score = a.risk_score,
           current_risk_level = a.risk_level,
           last_assessment_at = COALESCE(a.submitted_at, a.reviewed_at, now())
       FROM assessments a
       WHERE v.id = $1
         AND a.vendor_id = v.id
         AND a.risk_score IS NOT NULL
         AND a.id = (
           SELECT id FROM assessments
           WHERE vendor_id = $1 AND risk_score IS NOT NULL
           ORDER BY COALESCE(submitted_at, created_at) DESC
           LIMIT 1
         )`,
      [vendorId]
    );
  } catch (error) {
    console.error('Vendor risk rollup error:', error);
  }
}

// Get all assessments (TPRM only)
router.get('/', authenticateToken, requireRole('admin', 'tprm_analyst'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, v.name as vendor_name, v.contact_email as vendor_email
       FROM assessments a
       JOIN vendors v ON a.vendor_id = v.id
       ORDER BY a.created_at DESC`
    );

    res.json({ assessments: result.rows });
  } catch (error) {
    console.error('Get assessments error:', error);
    res.status(500).json({ error: 'Failed to get assessments' });
  }
});

// Get my assessments (vendor users)
router.get('/my-assessments', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, v.name as vendor_name
       FROM assessments a
       JOIN vendors v ON a.vendor_id = v.id
       WHERE v.owner_user_id = $1
       ORDER BY a.created_at DESC`,
      [req.userId]
    );

    res.json({ assessments: result.rows });
  } catch (error) {
    console.error('Get my assessments error:', error);
    res.status(500).json({ error: 'Failed to get assessments' });
  }
});

// Get assessment by ID with responses
router.get('/:id/details', authenticateToken, async (req, res) => {
  try {
    const assessmentResult = await pool.query(
      `SELECT a.*, v.name as vendor_name, v.contact_email as vendor_email
       FROM assessments a
       JOIN vendors v ON a.vendor_id = v.id
       WHERE a.id = $1`,
      [req.params.id]
    );

    if (assessmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const assessment = assessmentResult.rows[0];

    // Check permissions
    const vendorResult = await pool.query('SELECT owner_user_id FROM vendors WHERE id = $1', [assessment.vendor_id]);
    const isOwner = vendorResult.rows[0].owner_user_id === req.userId;
    const hasTPRMRole = req.userRole === 'admin' || req.userRole === 'tprm_analyst';

    if (!isOwner && !hasTPRMRole) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get responses
    const responsesResult = await pool.query(
      'SELECT * FROM assessment_responses WHERE assessment_id = $1',
      [req.params.id]
    );

    res.json({
      assessment,
      responses: responsesResult.rows
    });
  } catch (error) {
    console.error('Get assessment details error:', error);
    res.status(500).json({ error: 'Failed to get assessment details' });
  }
});

// Get assessment by ID (simple)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, v.name as vendor_name
       FROM assessments a
       JOIN vendors v ON a.vendor_id = v.id
       WHERE a.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const assessment = result.rows[0];

    // Check permissions
    const vendorResult = await pool.query('SELECT owner_user_id FROM vendors WHERE id = $1', [assessment.vendor_id]);
    const isOwner = vendorResult.rows[0].owner_user_id === req.userId;
    const hasTPRMRole = req.userRole === 'admin' || req.userRole === 'tprm_analyst';

    if (!isOwner && !hasTPRMRole) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ data: assessment });
  } catch (error) {
    console.error('Get assessment error:', error);
    res.status(500).json({ error: 'Failed to get assessment' });
  }
});

// Get responses for an assessment
router.get('/:id/responses', authenticateToken, async (req, res) => {
  try {
    const assessmentResult = await pool.query(
      `SELECT a.*, v.owner_user_id FROM assessments a
       JOIN vendors v ON a.vendor_id = v.id
       WHERE a.id = $1`,
      [req.params.id]
    );

    if (assessmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const assessment = assessmentResult.rows[0];
    const isOwner = assessment.owner_user_id === req.userId;
    const hasTPRMRole = req.userRole === 'admin' || req.userRole === 'tprm_analyst';

    if (!isOwner && !hasTPRMRole) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const responsesResult = await pool.query(
      'SELECT * FROM assessment_responses WHERE assessment_id = $1',
      [req.params.id]
    );

    res.json({ data: responsesResult.rows });
  } catch (error) {
    console.error('Get responses error:', error);
    res.status(500).json({ error: 'Failed to get responses' });
  }
});

// Create assessment (TPRM only)
router.post('/', authenticateToken, requireRole('admin', 'tprm_analyst'), async (req, res) => {
  try {
    // Accept both casings: the web client sends vendor_id, older callers vendorId.
    const vendorId = req.body.vendorId || req.body.vendor_id;

    if (!vendorId) {
      return res.status(400).json({ error: 'vendorId is required' });
    }

    const result = await pool.query(
      `INSERT INTO assessments (vendor_id, status)
       VALUES ($1, 'not-started')
       RETURNING *`,
      [vendorId]
    );

    res.status(201).json({ assessment: result.rows[0], message: 'Assessment created successfully' });
  } catch (error) {
    console.error('Create assessment error:', error);
    res.status(500).json({ error: 'Failed to create assessment' });
  }
});

// Submit/update responses
router.post('/:id/responses', authenticateToken, async (req, res) => {
  try {
    const assessmentId = req.params.id;
    // Web client sends question_id; older callers questionId.
    const questionId = req.body.questionId || req.body.question_id;
    const { answer } = req.body;

    if (!questionId) {
      return res.status(400).json({ error: 'questionId is required' });
    }

    // Verify ownership
    const checkResult = await pool.query(
      `SELECT v.owner_user_id FROM assessments a
       JOIN vendors v ON a.vendor_id = v.id
       WHERE a.id = $1`,
      [assessmentId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const isOwner = checkResult.rows[0].owner_user_id === req.userId;
    const hasTPRMRole = req.userRole === 'admin' || req.userRole === 'tprm_analyst';

    if (!isOwner && !hasTPRMRole) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Upsert response
    const result = await pool.query(
      `INSERT INTO assessment_responses (assessment_id, question_id, answer, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (assessment_id, question_id) 
       DO UPDATE SET answer = $3, updated_at = now()
       RETURNING *`,
      [assessmentId, questionId, JSON.stringify(answer)]
    );

    res.json({ response: result.rows[0], message: 'Response saved successfully' });
  } catch (error) {
    console.error('Save response error:', error);
    res.status(500).json({ error: 'Failed to save response' });
  }
});

// Submit assessment for review
router.post('/:id/submit', authenticateToken, async (req, res) => {
  try {
    const assessmentId = req.params.id;

    // Verify ownership
    const checkResult = await pool.query(
      `SELECT v.owner_user_id FROM assessments a
       JOIN vendors v ON a.vendor_id = v.id
       WHERE a.id = $1`,
      [assessmentId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const isOwner = checkResult.rows[0].owner_user_id === req.userId;
    // Same rule as the sibling /responses route: TPRM staff act on any assessment.
    const hasTPRMRole = req.userRole === 'admin' || req.userRole === 'tprm_analyst';

    if (!isOwner && !hasTPRMRole) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Score BEFORE marking submitted so a scoring failure can't leave a
    // submitted-but-unscored row.
    try {
      const questionsResult = await pool.query(
        'SELECT id, category, question, type, options, weight, risk_impact FROM questions ORDER BY display_order, id'
      );
      const responsesResult = await pool.query(
        'SELECT question_id, answer FROM assessment_responses WHERE assessment_id = $1',
        [assessmentId]
      );
      const answers = {};
      for (const r of responsesResult.rows) {
        answers[r.question_id] = r.answer;
      }
      const questions = questionsResult.rows.map((q) => ({ ...q, riskImpact: q.risk_impact }));
      const result = calculateRiskScore(questions, answers);

      const updated = await pool.query(
        `UPDATE assessments
         SET status = 'submitted',
             submitted_at = now(),
             risk_score = $2,
             risk_level = $3,
             overall_score = $4,
             category_scores = $5,
             question_scores = $6,
             strengths = $7,
             weaknesses = $8,
             recommendations = $9
         WHERE id = $1
         RETURNING *`,
        [
          assessmentId,
          result.riskScore,
          result.riskLevel,
          result.overallScore,
          JSON.stringify(result.categoryScores),
          JSON.stringify(result.questionScores),
          JSON.stringify(result.strengths),
          JSON.stringify(result.weaknesses),
          JSON.stringify(result.recommendations),
        ]
      );

      await rollUpVendorRisk(updated.rows[0].vendor_id);

      res.json({ assessment: updated.rows[0], message: 'Assessment submitted successfully' });
    } catch (scoringError) {
      console.error('Score assessment error:', scoringError);
      res.status(500).json({ error: 'Failed to score assessment' });
    }
  } catch (error) {
    console.error('Submit assessment error:', error);
    res.status(500).json({ error: 'Failed to submit assessment' });
  }
});

// Review assessment and add AI summary (TPRM only)
router.post('/:id/review', authenticateToken, requireRole('admin', 'tprm_analyst'), async (req, res) => {
  try {
    const assessmentId = req.params.id;
    const { riskScore, riskLevel, overallScore, aiSummary, strengths, weaknesses, recommendations, categoryScores, action, comments } = req.body;

    // Valid actions: approve, reject, request_revision
    const validActions = ['approve', 'reject', 'request_revision'];
    const reviewAction = action || 'approve';

    if (!validActions.includes(reviewAction)) {
      return res.status(400).json({ error: 'Invalid review action' });
    }

    let newStatus;
    switch (reviewAction) {
      case 'approve':
        newStatus = 'approved';
        break;
      case 'reject':
        newStatus = 'rejected';
        break;
      case 'request_revision':
        newStatus = 'revision-requested';
        break;
      default:
        newStatus = 'reviewed';
    }

    const result = await pool.query(
      `UPDATE assessments 
       SET status = $1,
           risk_score = COALESCE($2, risk_score),
           risk_level = COALESCE($3, risk_level),
           overall_score = COALESCE($4, overall_score),
           ai_summary = COALESCE($5, ai_summary),
           strengths = COALESCE($6, strengths),
           weaknesses = COALESCE($7, weaknesses),
           recommendations = COALESCE($8, recommendations),
           category_scores = COALESCE($9, category_scores),
           reviewed_at = now(),
           current_reviewer_id = $10
       WHERE id = $11
       RETURNING *`,
      [newStatus, riskScore, riskLevel, overallScore, aiSummary, JSON.stringify(strengths), JSON.stringify(weaknesses), JSON.stringify(recommendations), JSON.stringify(categoryScores), req.userId, assessmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Record review history
    await pool.query(
      `INSERT INTO assessment_review_history (assessment_id, reviewer_id, action, comments, risk_score_before, risk_score_after, risk_level_before, risk_level_after)
       SELECT $1, $2, $3, $4, a.risk_score, $5, a.risk_level, $6
       FROM assessments a WHERE a.id = $1`,
      [assessmentId, req.userId, reviewAction, comments, riskScore, riskLevel]
    );

    // If revision requested, get vendor email for notification
    if (reviewAction === 'request_revision') {
      const vendorResult = await pool.query(
        `SELECT v.contact_email, v.name as vendor_name 
         FROM assessments a 
         JOIN vendors v ON a.vendor_id = v.id 
         WHERE a.id = $1`,
        [assessmentId]
      );

      if (vendorResult.rows.length > 0) {
        const { contact_email, vendor_name } = vendorResult.rows[0];
        
        // Import email service and send revision request notification
        const { sendRevisionRequest } = await import('../services/emailService.js');
        await sendRevisionRequest(contact_email, vendor_name, `Assessment #${assessmentId}`, comments || 'Please revise and resubmit your assessment.');
      }
    } else if (reviewAction === 'approve' || reviewAction === 'reject') {
      const vendorResult = await pool.query(
        `SELECT v.contact_email, v.name as vendor_name 
         FROM assessments a 
         JOIN vendors v ON a.vendor_id = v.id 
         WHERE a.id = $1`,
        [assessmentId]
      );

      if (vendorResult.rows.length > 0) {
        const { contact_email, vendor_name } = vendorResult.rows[0];
        
        const { sendApprovalNotification } = await import('../services/emailService.js');
        await sendApprovalNotification(contact_email, vendor_name, `Assessment #${assessmentId}`, reviewAction, comments);
      }
    }

    await rollUpVendorRisk(result.rows[0].vendor_id);

    res.json({
      assessment: result.rows[0],
      message: `Assessment ${reviewAction.replace('_', ' ')} successfully`
    });
  } catch (error) {
    console.error('Review assessment error:', error);
    res.status(500).json({ error: 'Failed to review assessment' });
  }
});

// Get assessment reviews/history
router.get('/:id/reviews', authenticateToken, async (req, res) => {
  try {
    const assessmentId = req.params.id;

    // Check permissions
    const assessmentResult = await pool.query(
      `SELECT a.*, v.owner_user_id FROM assessments a
       JOIN vendors v ON a.vendor_id = v.id
       WHERE a.id = $1`,
      [assessmentId]
    );

    if (assessmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const assessment = assessmentResult.rows[0];
    const isOwner = assessment.owner_user_id === req.userId;
    const hasTPRMRole = req.userRole === 'admin' || req.userRole === 'tprm_analyst';

    if (!isOwner && !hasTPRMRole) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const reviewsResult = await pool.query(
      `SELECT rh.*, u.full_name as reviewer_name, u.email as reviewer_email
       FROM assessment_review_history rh
       LEFT JOIN users u ON rh.reviewer_id = u.id
       WHERE rh.assessment_id = $1
         AND (rh.is_internal = false OR $2 = true)
       ORDER BY rh.created_at DESC`,
      [assessmentId, hasTPRMRole]
    );

    res.json({ reviews: reviewsResult.rows });
  } catch (error) {
    console.error('Get assessment reviews error:', error);
    res.status(500).json({ error: 'Failed to get assessment reviews' });
  }
});

// Add reviewer comment
router.post('/:id/comments', authenticateToken, requireRole('admin', 'tprm_analyst'), async (req, res) => {
  try {
    const assessmentId = req.params.id;
    const { comment, isInternal = true } = req.body;

    if (!comment) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    const result = await pool.query(
      `INSERT INTO assessment_review_history (assessment_id, reviewer_id, action, comments, is_internal)
       VALUES ($1, $2, 'comment', $3, $4)
       RETURNING *`,
      [assessmentId, req.userId, comment, isInternal]
    );

    res.status(201).json({ 
      comment: result.rows[0], 
      message: 'Comment added successfully' 
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

export default router;
