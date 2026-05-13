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
INSERT INTO users (email, password_hash, full_name, company) VALUES
('admin@trustguard.ai', '$2b$12$HHhixK3A0Pj7MmJI3IdHqeQ44eBuknuDaUrhAp2YxNP5Hg5yjc.gi', 'Admin User', 'TrustGuard')
ON CONFLICT (email) DO NOTHING;

-- Assign admin role to the default admin user
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin' FROM users WHERE email = 'admin@trustguard.ai'
ON CONFLICT DO NOTHING;

-- Insert admin profile
INSERT INTO profiles (id, email, full_name, company)
SELECT id, email, full_name, company FROM users WHERE email = 'admin@trustguard.ai'
ON CONFLICT (id) DO NOTHING;
