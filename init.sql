-- TrustGuard AI Database Initialization Script
-- This script creates the database schema based on the Supabase migrations

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE app_role AS ENUM ('admin', 'tprm_analyst', 'vendor');

-- Users table (replaces auth.users from Supabase)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  company TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  company TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vendors table
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  industry TEXT,
  contact_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  current_risk_score INT,
  current_risk_level TEXT,
  last_assessment_at TIMESTAMPTZ,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Questions table
CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  type TEXT NOT NULL,
  options JSONB,
  weight INT NOT NULL DEFAULT 5,
  risk_impact TEXT NOT NULL DEFAULT 'medium',
  display_order INT NOT NULL DEFAULT 0
);

-- Assessments table
CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not-started',
  overall_score INT,
  risk_score INT,
  risk_level TEXT,
  ai_summary TEXT,
  strengths JSONB,
  weaknesses JSONB,
  recommendations JSONB,
  category_scores JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ
);

-- Assessment responses table
CREATE TABLE assessment_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, question_id)
);

-- Assessment invitations table
CREATE TABLE assessment_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ
);

-- Sessions table for authentication
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_vendors_owner_user_id ON vendors(owner_user_id);
CREATE INDEX idx_assessments_vendor_id ON assessments(vendor_id);
CREATE INDEX idx_assessment_responses_assessment_id ON assessment_responses(assessment_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- Insert seed questions
INSERT INTO questions (id, category, question, type, options, weight, risk_impact, display_order) VALUES
('q1','Data Protection','Does your organization encrypt data at rest?','boolean',NULL,10,'high',1),
('q2','Data Protection','What encryption standards do you use for data in transit?','single-choice','["TLS 1.3","TLS 1.2","TLS 1.1 or lower","No encryption"]',10,'high',2),
('q3','Access Control','Do you implement multi-factor authentication (MFA)?','boolean',NULL,8,'high',3),
('q4','Access Control','How often do you review user access privileges?','single-choice','["Monthly","Quarterly","Annually","Never"]',6,'medium',4),
('q5','Incident Response','Do you have a documented incident response plan?','boolean',NULL,8,'high',5),
('q6','Incident Response','What is your average incident response time?','single-choice','["Under 1 hour","1-4 hours","4-24 hours","Over 24 hours"]',7,'medium',6),
('q7','Compliance','Which compliance certifications does your organization hold?','multiple-choice','["SOC 2","ISO 27001","GDPR","HIPAA","PCI DSS","None"]',9,'high',7),
('q8','Security Operations','Do you conduct regular penetration testing?','boolean',NULL,7,'medium',8),
('q9','Security Operations','How frequently do you perform vulnerability assessments?','single-choice','["Weekly","Monthly","Quarterly","Annually","Never"]',7,'medium',9),
('q10','Business Continuity','What is your Recovery Time Objective (RTO)?','single-choice','["Under 1 hour","1-4 hours","4-24 hours","Over 24 hours"]',6,'medium',10);

-- Create default admin user (password: ChangeMe@889 - CHANGE IN PRODUCTION!)
-- Password hash is for 'ChangeMe@889' using bcrypt
-- must_change_password is set to true to force password change on first login
INSERT INTO users (email, password_hash, full_name, company, must_change_password) VALUES
('admin@trustguard.ai', '$2b$12$HHhixK3A0Pj7MmJI3IdHqeQ44eBuknuDaUrhAp2YxNP5Hg5yjc.gi', 'Admin User', 'TrustGuard', true)
ON CONFLICT (email) DO NOTHING;

-- Assign admin role to the default admin user
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin' FROM users WHERE email = 'admin@trustguard.ai'
ON CONFLICT DO NOTHING;

-- Insert admin profile
INSERT INTO profiles (id, email, full_name, company)
SELECT id, email, full_name, company FROM users WHERE email = 'admin@trustguard.ai'
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- EVIDENCE MANAGEMENT TABLES
-- ============================================

-- Evidence documents table
CREATE TABLE IF NOT EXISTS evidence_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_id TEXT REFERENCES questions(id) ON DELETE SET NULL,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  file_hash TEXT, -- SHA256 hash for integrity verification
  description TEXT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_by_name TEXT, -- Store name at time of upload
  uploaded_by_email TEXT, -- Store email at time of upload
  is_vendor_upload BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, validated, rejected
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  validation_notes TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for evidence documents
CREATE INDEX IF NOT EXISTS idx_evidence_assessment_id ON evidence_documents(assessment_id);
CREATE INDEX IF NOT EXISTS idx_evidence_vendor_id ON evidence_documents(vendor_id);
CREATE INDEX IF NOT EXISTS idx_evidence_question_id ON evidence_documents(question_id);
CREATE INDEX IF NOT EXISTS idx_evidence_status ON evidence_documents(status);
CREATE INDEX IF NOT EXISTS idx_evidence_uploaded_by ON evidence_documents(uploaded_by);

-- ============================================
-- AUDIT TRAIL TABLES
-- ============================================

-- Audit logs table for tracking all user activities
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email TEXT, -- Store email at time of action
  user_name TEXT, -- Store name at time of action
  action TEXT NOT NULL, -- e.g., 'LOGIN', 'LOGOUT', 'CREATE_VENDOR', 'UPDATE_ASSESSMENT'
  resource_type TEXT NOT NULL, -- e.g., 'vendor', 'assessment', 'questionnaire', 'evidence'
  resource_id UUID, -- ID of the affected resource
  resource_name TEXT, -- Name/description of the resource
  ip_address INET,
  user_agent TEXT,
  request_method TEXT, -- GET, POST, PUT, DELETE
  request_path TEXT,
  request_body JSONB, -- Redacted sensitive data
  response_status INTEGER,
  response_body JSONB, -- Redacted sensitive data
  metadata JSONB, -- Additional context-specific data
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for audit logs (optimized for querying)
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user_email ON audit_logs(user_email);

-- ============================================
-- NOTIFICATION & REMINDER TABLES
-- ============================================

-- Notification templates table
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- email, in-app
  subject_template TEXT,
  body_template TEXT NOT NULL,
  variables JSONB, -- List of supported template variables
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_email TEXT, -- For external recipients like vendors
  template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
  template_name TEXT, -- Store template name at time of creation
  type TEXT NOT NULL, -- email, in-app
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed, read
  priority TEXT NOT NULL DEFAULT 'normal', -- low, normal, high, urgent
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB, -- Context data (vendor_id, assessment_id, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_at ON notifications(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_email ON notifications(recipient_email);

-- Notification settings per user
CREATE TABLE IF NOT EXISTS user_notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  assessment_reminder BOOLEAN NOT NULL DEFAULT true,
  assessment_expiry_reminder BOOLEAN NOT NULL DEFAULT true,
  remediation_due_reminder BOOLEAN NOT NULL DEFAULT true,
  review_request BOOLEAN NOT NULL DEFAULT true,
  approval_notification BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- REMEDIATION TRACKING TABLES
-- ============================================

-- Remediation items table
CREATE TABLE IF NOT EXISTS remediation_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  question_id TEXT REFERENCES questions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  risk_level TEXT NOT NULL, -- low, medium, high, critical
  priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, critical
  status TEXT NOT NULL DEFAULT 'open', -- open, in-progress, completed, verified, closed
  due_date TIMESTAMPTZ,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_to_email TEXT,
  vendor_contact TEXT,
  vendor_response TEXT,
  vendor_response_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  closed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  closure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for remediation items
CREATE INDEX IF NOT EXISTS idx_remediation_assessment_id ON remediation_items(assessment_id);
CREATE INDEX IF NOT EXISTS idx_remediation_vendor_id ON remediation_items(vendor_id);
CREATE INDEX IF NOT EXISTS idx_remediation_status ON remediation_items(status);
CREATE INDEX IF NOT EXISTS idx_remediation_due_date ON remediation_items(due_date);
CREATE INDEX IF NOT EXISTS idx_remediation_assigned_to ON remediation_items(assigned_to);

-- Remediation comments/activity log
CREATE TABLE IF NOT EXISTS remediation_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  remediation_id UUID NOT NULL REFERENCES remediation_items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_email TEXT,
  comment TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT true, -- Visible to internal team only
  attachment_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for remediation comments
CREATE INDEX IF NOT EXISTS idx_remediation_comments_remediation_id ON remediation_comments(remediation_id);
CREATE INDEX IF NOT EXISTS idx_remediation_comments_user_id ON remediation_comments(user_id);

-- ============================================
-- ASSESSMENT WORKFLOW ENHANCEMENTS
-- ============================================

-- Add columns to assessments table for workflow
ALTER TABLE assessments 
ADD COLUMN IF NOT EXISTS current_reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approval_level INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_review_date TIMESTAMPTZ;

-- Assessment review history
CREATE TABLE IF NOT EXISTS assessment_review_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  reviewer_name TEXT,
  reviewer_email TEXT,
  action TEXT NOT NULL, -- submitted, reviewed, approved, rejected, returned_for_revision
  comments TEXT,
  risk_score_before INTEGER,
  risk_score_after INTEGER,
  risk_level_before TEXT,
  risk_level_after TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for review history
CREATE INDEX IF NOT EXISTS idx_review_history_assessment_id ON assessment_review_history(assessment_id);
CREATE INDEX IF NOT EXISTS idx_review_history_reviewer_id ON assessment_review_history(reviewer_id);

-- ============================================
-- VENDOR RISK CLASSIFICATION ENHANCEMENTS
-- ============================================

-- Add columns to vendors table for enhanced tracking
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS risk_classification TEXT, -- critical, high, medium, low
ADD COLUMN IF NOT EXISTS risk_classification_reason TEXT,
ADD COLUMN IF NOT EXISTS assessment_frequency_months INTEGER NOT NULL DEFAULT 12,
ADD COLUMN IF NOT EXISTS contract_start_date DATE,
ADD COLUMN IF NOT EXISTS contract_end_date DATE,
ADD COLUMN IF NOT EXISTS data_access_level TEXT, -- none, limited, moderate, extensive
ADD COLUMN IF NOT EXISTS criticality_score INTEGER,
ADD COLUMN IF NOT EXISTS last_risk_assessment_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_assessment_due_date TIMESTAMPTZ;

-- Indexes for vendor risk tracking
CREATE INDEX IF NOT EXISTS idx_vendors_risk_classification ON vendors(risk_classification);
CREATE INDEX IF NOT EXISTS idx_vendors_next_assessment_due ON vendors(next_assessment_due_date);

-- ============================================
-- SEED DATA FOR NOTIFICATION TEMPLATES
-- ============================================

INSERT INTO notification_templates (name, type, subject_template, body_template, variables) VALUES
('assessment_invitation', 'email', 
 'Assessment Invitation - {{vendor_name}}', 
 'Dear {{vendor_contact}},<br><br>You have been invited to complete a security assessment for {{vendor_name}}.<br><br>Please click the link below to begin:<br>{{assessment_link}}<br><br>This link will expire on {{expiry_date}}.<br><br>Best regards,<br>TrustGuard AI Team',
 '["vendor_name", "vendor_contact", "assessment_link", "expiry_date"]'),

('assessment_reminder', 'email',
 'Assessment Reminder - {{vendor_name}}',
 'Dear {{vendor_contact}},<br><br>This is a reminder that the security assessment for {{vendor_name}} is due on {{due_date}}.<br><br>Please complete the assessment at your earliest convenience.<br><br>Best regards,<br>TrustGuard AI Team',
 '["vendor_name", "vendor_contact", "due_date"]'),

('assessment_expiry_warning', 'email',
 'Assessment Expiry Warning - {{vendor_name}}',
 'Dear {{reviewer_name}},<br><br>The assessment for {{vendor_name}} will expire in {{days_until_expiry}} days on {{expiry_date}}.<br><br>Please initiate a reassessment if needed.<br><br>Best regards,<br>TrustGuard AI Team',
 '["vendor_name", "reviewer_name", "expiry_date", "days_until_expiry"]'),

('remediation_due_reminder', 'email',
 'Remediation Item Due - {{vendor_name}}',
 'Dear {{assignee_name}},<br><br>The following remediation item is due soon:<br><br>Title: {{remediation_title}}<br>Vendor: {{vendor_name}}<br>Due Date: {{due_date}}<br><br>Please ensure timely completion.<br><br>Best regards,<br>TrustGuard AI Team',
 '["vendor_name", "assignee_name", "remediation_title", "due_date"]'),

('review_request', 'email',
 'Assessment Review Request - {{vendor_name}}',
 'Dear {{reviewer_name}},<br><br>A new assessment for {{vendor_name}} is ready for your review.<br><br>Please log in to the TrustGuard AI platform to review the assessment.<br><br>Best regards,<br>TrustGuard AI Team',
 '["vendor_name", "reviewer_name"]'),

('assessment_approved', 'email',
 'Assessment Approved - {{vendor_name}}',
 'Dear {{vendor_contact}},<br><br>Your security assessment for {{vendor_name}} has been approved.<br><br>Thank you for your cooperation.<br><br>Best regards,<br>TrustGuard AI Team',
 '["vendor_name", "vendor_contact"]'),

('assessment_returned', 'email',
 'Assessment Returned for Revision - {{vendor_name}}',
 'Dear {{vendor_contact}},<br><br>Your security assessment for {{vendor_name}} has been returned for revision.<br><br>Please review the comments and resubmit.<br><br>Comments: {{reviewer_comments}}<br><br>Best regards,<br>TrustGuard AI Team',
 '["vendor_name", "vendor_contact", "reviewer_comments"])')

ON CONFLICT (name) DO UPDATE SET
  subject_template = EXCLUDED.subject_template,
  body_template = EXCLUDED.body_template,
  variables = EXCLUDED.variables,
  updated_at = now();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_evidence_documents_updated_at ON evidence_documents;
CREATE TRIGGER update_evidence_documents_updated_at
  BEFORE UPDATE ON evidence_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_remediation_items_updated_at ON remediation_items;
CREATE TRIGGER update_remediation_items_updated_at
  BEFORE UPDATE ON remediation_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_notification_settings_updated_at ON user_notification_settings;
CREATE TRIGGER update_user_notification_settings_updated_at
  BEFORE UPDATE ON user_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create audit log entry
CREATE OR REPLACE FUNCTION create_audit_log(
  p_user_id UUID,
  p_user_email TEXT,
  p_user_name TEXT,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_resource_name TEXT,
  p_ip_address INET,
  p_user_agent TEXT,
  p_request_method TEXT,
  p_request_path TEXT,
  p_request_body JSONB,
  p_response_status INTEGER,
  p_response_body JSONB,
  p_metadata JSONB
) RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO audit_logs (
    user_id, user_email, user_name, action, resource_type, resource_id, resource_name,
    ip_address, user_agent, request_method, request_path, request_body,
    response_status, response_body, metadata
  ) VALUES (
    p_user_id, p_user_email, p_user_name, p_action, p_resource_type, p_resource_id, p_resource_name,
    p_ip_address, p_user_agent, p_request_method, p_request_path, p_request_body,
    p_response_status, p_response_body, p_metadata
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DEFAULT USER NOTIFICATION SETTINGS
-- ============================================

-- Create default notification settings for existing users
INSERT INTO user_notification_settings (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;
