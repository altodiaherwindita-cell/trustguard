import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Email transporter configuration
let transporter = null;

/**
 * Initialize email transporter with SMTP settings
 */
export function initializeEmailTransporter() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpSecure = process.env.SMTP_SECURE === 'true';
  
  if (!smtpHost || !smtpUser || !smtpPassword) {
    console.warn('Email not configured: SMTP_HOST, SMTP_USER, or SMTP_PASSWORD missing. Email notifications will be logged but not sent.');
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      tls: {
        rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false',
      },
    });

    // Verify connection configuration
    transporter.verify((error, success) => {
      if (error) {
        console.error('SMTP verification failed:', error.message);
      } else {
        console.log('SMTP server connected successfully. Ready to send messages.');
      }
    });

    return transporter;
  } catch (error) {
    console.error('Failed to initialize email transporter:', error.message);
    return null;
  }
}

/**
 * Send email using configured SMTP server
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body content
 * @param {string} [options.text] - Plain text body (optional, will be generated from HTML if not provided)
 * @param {string} [options.from] - Sender email (uses default from env if not provided)
 * @returns {Promise<Object>} - Send result
 */
export async function sendEmail({ to, subject, html, text, from }) {
  if (!transporter) {
    console.warn('Email transporter not initialized. Email not sent.');
    return { 
      success: false, 
      message: 'Email service not configured',
      logged: true 
    };
  }

  const defaultFrom = process.env.SMTP_FROM || 'TrustGuard Platform <noreply@trustguard.ai>';

  try {
    const info = await transporter.sendMail({
      from: from || defaultFrom,
      to,
      subject,
      html,
      text: text || generatePlainText(html),
    });

    console.log('Email sent successfully:', info.messageId);
    return { 
      success: true, 
      messageId: info.messageId,
      logged: false 
    };
  } catch (error) {
    console.error('Failed to send email:', error.message);
    return { 
      success: false, 
      error: error.message,
      logged: true 
    };
  }
}

/**
 * Generate plain text version from HTML
 * Simple implementation - strips HTML tags
 */
function generatePlainText(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Send assessment invitation email
 */
export async function sendAssessmentInvitation(vendorEmail, vendorName, assessmentLink, expiryDate) {
  const subject = 'Security Assessment Invitation - TrustGuard Platform';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1e40af; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9fafb; }
        .button { display: inline-block; padding: 12px 24px; background: #1e40af; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .info-box { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>TrustGuard AI</h1>
          <p>Third Party Security Assessment Platform</p>
        </div>
        <div class="content">
          <h2>Security Assessment Invitation</h2>
          <p>Dear ${vendorName},</p>
          <p>You have been invited to complete a security assessment through the TrustGuard AI platform.</p>
          
          <div class="info-box">
            <strong>Important Information:</strong>
            <ul>
              <li>This assessment evaluates your organization's security practices</li>
              <li>Please complete all sections of the questionnaire</li>
              <li>You may upload supporting evidence documents</li>
              <li>The assessment must be completed before the expiry date</li>
            </ul>
          </div>
          
          <p style="text-align: center;">
            <a href="${assessmentLink}" class="button">Start Assessment</a>
          </p>
          
          <p><strong>Expiry Date:</strong> ${new Date(expiryDate).toLocaleDateString()}</p>
          <p>If you have any questions or need assistance, please contact our support team.</p>
          
          <p>Best regards,<br/>TrustGuard AI Team</p>
        </div>
        <div class="footer">
          <p>This is an automated message from TrustGuard AI Platform.</p>
          <p>&copy; ${new Date().getFullYear()} TrustGuard AI. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: vendorEmail,
    subject,
    html,
  });
}

/**
 * Send assessment due reminder email
 */
export async function sendAssessmentDueReminder(vendorEmail, vendorName, assessmentName, dueDate) {
  const subject = `Reminder: Assessment Due Soon - ${assessmentName}`;
  
  const daysUntilDue = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9fafb; }
        .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; }
        .button { display: inline-block; padding: 12px 24px; background: #f59e0b; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⏰ Assessment Reminder</h1>
        </div>
        <div class="content">
          <p>Dear ${vendorName},</p>
          
          <div class="warning-box">
            <strong>Assessment Due Soon!</strong><br/>
            Your assessment "${assessmentName}" is due in <strong>${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}</strong>.
          </div>
          
          <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
          
          <p>Please complete your assessment at your earliest convenience to avoid any delays in the approval process.</p>
          
          <p style="text-align: center;">
            <a href="#" class="button">Complete Assessment</a>
          </p>
          
          <p>If you've already completed this assessment, please disregard this reminder.</p>
          
          <p>Best regards,<br/>TrustGuard AI Team</p>
        </div>
        <div class="footer">
          <p>This is an automated reminder from TrustGuard AI Platform.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: vendorEmail,
    subject,
    html,
  });
}

/**
 * Send assessment expiry warning email
 */
export async function sendAssessmentExpiryWarning(vendorEmail, vendorName, assessmentName, expiryDate) {
  const subject = `Urgent: Assessment Expiring Soon - ${assessmentName}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9fafb; }
        .urgent-box { background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; }
        .button { display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ Urgent: Assessment Expiring</h1>
        </div>
        <div class="content">
          <p>Dear ${vendorName},</p>
          
          <div class="urgent-box">
            <strong>Assessment Expiring Soon!</strong><br/>
            Your assessment "${assessmentName}" will expire on <strong>${new Date(expiryDate).toLocaleDateString()}</strong>.
          </div>
          
          <p>Please complete and submit your assessment immediately to avoid having to restart the process.</p>
          
          <p style="text-align: center;">
            <a href="#" class="button">Complete Assessment Now</a>
          </p>
          
          <p>If you need more time or have questions, please contact us immediately.</p>
          
          <p>Best regards,<br/>TrustGuard AI Team</p>
        </div>
        <div class="footer">
          <p>This is an urgent notification from TrustGuard AI Platform.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: vendorEmail,
    subject,
    html,
  });
}

/**
 * Send revision request notification
 */
export async function sendRevisionRequest(vendorEmail, vendorName, assessmentName, reviewerComments) {
  const subject = `Revision Requested: ${assessmentName}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #7c3aed; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9fafb; }
        .comments-box { background: white; border: 1px solid #e5e7eb; padding: 15px; margin: 15px 0; border-radius: 6px; }
        .button { display: inline-block; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📝 Revision Requested</h1>
        </div>
        <div class="content">
          <p>Dear ${vendorName},</p>
          
          <p>Your assessment "${assessmentName}" has been reviewed and requires revisions before it can be approved.</p>
          
          <div class="comments-box">
            <strong>Reviewer Comments:</strong>
            <p style="margin-top: 10px; white-space: pre-wrap;">${reviewerComments}</p>
          </div>
          
          <p>Please review the comments above and update your assessment accordingly.</p>
          
          <p style="text-align: center;">
            <a href="#" class="button">View & Update Assessment</a>
          </p>
          
          <p>If you have questions about the requested revisions, please don't hesitate to reach out.</p>
          
          <p>Best regards,<br/>TrustGuard AI Team</p>
        </div>
        <div class="footer">
          <p>This is an automated notification from TrustGuard AI Platform.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: vendorEmail,
    subject,
    html,
  });
}

/**
 * Send approval/rejection notification
 */
export async function sendApprovalNotification(vendorEmail, vendorName, assessmentName, status, reviewerComments) {
  const isSuccess = status === 'approved';
  const headerColor = isSuccess ? '#059669' : '#dc2626';
  const buttonColor = isSuccess ? '#059669' : '#dc2626';
  const icon = isSuccess ? '✅' : '❌';
  const actionText = isSuccess ? 'Approved' : 'Rejected';
  
  const subject = `${actionText}: ${assessmentName}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${headerColor}; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9fafb; }
        .status-box { background: ${isSuccess ? '#d1fae5' : '#fee2e2'}; border-left: 4px solid ${headerColor}; padding: 15px; margin: 15px 0; }
        .comments-box { background: white; border: 1px solid #e5e7eb; padding: 15px; margin: 15px 0; border-radius: 6px; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${icon} Assessment ${actionText}</h1>
        </div>
        <div class="content">
          <p>Dear ${vendorName},</p>
          
          <div class="status-box">
            <strong>Your assessment "${assessmentName}" has been ${status}.</strong>
          </div>
          
          ${reviewerComments ? `
          <div class="comments-box">
            <strong>Reviewer Comments:</strong>
            <p style="margin-top: 10px; white-space: pre-wrap;">${reviewerComments}</p>
          </div>
          ` : ''}
          
          ${isSuccess ? 
            '<p>Congratulations! Your assessment has been successfully approved.</p>' : 
            '<p>Please review the comments above and work with your team to address the identified concerns.</p>'
          }
          
          <p>Best regards,<br/>TrustGuard AI Team</p>
        </div>
        <div class="footer">
          <p>This is an automated notification from TrustGuard AI Platform.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: vendorEmail,
    subject,
    html,
  });
}

/**
 * Send remediation due reminder
 */
export async function sendRemediationDueReminder(userEmail, userName, remediationTitle, dueDate) {
  const subject = `Reminder: Remediation Item Due - ${remediationTitle}`;
  
  const daysUntilDue = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ea580c; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background: #f9fafb; }
        .reminder-box { background: #ffedd5; border-left: 4px solid #ea580c; padding: 15px; margin: 15px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📋 Remediation Reminder</h1>
        </div>
        <div class="content">
          <p>Hi ${userName},</p>
          
          <div class="reminder-box">
            <strong>Remediation Item Due Soon</strong><br/>
            "${remediationTitle}" is due in <strong>${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}</strong>.
          </div>
          
          <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
          
          <p>Please ensure this remediation item is completed and documented by the due date.</p>
          
          <p>Best regards,<br/>TrustGuard AI Team</p>
        </div>
        <div class="footer">
          <p>This is an automated reminder from TrustGuard AI Platform.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: userEmail,
    subject,
    html,
  });
}

// Initialize transporter when module loads
initializeEmailTransporter();

export default {
  sendEmail,
  sendAssessmentInvitation,
  sendAssessmentDueReminder,
  sendAssessmentExpiryWarning,
  sendRevisionRequest,
  sendApprovalNotification,
  sendRemediationDueReminder,
  initializeEmailTransporter,
};
