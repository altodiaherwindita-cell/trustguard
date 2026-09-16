// API Client for TrustGuard AI Backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_TIMEOUT_MS = 5000; // 5 second timeout

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

interface User {
  id: string;
  email: string;
  fullName?: string;
  company?: string;
  roles: ('admin' | 'tprm_analyst' | 'vendor')[];
  // The login response includes this (auth.js maps must_change_password);
  // AuthPage reads it to route straight to /change-password.
  mustChangePassword?: boolean;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface AuthResponse {
  user: User;
  token: string;
  message?: string;
}

// Helper function to handle API requests
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('auth_token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    // A 401 only means the session died if we actually sent a token. On an
    // unauthenticated call (login, invitation lookup) it is a normal rejection
    // and the server's message is the one the user needs to see.
    if (response.status === 401 && token) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.dispatchEvent(new CustomEvent('auth-session-expired'));
      return { error: 'Session expired. Please sign in again.' };
    }

    if (!response.ok) {
      return { error: data.error || data.message || 'Request failed' };
    }

    return { data: data as T };
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('API request error:', error);
    if (error instanceof Error && error.name === 'AbortError') {
      return { error: 'Request timed out. Please check your connection.' };
    }
    return { error: error instanceof Error ? error.message : 'Network error' };
  }
}

// Auth API
export const authApi = {
  async login(credentials: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    const result = await request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (result.data?.token) {
      localStorage.setItem('auth_token', result.data.token);
      localStorage.setItem('auth_user', JSON.stringify(result.data.user));
    }

    return result;
  },

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore errors on logout
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    }
  },

  async getCurrentUser(): Promise<ApiResponse<{ user: User }>> {
    return request<{ user: User }>('/api/auth/me');
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<{ message: string }>> {
    return request<{ message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  },

  getStoredUser(): User | null {
    const userStr = localStorage.getItem('auth_user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  },

  clearStorage(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  },
};

// Vendors API
export interface Vendor {
  id: string;
  name: string;
  category?: string;
  industry?: string;
  contact_email?: string;
  owner_user_id?: string;
  status?: string;
  current_risk_score?: number;
  current_risk_level?: 'low' | 'medium' | 'high' | 'critical';
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export const vendorsApi = {
  async getAll(): Promise<ApiResponse<Vendor[]>> {
    const result = await request<{ vendors: Vendor[] }>('/api/vendors');
    if (result.data?.vendors) {
      return { data: result.data.vendors };
    }
    // Handle case where result.data exists but vendors is missing, or return empty array on error
    if (result.error) {
      return { data: [] };
    }
    return { error: result.error, message: result.message };
  },

  async getById(id: string): Promise<ApiResponse<Vendor>> {
    const result = await request<{ vendor: Vendor }>(`/api/vendors/${id}`);
    if (result.data) {
      return { data: result.data.vendor };
    }
    return { error: result.error, message: result.message };
  },

  async create(vendor: Omit<Vendor, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<Vendor>> {
    const result = await request<{ vendor: Vendor }>('/api/vendors', {
      method: 'POST',
      body: JSON.stringify(vendor),
    });
    if (result.data) {
      return { data: result.data.vendor };
    }
    return { error: result.error, message: result.message };
  },

  async update(id: string, vendor: Partial<Vendor>): Promise<ApiResponse<Vendor>> {
    const result = await request<{ vendor: Vendor }>(`/api/vendors/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(vendor),
    });
    if (result.data) {
      return { data: result.data.vendor };
    }
    return { error: result.error, message: result.message };
  },

  async delete(id: string): Promise<ApiResponse<void>> {
    return request<void>(`/api/vendors/${id}`, {
      method: 'DELETE',
    });
  },
};

// Assessments API
export interface Assessment {
  id: string;
  vendor_id: string;
  status: string;
  vendor?: { name: string };
  created_at?: string;
  updated_at?: string;
  submitted_at?: string;
  reviewed_at?: string;
  // The list/detail queries select `a.*, v.name as vendor_name`, so these come
  // back flat on the row rather than nested under `vendor`.
  vendor_name?: string;
  vendor_email?: string;
  risk_score?: number;
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  overall_score?: number;
  ai_summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
  category_scores?: Array<{ category: string; score: number }>;
}

export const assessmentsApi = {
  async getAll(): Promise<ApiResponse<(Assessment & { vendors?: { name: string } })[]>> {
    const result = await request<{ assessments: (Assessment & { vendors?: { name: string } })[] }>('/api/assessments');
    if (result.data?.assessments) {
      return { data: result.data.assessments };
    }
    // Handle case where result.data exists but assessments is missing, or return empty array on error
    if (result.error) {
      return { data: [] };
    }
    return { error: result.error, message: result.message };
  },

  async getById(id: string): Promise<ApiResponse<Assessment>> {
    const result = await request<{ assessment: Assessment }>(`/api/assessments/${id}`);
    if (result.data) {
      return { data: result.data.assessment };
    }
    return { error: result.error, message: result.message };
  },

  async create(assessment: { vendor_id: string; status?: string }): Promise<ApiResponse<Assessment>> {
    const result = await request<{ assessment: Assessment }>('/api/assessments', {
      method: 'POST',
      body: JSON.stringify(assessment),
    });
    if (result.data) {
      return { data: result.data.assessment };
    }
    return { error: result.error, message: result.message };
  },
};

// Users API (admin only)
export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  company?: string;
  is_active: boolean;
  roles: string[];
}

export const usersApi = {
  async getAll(): Promise<ApiResponse<UserProfile[]>> {
    const result = await request<{ users: UserProfile[] }>('/api/users');
    if (result.data?.users) {
      return { data: result.data.users };
    }
    // Handle case where result.data exists but users is missing, or return empty array on error
    if (result.error) {
      return { data: [] };
    }
    return { error: result.error, message: result.message };
  },

  async create(user: { email: string; password: string; full_name?: string; company?: string; roles?: string[] }): Promise<ApiResponse<UserProfile>> {
    const result = await request<{ user: UserProfile }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
    if (result.data) {
      return { data: result.data.user };
    }
    return { 
      error: typeof result.error === 'string' ? result.error : 'Failed to create user',
      data: undefined 
    };
  },

  async updateRole(userId: string, role: string): Promise<ApiResponse<void>> {
    return request<void>(`/api/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  async toggleActive(userId: string, isActive: boolean): Promise<ApiResponse<void>> {
    return request<void>(`/api/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  },
};

// Invitations API
export const invitationsApi = {
  async create(vendorId: string, assessmentId: string, email: string, sendEmailNotification = true): Promise<ApiResponse<{ token: string }>> {
    const result = await request<{ invitation: { token: string } }>('/api/invitations', {
      method: 'POST',
      body: JSON.stringify({ vendorId, assessmentId, email, sendEmailNotification }),
    });
    if (result.data?.invitation) {
      return { data: result.data.invitation };
    }
    return { error: result.error, message: result.message };
  },
};

// Questions API
export interface Question {
  id: string;
  category: string;
  question: string;
  type: string;
  options?: string[] | null;
  weight: number;
  risk_impact: string;
  display_order: number;
}

export const questionsApi = {
  async getAll(): Promise<ApiResponse<Question[]>> {
    const result = await request<{ data: Question[] }>('/api/questions');
    if (result.data?.data) {
      return { data: result.data.data };
    }
    // Handle case where result.data is already an array or return empty array on error
    if (Array.isArray(result.data)) {
      return { data: result.data };
    }
    if (result.error) {
      return { data: [] };
    }
    return { error: result.error, message: result.message };
  },

  async create(question: Omit<Question, 'id'>): Promise<ApiResponse<Question>> {
    return request<Question>('/api/questions', {
      method: 'POST',
      body: JSON.stringify(question),
    });
  },

  async update(id: string, question: Partial<Question>): Promise<ApiResponse<Question>> {
    return request<Question>(`/api/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(question),
    });
  },

  async delete(id: string): Promise<ApiResponse<void>> {
    return request<void>(`/api/questions/${id}`, {
      method: 'DELETE',
    });
  },
};

// Evidence API
export interface EvidenceDocument {
  id: string;
  assessment_id: string;
  question_id?: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  file_hash?: string;
  description?: string;
  uploaded_by: string;
  uploaded_by_name?: string;
  uploaded_by_email?: string;
  is_vendor_upload: boolean;
  status: 'pending' | 'validated' | 'rejected';
  validated_by?: string;
  validated_at?: string;
  validation_notes?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export const evidenceApi = {
  async upload(
    assessmentId: string,
    file: File,
    questionId?: string,
    description?: string
  ): Promise<ApiResponse<EvidenceDocument>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('assessment_id', assessmentId);
    if (questionId) formData.append('question_id', questionId);
    if (description) formData.append('description', description);

    const token = localStorage.getItem('auth_token');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS * 2); // Longer timeout for uploads

    try {
      const response = await fetch(`${API_BASE_URL}/api/evidence`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || data.message || 'Upload failed' };
      }

      return { data: data.evidence };
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Evidence upload error:', error);
      return { error: error instanceof Error ? error.message : 'Upload failed' };
    }
  },

  async getByAssessment(assessmentId: string): Promise<ApiResponse<EvidenceDocument[]>> {
    const result = await request<{ evidence: EvidenceDocument[] }>(`/api/evidence/${assessmentId}`);
    if (result.data?.evidence) {
      return { data: result.data.evidence };
    }
    // Handle case where result.data exists but evidence is missing, or return empty array on error
    if (result.error) {
      return { data: [] };
    }
    return { error: result.error, message: result.message };
  },

  async download(id: string): Promise<Blob> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/evidence/${id}/download`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Download failed');
    }

    return await response.blob();
  },

  async verify(id: string, status: 'validated' | 'rejected', validationNotes?: string): Promise<ApiResponse<EvidenceDocument>> {
    return request<EvidenceDocument>(`/api/evidence/${id}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ status, validation_notes: validationNotes }),
    });
  },

  async delete(id: string): Promise<ApiResponse<void>> {
    return request<void>(`/api/evidence/${id}`, {
      method: 'DELETE',
    });
  },
};

// Audit Logs API
export interface AuditLog {
  id: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  resource_name?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogStats {
  totalActions: number;
  activeUsers: number;
  resourcesAccessed: number;
  avgActionsPerUser: number;
  topActions?: Array<{ action: string; count: number }>;
  resourcesBreakdown?: Array<{ resource_type: string; count: number }>;
}

export const auditLogApi = {
  async get(filters?: AuditLogFilters): Promise<ApiResponse<{ logs: AuditLog[]; pagination: { total: number; limit: number; offset: number } }>> {
    const params = new URLSearchParams();
    if (filters?.userId) params.append('userId', filters.userId);
    if (filters?.action) params.append('action', filters.action);
    if (filters?.resourceType) params.append('resourceType', filters.resourceType);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.offset) params.append('offset', String(filters.offset));

    const queryString = params.toString();
    return request(`/api/audit-logs${queryString ? `?${queryString}` : ''}`);
  },

  async getByUser(userId: string, limit?: number, offset?: number): Promise<ApiResponse<{ logs: AuditLog[]; pagination: { total: number; limit: number; offset: number } }>> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', String(limit));
    if (offset) params.append('offset', String(offset));
    
    const queryString = params.toString();
    return request(`/api/audit-logs/user/${userId}${queryString ? `?${queryString}` : ''}`);
  },

  async export(startDate?: string, endDate?: string, format: 'json' | 'csv' = 'json'): Promise<Blob> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    params.append('format', format);

    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/audit-logs/export?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    return await response.blob();
  },

  async getStats(days?: number): Promise<ApiResponse<AuditLogStats>> {
    const params = days ? `?days=${days}` : '';
    return request<AuditLogStats>(`/api/audit-logs/stats${params}`);
  },
};

// Remediation API
// Columns mirror `remediation_items` (init.sql) and the SELECTs in
// routes/remediation.js. There is no `finding`/`comments`/`linked_evidence`
// column — the title field is `title`.
export interface RemediationItem {
  id: string;
  assessment_id: string;
  vendor_id: string;
  vendor_name?: string;
  question_id?: string;
  title: string;
  description: string;
  risk_level?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  // Hyphen, not underscore — matches the server writes in routes/remediation.js
  // and the init.sql comment.
  status: 'open' | 'in-progress' | 'completed' | 'verified' | 'closed';
  due_date?: string;
  assigned_to?: string;
  assigned_to_email?: string;
  vendor_contact?: string;
  vendor_response?: string;
  vendor_response_at?: string;
  reviewer_notes?: string;
  verified_by?: string;
  verified_at?: string;
  closed_by?: string;
  closed_at?: string;
  closure_reason?: string;
  created_at: string;
  updated_at: string;
  // No server route reads or writes remediation_comments yet, so this is never
  // populated — kept optional so the detail dialog still compiles.
  comments?: Array<{
    id: string;
    user_id: string;
    user_name?: string;
    comment: string;
    created_at: string;
  }>;
}

export interface CreateRemediationItem {
  assessment_id: string;
  vendor_id?: string;
  question_id?: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  due_date?: string;
  assigned_to?: string;
}

export const remediationApi = {
  async getByAssessment(assessmentId: string): Promise<ApiResponse<RemediationItem[]>> {
    const result = await request<{ remediation: RemediationItem[] }>(`/api/remediation/${assessmentId}`);
    if (result.data?.remediation) {
      return { data: result.data.remediation };
    }
    return { error: result.error, message: result.message };
  },

  async getAll(): Promise<ApiResponse<RemediationItem[]>> {
    const result = await request<{ remediation: RemediationItem[] }>('/api/remediation');
    if (result.data?.remediation) {
      return { data: result.data.remediation };
    }
    return { error: result.error, message: result.message };
  },

  async create(item: CreateRemediationItem): Promise<ApiResponse<RemediationItem>> {
    const result = await request<{ remediation: RemediationItem }>('/api/remediation', {
      method: 'POST',
      body: JSON.stringify(item),
    });
    if (result.data?.remediation) {
      return { data: result.data.remediation };
    }
    return { error: result.error, message: result.message };
  },

  async update(id: string, updates: Partial<RemediationItem>): Promise<ApiResponse<RemediationItem>> {
    const result = await request<{ remediation: RemediationItem }>(`/api/remediation/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    if (result.data?.remediation) {
      return { data: result.data.remediation };
    }
    return { error: result.error, message: result.message };
  },

  async complete(id: string, comment?: string): Promise<ApiResponse<RemediationItem>> {
    const result = await request<{ remediation: RemediationItem }>(`/api/remediation/${id}/complete`, {
      method: 'PATCH',
      body: JSON.stringify({ completion_notes: comment }),
    });
    if (result.data?.remediation) {
      return { data: result.data.remediation };
    }
    return { error: result.error, message: result.message };
  },

  async verify(id: string, comment?: string): Promise<ApiResponse<RemediationItem>> {
    const result = await request<{ remediation: RemediationItem }>(`/api/remediation/${id}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ verified: true, closure_reason: comment }),
    });
    if (result.data?.remediation) {
      return { data: result.data.remediation };
    }
    return { error: result.error, message: result.message };
  },

  async close(id: string, comment?: string): Promise<ApiResponse<RemediationItem>> {
    const result = await request<{ remediation: RemediationItem }>(`/api/remediation/${id}/close`, {
      method: 'PATCH',
      body: JSON.stringify({ closure_reason: comment }),
    });
    if (result.data?.remediation) {
      return { data: result.data.remediation };
    }
    return { error: result.error, message: result.message };
  },

  // No matching route on the server — POST /api/remediation/:id/comment 404s and
  // nothing reads or writes remediation_comments. Left in place pending a route.
  async addComment(id: string, comment: string): Promise<ApiResponse<RemediationItem>> {
    const result = await request<{ remediation: RemediationItem }>(`/api/remediation/${id}/comment`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
    if (result.data?.remediation) {
      return { data: result.data.remediation };
    }
    return { error: result.error, message: result.message };
  },
};

// Review History API
export interface ReviewHistoryItem {
  id: string;
  assessment_id: string;
  reviewer_id: string;
  action: string;
  comments?: string;
  is_internal: boolean;
  risk_score_before?: number;
  risk_score_after?: number;
  risk_level_before?: string;
  risk_level_after?: string;
  reviewer_name?: string;
  reviewer_email?: string;
  created_at: string;
}

export interface AssessmentReviewResponse {
  assessment: {
    id: string;
    vendor_id: string;
    status: string;
    risk_score?: number;
    risk_level?: string;
    overall_score?: number;
    ai_summary?: string;
    strengths?: string;
    weaknesses?: string;
    recommendations?: string;
    category_scores?: Record<string, number>;
    reviewed_at?: string;
    current_reviewer_id?: string;
    created_at: string;
    updated_at: string;
  };
  message: string;
}

export const reviewApi = {
  async review(assessmentId: string, data: {
    action: 'approve' | 'reject' | 'request_revision';
    riskScore?: number;
    riskLevel?: string;
    overallScore?: number;
    aiSummary?: string;
    strengths?: string[];
    weaknesses?: string[];
    recommendations?: string[];
    categoryScores?: Record<string, number>;
    comments?: string;
  }): Promise<ApiResponse<AssessmentReviewResponse>> {
    return request(`/api/assessments/${assessmentId}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getHistory(assessmentId: string): Promise<ApiResponse<{ reviews: ReviewHistoryItem[] }>> {
    return request(`/api/assessments/${assessmentId}/reviews`);
  },

  async addComment(assessmentId: string, comment: string, isInternal = true): Promise<ApiResponse<{ comment: ReviewHistoryItem; message: string }>> {
    return request(`/api/assessments/${assessmentId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment, isInternal }),
    });
  },
};

// Reports API
export const reportsApi = {
  async downloadPdf(assessmentId: string): Promise<Blob> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/reports/assessment/${assessmentId}/pdf`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to download PDF');
    }

    return await response.blob();
  },

  async downloadExcel(assessmentId: string): Promise<Blob> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/reports/assessment/${assessmentId}/excel`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to download Excel');
    }

    return await response.blob();
  },

  async downloadVendorSummaryExcel(): Promise<Blob> {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/reports/vendors/summary/excel`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to download vendor summary');
    }

    return await response.blob();
  },
};

// Notifications API
// Shape mirrors the notifications table (init.sql) and routes/notifications.js:
// the text fields are `subject`/`body` and there is no `category` column.
export interface Notification {
  id: string;
  user_id?: string | null;
  recipient_email?: string | null;
  template_name?: string | null;
  type: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  subject?: string | null;
  body: string;
  metadata?: Record<string, unknown> | null;
  status: 'pending' | 'sent' | 'failed' | 'read';
  read_at?: string | null;
  created_at: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables?: string[];
  created_at: string;
  updated_at: string;
}

export const notificationsApi = {
  async getAll(limit?: number, offset?: number, unreadOnly?: boolean): Promise<ApiResponse<{ 
    notifications: Notification[]; 
    pagination: { total: number; limit: number; offset: number };
    unreadCount: number;
  }>> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', String(limit));
    if (offset) params.append('offset', String(offset));
    if (unreadOnly) params.append('unreadOnly', 'true');
    
    const queryString = params.toString();
    return request(`/api/notifications${queryString ? `?${queryString}` : ''}`);
  },

  async markAsRead(id: string): Promise<ApiResponse<{ notification: Notification }>> {
    return request(`/api/notifications/${id}/read`, {
      method: 'PATCH',
    });
  },

  async markAllAsRead(): Promise<ApiResponse<{ updated: number; message: string }>> {
    return request('/api/notifications/read-all', {
      method: 'PATCH',
    });
  },

  async getUnreadCount(): Promise<ApiResponse<{ unreadCount: number }>> {
    return request('/api/notifications/unread-count');
  },

  async getTemplates(): Promise<ApiResponse<{ templates: NotificationTemplate[] }>> {
    return request('/api/notifications/templates');
  },

  async updateTemplate(id: string, updates: { subject?: string; body?: string; variables?: string[] }): Promise<ApiResponse<{ template: NotificationTemplate }>> {
    return request(`/api/notifications/templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },
};
