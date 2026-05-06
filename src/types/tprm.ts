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
}

export interface DashboardStats {
  totalVendors: number;
  pendingAssessments: number;
  highRiskVendors: number;
  completedThisMonth: number;
  averageRiskScore: number;
}
