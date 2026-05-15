import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { pool } from '../index.js';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

const router = Router();

// Generate PDF report for an assessment
router.get('/assessment/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const assessmentId = req.params.id;

    // Get assessment data
    const assessmentResult = await pool.query(
      `SELECT a.*, v.name as vendor_name, v.industry, v.contact_email
       FROM assessments a
       JOIN vendors v ON a.vendor_id = v.id
       WHERE a.id = $1`,
      [assessmentId]
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

    // Get responses with questions
    const responsesResult = await pool.query(
      `SELECT ar.answer, q.question, q.category, q.type
       FROM assessment_responses ar
       JOIN questions q ON ar.question_id = q.id
       WHERE ar.assessment_id = $1
       ORDER BY q.display_order`,
      [assessmentId]
    );

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="assessment-${assessmentId}.pdf"`);
    
    doc.pipe(res);

    // Header
    doc.fontSize(24).text('TrustGuard AI', { align: 'center' });
    doc.moveDown();
    doc.fontSize(18).text('Third Party Security Assessment Report', { align: 'center' });
    doc.moveDown(2);

    // Assessment Info
    doc.fontSize(14).text('Assessment Information', { underline: true });
    doc.moveDown();
    doc.fontSize(11);
    doc.text(`Vendor: ${assessment.vendor_name}`);
    doc.text(`Industry: ${assessment.industry || 'N/A'}`);
    doc.text(`Assessment ID: ${assessmentId}`);
    doc.text(`Status: ${assessment.status}`);
    doc.text(`Created: ${new Date(assessment.created_at).toLocaleDateString()}`);
    if (assessment.submitted_at) {
      doc.text(`Submitted: ${new Date(assessment.submitted_at).toLocaleDateString()}`);
    }
    if (assessment.reviewed_at) {
      doc.text(`Reviewed: ${new Date(assessment.reviewed_at).toLocaleDateString()}`);
    }
    doc.moveDown();

    // Risk Score Summary
    if (assessment.risk_score !== null) {
      doc.fontSize(14).text('Risk Assessment Summary', { underline: true });
      doc.moveDown();
      doc.fontSize(11);
      doc.text(`Overall Risk Score: ${assessment.risk_score}/100`);
      doc.text(`Risk Level: ${assessment.risk_level || 'Not assessed'}`);
      doc.text(`Overall Score: ${assessment.overall_score || 'N/A'}%`);
      doc.moveDown();
    }

    // Strengths
    if (assessment.strengths && Array.isArray(JSON.parse(assessment.strengths))) {
      const strengths = JSON.parse(assessment.strengths);
      if (strengths.length > 0) {
        doc.fontSize(14).text('Strengths', { underline: true });
        doc.moveDown();
        doc.fontSize(11);
        strengths.forEach(s => {
          doc.text(`• ${s}`, { bulletIndent: 10 });
        });
        doc.moveDown();
      }
    }

    // Weaknesses
    if (assessment.weaknesses && Array.isArray(JSON.parse(assessment.weaknesses))) {
      const weaknesses = JSON.parse(assessment.weaknesses);
      if (weaknesses.length > 0) {
        doc.fontSize(14).text('Areas for Improvement', { underline: true });
        doc.moveDown();
        doc.fontSize(11);
        weaknesses.forEach(w => {
          doc.text(`• ${w}`, { bulletIndent: 10 });
        });
        doc.moveDown();
      }
    }

    // Recommendations
    if (assessment.recommendations && Array.isArray(JSON.parse(assessment.recommendations))) {
      const recommendations = JSON.parse(assessment.recommendations);
      if (recommendations.length > 0) {
        doc.fontSize(14).text('Recommendations', { underline: true });
        doc.moveDown();
        doc.fontSize(11);
        recommendations.forEach(r => {
          doc.text(`• ${r}`, { bulletIndent: 10 });
        });
        doc.moveDown();
      }
    }

    // Question Responses by Category
    doc.fontSize(14).text('Detailed Responses', { underline: true });
    doc.moveDown();

    const categories = {};
    responsesResult.rows.forEach(row => {
      if (!categories[row.category]) {
        categories[row.category] = [];
      }
      categories[row.category].push(row);
    });

    Object.entries(categories).forEach(([category, questions]) => {
      doc.fontSize(12).text(category, { bold: true });
      doc.moveDown(0.5);
      
      questions.forEach((q, index) => {
        doc.fontSize(11).text(`${index + 1}. ${q.question}`, { bold: true });
        
        let answerText = 'No response';
        if (q.answer) {
          const answer = typeof q.answer === 'string' ? JSON.parse(q.answer) : q.answer;
          if (Array.isArray(answer)) {
            answerText = answer.join(', ');
          } else if (typeof answer === 'boolean') {
            answerText = answer ? 'Yes' : 'No';
          } else {
            answerText = String(answer);
          }
        }
        
        doc.text(`Answer: ${answerText}`);
        doc.moveDown(0.5);
      });
      
      doc.moveDown();
    });

    // Footer
    doc.moveDown(2);
    doc.fontSize(10).text('Generated by TrustGuard AI Platform', { align: 'center' });
    doc.text(`Report generated on ${new Date().toLocaleString()}`, { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
});

// Generate Excel report for an assessment
router.get('/assessment/:id/excel', authenticateToken, async (req, res) => {
  try {
    const assessmentId = req.params.id;

    // Get assessment data
    const assessmentResult = await pool.query(
      `SELECT a.*, v.name as vendor_name, v.industry, v.contact_email
       FROM assessments a
       JOIN vendors v ON a.vendor_id = v.id
       WHERE a.id = $1`,
      [assessmentId]
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

    // Get responses with questions
    const responsesResult = await pool.query(
      `SELECT ar.answer, q.id as question_id, q.question, q.category, q.type, q.weight, q.risk_impact, q.display_order
       FROM assessment_responses ar
       JOIN questions q ON ar.question_id = q.id
       WHERE ar.assessment_id = $1
       ORDER BY q.display_order`,
      [assessmentId]
    );

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TrustGuard AI';
    workbook.created = new Date();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    
    summarySheet.columns = [
      { header: 'Field', key: 'field', width: 25 },
      { header: 'Value', key: 'value', width: 40 }
    ];

    summarySheet.addRow({ field: 'Vendor Name', value: assessment.vendor_name });
    summarySheet.addRow({ field: 'Industry', value: assessment.industry || 'N/A' });
    summarySheet.addRow({ field: 'Assessment ID', value: assessmentId });
    summarySheet.addRow({ field: 'Status', value: assessment.status });
    summarySheet.addRow({ field: 'Created Date', value: new Date(assessment.created_at).toLocaleDateString() });
    summarySheet.addRow({ field: 'Submitted Date', value: assessment.submitted_at ? new Date(assessment.submitted_at).toLocaleDateString() : 'N/A' });
    summarySheet.addRow({ field: 'Reviewed Date', value: assessment.reviewed_at ? new Date(assessment.reviewed_at).toLocaleDateString() : 'N/A' });
    summarySheet.addRow({ field: 'Risk Score', value: assessment.risk_score || 'N/A' });
    summarySheet.addRow({ field: 'Risk Level', value: assessment.risk_level || 'N/A' });
    summarySheet.addRow({ field: 'Overall Score', value: `${assessment.overall_score || 'N/A'}%` });

    // Add strengths
    if (assessment.strengths) {
      const strengths = JSON.parse(assessment.strengths);
      if (Array.isArray(strengths) && strengths.length > 0) {
        summarySheet.addRow({ field: 'Strengths', value: strengths.join('; ') });
      }
    }

    // Add weaknesses
    if (assessment.weaknesses) {
      const weaknesses = JSON.parse(assessment.weaknesses);
      if (Array.isArray(weaknesses) && weaknesses.length > 0) {
        summarySheet.addRow({ field: 'Weaknesses', value: weaknesses.join('; ') });
      }
    }

    // Add recommendations
    if (assessment.recommendations) {
      const recommendations = JSON.parse(assessment.recommendations);
      if (Array.isArray(recommendations) && recommendations.length > 0) {
        summarySheet.addRow({ field: 'Recommendations', value: recommendations.join('; ') });
      }
    }

    // Style header row
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' }
    };
    summarySheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Detailed Responses Sheet
    const responsesSheet = workbook.addWorksheet('Responses');
    
    responsesSheet.columns = [
      { header: 'Order', key: 'order', width: 10 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Question', key: 'question', width: 60 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Weight', key: 'weight', width: 10 },
      { header: 'Risk Impact', key: 'risk_impact', width: 15 },
      { header: 'Answer', key: 'answer', width: 40 }
    ];

    responsesResult.rows.forEach((row, index) => {
      let answerText = 'No response';
      if (row.answer) {
        const answer = typeof row.answer === 'string' ? JSON.parse(row.answer) : row.answer;
        if (Array.isArray(answer)) {
          answerText = answer.join(', ');
        } else if (typeof answer === 'boolean') {
          answerText = answer ? 'Yes' : 'No';
        } else {
          answerText = String(answer);
        }
      }

      responsesSheet.addRow({
        order: index + 1,
        category: row.category,
        question: row.question,
        type: row.type,
        weight: row.weight,
        risk_impact: row.risk_impact,
        answer: answerText
      });
    });

    // Style header row
    responsesSheet.getRow(1).font = { bold: true };
    responsesSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' }
    };
    responsesSheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Auto-filter
    responsesSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 7 }
    };

    // Write to response
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="assessment-${assessmentId}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Generate Excel error:', error);
    res.status(500).json({ error: 'Failed to generate Excel report' });
  }
});

// Generate vendor risk summary report (Excel)
router.get('/vendors/summary/excel', authenticateToken, requireRole('admin', 'tprm_analyst'), async (req, res) => {
  try {
    // Get all vendors with their latest assessment data
    const vendorsResult = await pool.query(
      `SELECT v.*, 
              a.status as latest_status,
              a.risk_score,
              a.risk_level,
              a.created_at as last_assessment_date,
              u.email as owner_email
       FROM vendors v
       LEFT JOIN LATERAL (
         SELECT * FROM assessments 
         WHERE vendor_id = v.id 
         ORDER BY created_at DESC 
         LIMIT 1
       ) a ON true
       LEFT JOIN users u ON v.owner_user_id = u.id
       ORDER BY v.name`
    );

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TrustGuard AI';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('Vendor Risk Summary');
    
    summarySheet.columns = [
      { header: 'Vendor Name', key: 'name', width: 30 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Industry', key: 'industry', width: 25 },
      { header: 'Contact Email', key: 'contact_email', width: 30 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Latest Assessment Status', key: 'latest_status', width: 20 },
      { header: 'Risk Score', key: 'risk_score', width: 15 },
      { header: 'Risk Level', key: 'risk_level', width: 15 },
      { header: 'Last Assessment Date', key: 'last_assessment_date', width: 20 },
      { header: 'Owner Email', key: 'owner_email', width: 30 }
    ];

    vendorsResult.rows.forEach(vendor => {
      summarySheet.addRow({
        name: vendor.name,
        category: vendor.category,
        industry: vendor.industry || 'N/A',
        contact_email: vendor.contact_email,
        status: vendor.status,
        latest_status: vendor.latest_status || 'No assessment',
        risk_score: vendor.risk_score || 'N/A',
        risk_level: vendor.risk_level || 'N/A',
        last_assessment_date: vendor.last_assessment_date ? new Date(vendor.last_assessment_date).toLocaleDateString() : 'Never',
        owner_email: vendor.owner_email || 'N/A'
      });
    });

    // Style header row
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' }
    };
    summarySheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

    // Add conditional formatting for risk levels
    summarySheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const riskLevel = row.getCell(8).value;
        let color;
        switch (riskLevel) {
          case 'Critical': color = 'FFFF0000'; break;
          case 'High': color = 'FFFFA500'; break;
          case 'Medium': color = 'FFFFFF00'; break;
          case 'Low': color = 'FF00FF00'; break;
          default: color = 'FFFFFFFF';
        }
        row.getCell(8).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: color }
        };
      }
    });

    // Auto-filter
    summarySheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 10 }
    };

    // Write to response
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="vendor-risk-summary-${new Date().toISOString().split('T')[0]}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Generate vendor summary error:', error);
    res.status(500).json({ error: 'Failed to generate vendor summary report' });
  }
});

export default router;
