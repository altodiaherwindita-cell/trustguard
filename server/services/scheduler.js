import cron from 'node-cron';
import { pool } from '../index.js';
import {
  sendAssessmentDueReminder,
  sendAssessmentExpiryWarning,
  sendRemediationDueReminder,
  sendEmail,
} from './emailService.js';

/**
 * Email Reminder Scheduler
 * Runs daily cron jobs to send automated reminders
 */

let scheduledJobs = [];

/**
 * Check for assessments due soon (within 7 days) and send reminders
 */
async function checkAssessmentDueReminders() {
  console.log('Running assessment due reminder check...');

  try {
    // Find assessments due within 7 days that are in progress or not started
    const result = await pool.query(`
      SELECT
        a.id as assessment_id,
        a.title,
        a.expiry_date,
        a.due_date,
        v.id as vendor_id,
        v.name as vendor_name,
        v.contact_email
      FROM assessments a
      JOIN vendors v ON a.vendor_id = v.id
      WHERE a.status IN ('not-started', 'in-progress')
        AND (a.due_date IS NOT NULL OR a.expiry_date IS NOT NULL)
        AND (
          (a.due_date IS NOT NULL AND a.due_date <= NOW() + INTERVAL '7 days' AND a.due_date > NOW())
          OR (a.expiry_date IS NOT NULL AND a.expiry_date <= NOW() + INTERVAL '7 days' AND a.expiry_date > NOW())
        )
    `);

    for (const assessment of result.rows) {
      const dueDate = assessment.due_date || assessment.expiry_date;
      const daysUntilDue = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));

      if (daysUntilDue > 0 && daysUntilDue <= 7) {
        // Check if reminder already sent for this period
        const reminderCheck = await pool.query(`
          SELECT id FROM notifications
          WHERE metadata->>'assessment_id' = $1
            AND type = 'email'
            AND status = 'sent'
            AND created_at > NOW() - INTERVAL '1 day'
        `, [assessment.assessment_id]);

        if (reminderCheck.rows.length === 0) {
          await sendAssessmentDueReminder(
            assessment.contact_email,
            assessment.vendor_name,
            assessment.title,
            dueDate
          );

          // Log notification
          await pool.query(`
            INSERT INTO notifications (user_id, recipient_email, type, subject, body, status, scheduled_at, sent_at, metadata)
            VALUES (NULL, $1, 'email', $2, $3, 'sent', NOW(), NOW(), $4)
          `, [
            assessment.contact_email,
            `Reminder: Assessment Due Soon - ${assessment.title}`,
            `Assessment "${assessment.title}" for ${assessment.vendor_name} is due in ${daysUntilDue} day(s).`,
            JSON.stringify({
              assessment_id: assessment.assessment_id,
              vendor_id: assessment.vendor_id,
              type: 'assessment_due_reminder'
            })
          ]);
        }
      }
    }

    console.log(`Processed ${result.rows.length} assessments for due reminders`);
  } catch (error) {
    console.error('Error in assessment due reminder check:', error);
  }
}

/**
 * Check for assessments expiring soon (within 3 days) and send urgent warnings
 */
async function checkAssessmentExpiryWarnings() {
  console.log('Running assessment expiry warning check...');

  try {
    const result = await pool.query(`
      SELECT
        a.id as assessment_id,
        a.title,
        a.expiry_date,
        v.id as vendor_id,
        v.name as vendor_name,
        v.contact_email
      FROM assessments a
      JOIN vendors v ON a.vendor_id = v.id
      WHERE a.status IN ('not-started', 'in-progress', 'submitted')
        AND a.expiry_date IS NOT NULL
        AND a.expiry_date <= NOW() + INTERVAL '3 days'
        AND a.expiry_date > NOW()
    `);

    for (const assessment of result.rows) {
      const daysUntilExpiry = Math.ceil((new Date(assessment.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry > 0 && daysUntilExpiry <= 3) {
        // Check if warning already sent today
        const warningCheck = await pool.query(`
          SELECT id FROM notifications
          WHERE metadata->>'assessment_id' = $1
            AND type = 'email'
            AND status = 'sent'
            AND body ILIKE '%expiring%'
            AND created_at > NOW() - INTERVAL '1 day'
        `, [assessment.assessment_id]);

        if (warningCheck.rows.length === 0) {
          await sendAssessmentExpiryWarning(
            assessment.contact_email,
            assessment.vendor_name,
            assessment.title,
            assessment.expiry_date
          );

          // Log notification
          await pool.query(`
            INSERT INTO notifications (user_id, recipient_email, type, subject, body, status, scheduled_at, sent_at, metadata)
            VALUES (NULL, $1, 'email', $2, $3, 'sent', NOW(), NOW(), $4)
          `, [
            assessment.contact_email,
            `Urgent: Assessment Expiring Soon - ${assessment.title}`,
            `Assessment "${assessment.title}" for ${assessment.vendor_name} will expire in ${daysUntilExpiry} day(s).`,
            JSON.stringify({
              assessment_id: assessment.assessment_id,
              vendor_id: assessment.vendor_id,
              type: 'assessment_expiry_warning'
            })
          ]);
        }
      }
    }

    console.log(`Processed ${result.rows.length} assessments for expiry warnings`);
  } catch (error) {
    console.error('Error in assessment expiry warning check:', error);
  }
}

/**
 * Check for remediation items due soon and send reminders to assignees
 */
async function checkRemediationDueReminders() {
  console.log('Running remediation due reminder check...');

  try {
    const result = await pool.query(`
      SELECT
        r.id as remediation_id,
        r.title,
        r.due_date,
        r.assigned_to,
        r.assigned_to_email,
        v.name as vendor_name
      FROM remediation_items r
      JOIN vendors v ON r.vendor_id = v.id
      WHERE r.status IN ('open', 'in_progress')
        AND r.due_date IS NOT NULL
        AND r.due_date <= NOW() + INTERVAL '7 days'
        AND r.due_date > NOW()
        AND r.assigned_to IS NOT NULL
    `);

    for (const remediation of result.rows) {
      const daysUntilDue = Math.ceil((new Date(remediation.due_date) - new Date()) / (1000 * 60 * 60 * 24));

      if (daysUntilDue > 0 && daysUntilDue <= 7) {
        // Check if reminder already sent today
        const reminderCheck = await pool.query(`
          SELECT id FROM notifications
          WHERE metadata->>'remediation_id' = $1
            AND type = 'email'
            AND status = 'sent'
            AND created_at > NOW() - INTERVAL '1 day'
        `, [remediation.remediation_id]);

        if (reminderCheck.rows.length === 0 && remediation.assigned_to_email) {
          await sendRemediationDueReminder(
            remediation.assigned_to_email,
            'Team Member', // We'd ideally get the name from users table
            remediation.title,
            remediation.due_date
          );

          // Log notification
          await pool.query(`
            INSERT INTO notifications (user_id, recipient_email, type, subject, body, status, scheduled_at, sent_at, metadata)
            VALUES ($1, $2, 'email', $3, $4, 'sent', NOW(), NOW(), $5)
          `, [
            remediation.assigned_to,
            remediation.assigned_to_email,
            `Reminder: Remediation Item Due - ${remediation.title}`,
            `Remediation item "${remediation.title}" for ${remediation.vendor_name} is due in ${daysUntilDue} day(s).`,
            JSON.stringify({
              remediation_id: remediation.remediation_id,
              vendor_id: remediation.vendor_id,
              type: 'remediation_due_reminder'
            })
          ]);
        }
      }
    }

    console.log(`Processed ${result.rows.length} remediation items for due reminders`);
  } catch (error) {
    console.error('Error in remediation due reminder check:', error);
  }
}

/**
 * Check for vendors with upcoming assessment due dates (based on assessment_frequency_months)
 */
async function checkVendorAssessmentSchedule() {
  console.log('Running vendor assessment schedule check...');

  try {
    const result = await pool.query(`
      SELECT
        v.id as vendor_id,
        v.name as vendor_name,
        v.contact_email,
        v.next_assessment_due_date,
        v.assessment_frequency_months,
        v.risk_classification
      FROM vendors v
      WHERE v.next_assessment_due_date IS NOT NULL
        AND v.next_assessment_due_date <= NOW() + INTERVAL '30 days'
        AND v.next_assessment_due_date > NOW()
        AND v.status = 'active'
    `);

    for (const vendor of result.rows) {
      const daysUntilDue = Math.ceil((new Date(vendor.next_assessment_due_date) - new Date()) / (1000 * 60 * 60 * 24));

      if (daysUntilDue > 0 && daysUntilDue <= 30) {
        // Check if notification already sent this month
        const notificationCheck = await pool.query(`
          SELECT id FROM notifications
          WHERE metadata->>'vendor_id' = $1
            AND type = 'email'
            AND body ILIKE '%assessment%'
            AND created_at > NOW() - INTERVAL '7 days'
        `, [vendor.vendor_id]);

        if (notificationCheck.rows.length === 0) {
          // Create an in-app notification for TPRM analysts
          await pool.query(`
            INSERT INTO notifications (user_id, type, subject, body, status, scheduled_at, sent_at, metadata)
            SELECT u.id, 'in-app',
              'Upcoming Vendor Assessment',
              'Vendor ' || v.name || ' has an assessment due in ' || $2 || ' day(s).',
              'pending', NOW(), NULL,
              jsonb_build_object(
                'vendor_id', v.id,
                'type', 'vendor_assessment_due'
              )
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            WHERE ur.role IN ('tprm_analyst', 'admin')
              AND u.email_enabled = true
          `, [vendor.vendor_id, daysUntilDue]);
        }
      }
    }

    console.log(`Processed ${result.rows.length} vendors for assessment scheduling`);
  } catch (error) {
    console.error('Error in vendor assessment schedule check:', error);
  }
}

/**
 * Initialize all scheduled jobs
 */
export function initializeScheduler() {
  console.log('Initializing email reminder scheduler...');

  // Clear any existing jobs
  scheduledJobs.forEach(job => job.stop());
  scheduledJobs = [];

  // Daily at 9:00 AM - Check assessment due reminders (7 days before due)
  const dueReminderJob = cron.schedule('0 9 * * *', async () => {
    await checkAssessmentDueReminders();
  }, {
    scheduled: false,
    timezone: 'UTC'
  });

  // Daily at 10:00 AM - Check assessment expiry warnings (3 days before expiry)
  const expiryWarningJob = cron.schedule('0 10 * * *', async () => {
    await checkAssessmentExpiryWarnings();
  }, {
    scheduled: false,
    timezone: 'UTC'
  });

  // Daily at 11:00 AM - Check remediation due reminders (7 days before due)
  const remediationReminderJob = cron.schedule('0 11 * * *', async () => {
    await checkRemediationDueReminders();
  }, {
    scheduled: false,
    timezone: 'UTC'
  });

  // Daily at 8:00 AM - Check vendor assessment schedules (30 days before due)
  const vendorScheduleJob = cron.schedule('0 8 * * *', async () => {
    await checkVendorAssessmentSchedule();
  }, {
    scheduled: false,
    timezone: 'UTC'
  });

  // Start all jobs
  dueReminderJob.start();
  expiryWarningJob.start();
  remediationReminderJob.start();
  vendorScheduleJob.start();

  scheduledJobs = [dueReminderJob, expiryWarningJob, remediationReminderJob, vendorScheduleJob];

  console.log('Email reminder scheduler initialized with 4 daily jobs');
}

/**
 * Stop all scheduled jobs
 */
export function stopScheduler() {
  console.log('Stopping email reminder scheduler...');
  scheduledJobs.forEach(job => job.stop());
  scheduledJobs = [];
}

/**
 * Run all checks immediately (for testing)
 */
export async function runAllChecksNow() {
  console.log('Running all reminder checks immediately...');
  await checkAssessmentDueReminders();
  await checkAssessmentExpiryWarnings();
  await checkRemediationDueReminders();
  await checkVendorAssessmentSchedule();
  console.log('All reminder checks completed');
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
  return {
    running: scheduledJobs.length > 0,
    jobs: scheduledJobs.map(job => ({
      running: job.running,
      nextDate: job.nextDate ? job.nextDate().toDate() : null,
    })),
  };
}

export default {
  initializeScheduler,
  stopScheduler,
  runAllChecksNow,
  getSchedulerStatus,
};