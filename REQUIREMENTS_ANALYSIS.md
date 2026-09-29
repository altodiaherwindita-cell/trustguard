# Third Party Security and Data Protection Assessment Platform
## Analisis Kebutuhan dan Rencana Implementasi

---

## 1. Pendahuluan

### 1.1 Latar Belakang Proyek

Perusahaan saat ini bekerja sama dengan berbagai pihak ketiga/vendor untuk mendukung proses bisnis, operasional, pengembangan aplikasi, layanan cloud, dan pengelolaan data. Seiring meningkatnya ketergantungan terhadap vendor eksternal, risiko keamanan informasi dan perlindungan data yang berasal dari third party juga meningkat.

**Masalah Saat Ini:**
- Sulit melakukan tracking status assessment vendor
- Tidak terdapat standardisasi questionnaire dan scoring
- Sulit melakukan monitoring remediation dan expiry assessment
- Dokumentasi evidence tersebar di berbagai media
- Proses approval dan review belum terintegrasi
- Tidak terdapat dashboard monitoring risiko vendor secara terpusat
- Kesulitan dalam audit trail dan pelaporan compliance

**Solusi:** Pengembangan Third Party Security and Data Protection Assessment Platform sebagai centralized platform untuk pengelolaan proses assessment keamanan dan perlindungan data vendor secara end-to-end.

### 1.2 Tujuan

a. Meningkatkan efektivitas dan efisiensi proses assessment vendor
b. Menstandarisasi proses security dan data protection assessment
c. Menyediakan centralized dashboard untuk monitoring risiko vendor
d. Mempermudah proses review, approval, dan remediation tracking
e. Mendukung kebutuhan audit dan compliance perusahaan
f. Mengurangi risiko keamanan informasi dan kebocoran data dari third party/vendor
g. Menyediakan mekanisme assessment berbasis risk scoring dan evidence validation
h. Mendukung pengiriman questionnaire otomatis melalui email dan link assessment
i. Mempermudah vendor dalam mengisi assessment secara mandiri melalui portal vendor

### 1.3 Ruang Lingkup

| No | Fitur | Status | Prioritas |
|----|-------|--------|-----------|
| a | Pengelolaan data vendor dan vendor profile | ✅ Sudah Ada | High |
| b | Pembuatan dan pengelolaan questionnaire assessment | ✅ Sudah Ada | High |
| c | Security assessment dan data protection assessment | ✅ Sudah Ada | High |
| d | Risk scoring otomatis berdasarkan jawaban assessment | ⚠️ Perlu Peningkatan | High |
| e | Upload dan validasi evidence dokumen | ❌ Belum Ada | High |
| f | Workflow review dan approval assessment | ⚠️ Perlu Peningkatan | High |
| g | Dashboard monitoring vendor risk | ✅ Sudah Ada | High |
| h | Reminder dan notifikasi assessment expiry/remediation | ❌ Belum Ada | Medium |
| i | Portal vendor untuk pengisian questionnaire | ✅ Sudah Ada | High |
| j | Audit trail aktivitas user | ❌ Belum Ada | High |
| k | Reporting dan export hasil assessment | ❌ Belum Ada | Medium |
| l | Role-based access control (RBAC) | ✅ Sudah Ada | High |
| m | AI Assistance untuk risk assessment | ⚠️ Perlu Peningkatan | Medium |

---

## 2. Spesifikasi Kebutuhan

### 2.1 Spesifikasi Kebutuhan Bisnis

| ID | Requirement | Status | Catatan |
|----|-------------|--------|---------|
| BR-001 | Sistem harus mampu mengelola data vendor secara terpusat | ✅ Implemented | Vendor management sudah tersedia |
| BR-002 | Sistem harus mendukung pembuatan beberapa jenis questionnaire assessment | ✅ Implemented | Questionnaire management tersedia |
| BR-003 | Vendor harus dapat menerima link assessment melalui email | ⚠️ Partial | Invitation token ada, email integration perlu ditambahkan |
| BR-004 | Vendor harus dapat mengisi assessment tanpa perlu akses internal perusahaan | ✅ Implemented | Token-based access tersedia |
| BR-005 | Sistem harus dapat melakukan perhitungan risk scoring secara otomatis | ⚠️ Partial | Logic scoring perlu ditingkatkan |
| BR-006 | Reviewer harus dapat memberikan komentar dan meminta revisi assessment | ❌ Not Implemented | Perlu development |
| BR-007 | Sistem harus menyediakan dashboard monitoring status assessment vendor | ✅ Implemented | Dashboard tersedia |
| BR-008 | Sistem harus menyediakan reminder otomatis untuk assessment yang mendekati expiry | ❌ Not Implemented | Perlu development |
| BR-009 | Sistem harus mendukung upload evidence dokumen oleh vendor | ❌ Not Implemented | Perlu development |
| BR-010 | Sistem harus mendukung approval workflow multi-level | ❌ Not Implemented | Perlu development |
| BR-011 | Sistem harus menyediakan export laporan dalam format PDF dan Excel | ❌ Not Implemented | Perlu development |
| BR-012 | Sistem harus menyimpan audit trail seluruh aktivitas user | ❌ Not Implemented | Perlu development |
| BR-013 | Sistem harus mendukung segregasi akses berdasarkan role user | ✅ Implemented | RBAC sudah tersedia |
| BR-014 | Sistem harus menyediakan fitur AI assistance untuk analisis jawaban assessment | ⚠️ Partial | AI Assistant page ada, backend integration perlu ditambahkan |
| BR-015 | Sistem harus dapat melakukan klasifikasi vendor berdasarkan tingkat risiko | ⚠️ Partial | Risk level ada, auto-classification perlu ditingkatkan |

### 2.2 Spesifikasi Kebutuhan Teknis

| ID | Requirement | Status | Implementasi |
|----|-------------|--------|--------------|
| TR-001 | Platform berbasis web application | ✅ Implemented | React + Express |
| TR-002 | Mendukung deployment menggunakan Docker container | ✅ Implemented | Docker Compose configured |
| TR-003 | Menggunakan PostgreSQL sebagai database | ✅ Implemented | PostgreSQL 15 |
| TR-004 | Mendukung HTTPS dan TLS encryption | ⚠️ Partial | Nginx configured, SSL perlu setup di production |
| TR-005 | Mendukung Single Sign-On (SSO) internal perusahaan | ❌ Not Implemented | Perlu development |
| TR-006 | Mendukung role-based access control (RBAC) | ✅ Implemented | Admin, TPRM Analyst, Vendor roles |
| TR-007 | Mendukung file upload evidence dengan size limit | ❌ Not Implemented | Perlu development |
| TR-008 | Mendukung email notification integration | ❌ Not Implemented | Perlu development |
| TR-009 | Mendukung API integration untuk future enhancement | ✅ Implemented | RESTful API |
| TR-010 | Mendukung centralized logging dan monitoring | ⚠️ Partial | Basic logging ada, perlu enhancement |
| TR-011 | Mendukung backup dan restore database | ⚠️ Partial | Docker volume ada, script backup perlu |
| TR-012 | Mendukung high availability dan scalability | ⚠️ Partial | Architecture mendukung, perlu configuration |
| TR-013 | Mendukung audit logging seluruh aktivitas user | ❌ Not Implemented | Perlu development |
| TR-014 | AI assistant menggunakan LLM | ❌ Not Implemented | UI ada, backend integration perlu |

### 2.3 User Access Matrix

| Role | Deskripsi | Akses |
|------|-----------|-------|
| **Super Admin** | Pengelola utama sistem | Full Access: User management, vendor management, questionnaire management, assessment review & approval, dashboard, settings, audit logs |
| **Security Reviewer** | Melakukan review assessment | Review, Approval, Dashboard, Vendor viewing, Assessment viewing, AI Assistant |
| **Vendor** | Mengisi questionnaire dan upload evidence | View own vendors, Fill questionnaires, Upload evidence, View assessment results, Remediation tracking |

---

## 3. Gap Analysis dan Rencana Implementasi

### 3.1 Fitur yang Sudah Terimplementasi (No Action Required)

1. ✅ **Vendor Management** - CRUD operations untuk vendor
2. ✅ **Questionnaire Management** - Template questionnaire dengan categories
3. ✅ **Assessment Flow** - Create, submit, review assessment
4. ✅ **Risk Scoring Basic** - Risk score dan risk level fields
5. ✅ **Dashboard** - Monitoring vendor risk metrics
6. ✅ **RBAC** - Admin, TPRM Analyst, Vendor roles
7. ✅ **Token-based Vendor Access** - Invitation system untuk vendor
8. ✅ **Docker Deployment** - Full containerization

### 3.2 Fitur yang Perlu Peningkatan (Enhancement Required)

#### 3.2.1 Risk Scoring Engine Enhancement
**File terkait:** `server/routes/assessments.js`, `src/components/RiskScoreResults.tsx`

**Perubahan yang diperlukan:**
- Implementasi automatic risk calculation berdasarkan jawaban questionnaire
- Weight-based scoring system
- Category-based risk aggregation
- Risk level classification (Low, Medium, High, Critical)

```javascript
// Contoh algoritma risk scoring
const calculateRiskScore = (responses, questions) => {
  let totalScore = 0;
  let maxScore = 0;
  
  questions.forEach(q => {
    const response = responses.find(r => r.question_id === q.id);
    const weight = q.weight || 5;
    maxScore += weight;
    
    if (response?.answer) {
      // Boolean: Yes = full weight, No = 0
      if (q.type === 'boolean') {
        totalScore += response.answer ? weight : 0;
      }
      // Single choice: based on option index
      else if (q.type === 'single-choice') {
        const options = JSON.parse(q.options);
        const selectedIndex = options.indexOf(response.answer);
        const scoreRatio = 1 - (selectedIndex / options.length);
        totalScore += weight * scoreRatio;
      }
    }
  });
  
  const percentage = (totalScore / maxScore) * 100;
  const riskScore = 100 - percentage; // Higher score = higher risk
  
  let riskLevel;
  if (riskScore >= 75) riskLevel = 'Critical';
  else if (riskScore >= 50) riskLevel = 'High';
  else if (riskScore >= 25) riskLevel = 'Medium';
  else riskLevel = 'Low';
  
  return { riskScore: Math.round(riskScore), riskLevel, overallScore: Math.round(percentage) };
};
```

#### 3.2.2 AI Assistant Integration
**File terkait:** `src/pages/AIAssistantPage.tsx`, perlu backend API baru

**Perubahan yang diperlukan:**
- Backend API endpoint untuk AI analysis
- Integration dengan LLM provider (OpenAI, Azure OpenAI, atau local LLM)
- Prompt engineering untuk risk assessment
- Response summarization
- Remediation recommendation generation

### 3.3 Fitur Baru yang Perlu Dikembangkan (New Development)

#### 3.3.1 Evidence Management Module
**Database Schema:**
```sql
CREATE TABLE evidence_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
  question_id TEXT REFERENCES questions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INT,
  file_type TEXT,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  verification_status TEXT DEFAULT 'pending', -- pending, verified, rejected
  verification_notes TEXT
);

CREATE INDEX idx_evidence_assessment_id ON evidence_documents(assessment_id);
CREATE INDEX idx_evidence_question_id ON evidence_documents(question_id);
```

**API Endpoints:**
- `POST /api/evidence` - Upload evidence document
- `GET /api/evidence/:assessmentId` - Get all evidence for assessment
- `GET /api/evidence/:id/download` - Download evidence file
- `PATCH /api/evidence/:id/verify` - Verify/reject evidence (Reviewer only)
- `DELETE /api/evidence/:id` - Delete evidence

**File Storage:**
- Local storage dengan configurable path
- Size limit validation (default: 10MB per file)
- File type validation (PDF, DOC, DOCX, XLS, XLSX, PNG, JPG)

#### 3.3.2 Audit Trail System
**Database Schema:**
```sql
CREATE TYPE audit_action AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'UPLOAD', 'DOWNLOAD', 'SUBMIT', 'APPROVE', 'REJECT');

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action audit_action NOT NULL,
  entity_type TEXT NOT NULL, -- 'vendor', 'assessment', 'questionnaire', 'user', 'evidence'
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

**Middleware Implementation:**
```javascript
// server/middleware/audit.js
export function auditLog(entityType) {
  return async (req, res, next) => {
    const originalSend = res.send;
    const startTime = Date.now();
    
    res.send = function(body) {
      // Log after response
      logAudit(req, entityType, body, startTime);
      return originalSend.call(res, body);
    };
    
    next();
  };
}
```

#### 3.3.3 Notification & Reminder System
**Database Schema:**
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'assessment_due', 'assessment_expired', 'remediation_due', 'review_pending'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id UUID,
  is_read BOOLEAN DEFAULT false,
  is_sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE assessment_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
  due_date TIMESTAMPTZ NOT NULL,
  expiry_date TIMESTAMPTZ,
  reminder_enabled BOOLEAN DEFAULT true,
  last_reminder_sent TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Scheduled Jobs:**
- Daily job untuk check assessment due dates
- Email notification untuk approaching deadlines
- In-app notification center

#### 3.3.4 Review & Approval Workflow Enhancement
**Database Schema Enhancement:**
```sql
ALTER TABLE assessments ADD COLUMN current_reviewer_id UUID REFERENCES users(id);
ALTER TABLE assessments ADD COLUMN review_comments TEXT;
ALTER TABLE assessments ADD COLUMN requires_revision BOOLEAN DEFAULT false;
ALTER TABLE assessments ADD COLUMN revision_notes TEXT;

CREATE TABLE assessment_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES users(id),
  review_level INT DEFAULT 1, -- For multi-level approval
  status TEXT NOT NULL, -- 'pending', 'approved', 'rejected', 'revision_requested'
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Workflow States:**
1. `not-started` - Assessment belum dimulai
2. `in-progress` - Vendor sedang mengisi
3. `submitted` - Submitted untuk review
4. `under-review` - Sedang direview oleh reviewer
5. `revision-requested` - Perlu revisi dari vendor
6. `approved` - Disetujui
7. `rejected` - Ditolak
8. `reviewed` - Review selesai

#### 3.3.5 Reporting & Export Module
**Dependencies:**
- `pdfkit` atau `puppeteer` untuk PDF generation
- `exceljs` atau `xlsx` untuk Excel export

**API Endpoints:**
- `GET /api/reports/assessment/:id/pdf` - Export assessment report as PDF
- `GET /api/reports/assessment/:id/excel` - Export assessment data as Excel
- `GET /api/reports/vendors/summary/pdf` - Vendor risk summary report
- `GET /api/reports/compliance/export` - Compliance report export

**Report Templates:**
- Individual Assessment Report
- Vendor Risk Summary
- Quarterly Compliance Report
- Remediation Tracking Report

#### 3.3.6 Email Integration
**Configuration:**
```javascript
// .env
SMTP_HOST=smtp.company.com
SMTP_PORT=587
SMTP_USER=notifications@company.com
SMTP_PASSWORD=xxx
SMTP_FROM=TrustGuard Platform <notifications@company.com>
```

**Email Templates:**
1. Assessment Invitation Email
2. Assessment Due Reminder
3. Assessment Expiry Warning
4. Revision Request Notification
5. Approval/Rejection Notification
6. Remediation Due Reminder

---

## 4. Struktur Database Lengkap (Updated Schema)

```sql
-- Lihat init.sql untuk schema dasar
-- Berikut adalah tambahan yang diperlukan:

-- Evidence Management
CREATE TABLE evidence_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
  question_id TEXT REFERENCES questions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INT,
  file_type TEXT,
  s3_key TEXT, -- Untuk cloud storage
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  verification_status TEXT DEFAULT 'pending',
  verification_notes TEXT
);

-- Audit Trail
CREATE TYPE audit_action AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'UPLOAD', 'DOWNLOAD', 'SUBMIT', 'APPROVE', 'REJECT');

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action audit_action NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id UUID,
  is_read BOOLEAN DEFAULT false,
  is_sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Assessment Schedules
CREATE TABLE assessment_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
  due_date TIMESTAMPTZ NOT NULL,
  expiry_date TIMESTAMPTZ,
  reminder_enabled BOOLEAN DEFAULT true,
  last_reminder_sent TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Assessment Reviews (untuk multi-level approval)
CREATE TABLE assessment_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES users(id),
  review_level INT DEFAULT 1,
  status TEXT NOT NULL,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Remediation Tracking
CREATE TABLE remediation_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
  question_id TEXT REFERENCES questions(id),
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'medium', -- low, medium, high, critical
  status TEXT DEFAULT 'open', -- open, in-progress, completed, verified
  due_date TIMESTAMPTZ,
  assigned_to UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_evidence_assessment_id ON evidence_documents(assessment_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_assessment_schedules_due_date ON assessment_schedules(due_date);
CREATE INDEX idx_remediation_assessment_id ON remediation_items(assessment_id);
```

---

## 5. API Endpoints Lengkap

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Users (Admin only)
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user by ID
- `PATCH /api/users/:id` - Update user
- `PATCH /api/users/:id/role` - Update user role
- `PATCH /api/users/:id/status` - Activate/deactivate user

### Vendors
- `GET /api/vendors` - List vendors (TPRM)
- `GET /api/vendors/my-vendors` - List my vendors (Vendor)
- `GET /api/vendors/:id` - Get vendor details
- `POST /api/vendors` - Create vendor (TPRM)
- `PATCH /api/vendors/:id` - Update vendor
- `DELETE /api/vendors/:id` - Delete vendor (TPRM)
- `POST /api/vendors/:id/assign` - Assign vendor to TPRM analyst

### Assessments
- `GET /api/assessments` - List assessments (TPRM)
- `GET /api/assessments/my-assessments` - List my assessments (Vendor)
- `GET /api/assessments/:id/details` - Get assessment with responses
- `POST /api/assessments` - Create assessment (TPRM)
- `POST /api/assessments/:id/responses` - Submit response
- `POST /api/assessments/:id/submit` - Submit for review
- `POST /api/assessments/:id/review` - Review assessment (TPRM)
- `PATCH /api/assessments/:id/status` - Update assessment status
- `POST /api/assessments/:id/calculate-score` - Auto-calculate risk score

### Questionnaires
- `GET /api/questionnaires/templates` - List questionnaire templates
- `GET /api/questionnaires/:id` - Get template details
- `POST /api/questionnaires` - Create template (TPRM)
- `PATCH /api/questionnaires/:id` - Update template
- `DELETE /api/questionnaires/:id` - Delete template
- `POST /api/questionnaires/:id/duplicate` - Duplicate template

### Evidence
- `POST /api/evidence` - Upload evidence
- `GET /api/evidence/:assessmentId` - List evidence for assessment
- `GET /api/evidence/:id/download` - Download evidence file
- `PATCH /api/evidence/:id/verify` - Verify evidence (TPRM)
- `DELETE /api/evidence/:id` - Delete evidence

### Reviews & Approvals
- `GET /api/reviews/pending` - Get pending reviews (TPRM)
- `POST /api/reviews/:assessmentId` - Submit review
- `POST /api/reviews/:assessmentId/approve` - Approve assessment
- `POST /api/reviews/:assessmentId/request-revision` - Request revision
- `POST /api/reviews/:assessmentId/reject` - Reject assessment

### Remediation
- `GET /api/remediation/:assessmentId` - Get remediation items
- `POST /api/remediation` - Create remediation item
- `PATCH /api/remediation/:id` - Update remediation item
- `PATCH /api/remediation/:id/complete` - Mark as completed
- `PATCH /api/remediation/:id/verify` - Verify completion (TPRM)

### Notifications
- `GET /api/notifications` - Get user notifications
- `PATCH /api/notifications/:id/read` - Mark as read
- `PATCH /api/notifications/read-all` - Mark all as read
- `GET /api/notifications/unread-count` - Get unread count

### Reports
- `GET /api/reports/assessment/:id/pdf` - Export PDF report
- `GET /api/reports/assessment/:id/excel` - Export Excel
- `GET /api/reports/vendors/summary` - Vendor risk summary
- `GET /api/reports/compliance/export` - Compliance export
- `GET /api/reports/dashboard/data` - Dashboard data export

### AI Assistant
- `POST /api/ai/analyze` - Analyze assessment responses
- `POST /api/ai/recommend` - Get remediation recommendations
- `POST /api/ai/summarize` - Summarize assessment
- `POST /api/ai/risk-classify` - Classify risk level

### Invitations
- `POST /api/invitations` - Create invitation
- `GET /api/invitations/:token` - Validate invitation token
- `POST /api/invitations/:token/accept` - Accept invitation
- `DELETE /api/invitations/:id` - Revoke invitation

### Audit Logs (Admin only)
- `GET /api/audit-logs` - List audit logs
- `GET /api/audit-logs/:userId` - Get logs for specific user
- `GET /api/audit-logs/export` - Export audit logs

---

## 6. Frontend Pages Structure

### Existing Pages (✅)
- `/` - Dashboard
- `/vendors` - Vendor Management
- `/assessments` - Assessment List
- `/questionnaire/:assessmentId` - Fill Questionnaire
- `/questionnaires` - Questionnaire Template Management
- `/ai-assistant` - AI Assistant
- `/settings` - Settings
- `/invite/:token` - Invitation Acceptance

### New Pages Needed (❌)
- `/evidence/:assessmentId` - Evidence Management
- `/reviews/pending` - Pending Reviews Queue
- `/review/:assessmentId` - Review Interface
- `/remediation/:assessmentId` - Remediation Tracking
- `/reports` - Reports Center
- `/notifications` - Notification Center
- `/audit-logs` - Audit Log Viewer (Admin)
- `/profile` - User Profile Management

---

## 7. Implementation Priority

### Phase 1: Core Enhancements (Week 1-2)
1. ✅ Risk scoring engine automation
2. ✅ Evidence management module
3. ✅ Audit trail implementation

### Phase 2: Workflow & Notifications (Week 3-4)
1. ✅ Enhanced review & approval workflow
2. ✅ Notification system
3. ✅ Email integration

### Phase 3: Reporting & AI (Week 5-6)
1. ✅ Reporting & export module
2. ✅ AI assistant backend integration
3. ✅ Remediation tracking

### Phase 4: Polish & Testing (Week 7-8)
1. UI/UX improvements
2. Performance optimization
3. Security hardening
4. Documentation
5. User acceptance testing

---

## 8. Environment Variables (Updated)

```bash
# Database
DB_USER=trustguard
DB_PASSWORD=secure_password_here
DB_NAME=trustguard
DB_HOST=db
DB_PORT=5432

# API
API_PORT=3000
NODE_ENV=production
JWT_SECRET=generate_secure_random_string_here
JWT_EXPIRY=24h

# File Upload
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_PATH=/app/uploads
ALLOWED_FILE_TYPES=pdf,doc,docx,xls,xlsx,png,jpg,jpeg

# Email (SMTP)
SMTP_HOST=smtp.company.com
SMTP_PORT=587
SMTP_USER=notifications@company.com
SMTP_PASSWORD=smtp_password_here
SMTP_FROM="TrustGuard Platform <notifications@company.com>"
SMTP_SECURE=false

# AI/LLM (Optional)
LLM_PROVIDER=openai  # openai, azure, local
OPENAI_API_KEY=your_api_key_here
AZURE_OPENAI_ENDPOINT=your_endpoint_here
AZURE_OPENAI_API_KEY=your_api_key_here
LLM_MODEL=gpt-4o-mini

# Storage (Optional S3)
STORAGE_TYPE=local  # local, s3
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
S3_BUCKET=trustguard-evidence

# Security
BCRYPT_ROUNDS=12
CORS_ORIGIN=http://localhost,https://yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Session
SESSION_TIMEOUT=86400  # 24 hours in seconds
```

---

## 9. Security Considerations

1. **Authentication & Authorization**
   - JWT token dengan expiry time
   - Session timeout enforcement
   - Role-based access control strict enforcement
   - Password complexity requirements

2. **Data Protection**
   - Encryption at rest untuk sensitive data
   - HTTPS/TLS untuk semua komunikasi
   - File upload validation (type, size)
   - SQL injection prevention (parameterized queries)

3. **Audit & Compliance**
   - Complete audit trail untuk semua aksi
   - Log retention policy
   - Data privacy compliance (GDPR, etc.)
   - Regular security assessments

4. **Infrastructure Security**
   - Container security best practices
   - Network segmentation
   - Regular dependency updates
   - Vulnerability scanning

---

## 10. Testing Strategy

### Unit Testing
- API endpoint testing
- Business logic testing
- Utility function testing

### Integration Testing
- Database integration
- File upload integration
- Email service integration
- AI service integration

### End-to-End Testing
- Complete assessment workflow
- Vendor invitation flow
- Review and approval flow
- Report generation

### Security Testing
- Penetration testing
- OWASP Top 10 validation
- Authentication bypass testing
- Input validation testing

---

## 11. Deployment Checklist

- [ ] Update all environment variables
- [ ] Generate secure JWT secret
- [ ] Configure SMTP settings
- [ ] Setup SSL/TLS certificates
- [ ] Configure backup strategy
- [ ] Setup monitoring and alerting
- [ ] Test all integrations
- [ ] Perform security scan
- [ ] Document deployment procedure
- [ ] Train end users
- [ ] Prepare rollback plan

---

## 12. Conclusion

Platform TrustGuard AI yang sudah ada merupakan foundation yang solid untuk Third Party Security and Data Protection Assessment Platform. Dengan implementasi enhancement dan fitur baru sesuai roadmap di atas, platform akan fully compliant dengan semua requirement bisnis dan teknis yang ditetapkan.

**Next Steps:**
1. Review dan approve dokumen ini
2. Prioritize fitur berdasarkan business value
3. Start development Phase 1
4. Regular progress review setiap minggu
5. User acceptance testing setelah Phase 3
6. Production deployment setelah Phase 4
