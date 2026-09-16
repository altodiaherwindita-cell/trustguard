export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Vendor {
  id: string;
  name: string;
  category: string;
  status: 'pending' | 'in-review' | 'approved' | 'rejected';
  riskScore: number;
  riskLevel: RiskLevel;
  lastAssessment: string;
  contactEmail: string;
  industry: string;
  riskClassification?: string;
  nextAssessmentDueDate?: string;
}

export interface Question {
  id: string;
  category: string;
  question: string;
  type: 'single-choice' | 'multiple-choice' | 'text' | 'boolean';
  options?: string[];
  weight: number;
  riskImpact: 'low' | 'medium' | 'high';
}

export interface QuestionnaireResponse {
  questionId: string;
  answer: string | string[] | boolean;
  score: number;
}

export interface Assessment {
  id: string;
  vendorId: string;
  vendorName: string;
  status: 'not-started' | 'in-progress' | 'submitted' | 'reviewed';
  responses: QuestionnaireResponse[];
  overallScore: number;
  riskLevel: RiskLevel;
  createdAt: string;
  submittedAt?: string;
  reviewedAt?: string;
  aiSummary?: string;
  expiryDate?: string;
  currentReviewerId?: string;
}

export interface EvidenceDocument {
  id: string;
  assessmentId: string;
  questionId?: string;
  vendorId: string;
  filename: string;
  originalFilename: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  fileHash?: string;
  description?: string;
  uploadedBy: string;
  uploadedByName?: string;
  uploadedByEmail?: string;
  isVendorUpload: boolean;
  status: 'pending' | 'validated' | 'rejected';
  validatedBy?: string;
  validatedAt?: string;
  validationNotes?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RemediationItem {
  id: string;
  assessmentId: string;
  vendorId: string;
  questionId?: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in-progress' | 'completed' | 'verified' | 'closed';
  dueDate?: string;
  assignedTo?: string;
  assignedToEmail?: string;
  vendorContact?: string;
  vendorResponse?: string;
  vendorResponseAt?: string;
  reviewerNotes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  closedBy?: string;
  closedAt?: string;
  closureReason?: string;
  createdAt: string;
  updatedAt: string;
  vendorName?: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  ipAddress?: string;
  userAgent?: string;
  requestMethod?: string;
  requestPath?: string;
  requestBody?: any;
  responseStatus?: number;
  responseBody?: any;
  metadata?: any;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId?: string;
  recipientEmail?: string;
  templateName?: string;
  type: 'email' | 'in-app';
  subject?: string;
  body: string;
  status: 'pending' | 'sent' | 'failed' | 'read';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduledAt?: string;
  sentAt?: string;
  readAt?: string;
  errorMessage?: string;
  retryCount: number;
  metadata?: any;
  createdAt: string;
}

export interface DashboardStats {
  totalVendors: number;
  pendingAssessments: number;
  highRiskVendors: number;
  completedThisMonth: number;
  averageRiskScore: number;
  overdueRemediations?: number;
  pendingEvidence?: number;
}
