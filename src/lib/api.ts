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
  roles: string[];
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
    
    // Handle 401 Unauthorized - clear session and trigger logout
    if (response.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.dispatchEvent(new CustomEvent('auth-session-expired'));
      return { error: 'Session expired. Please sign in again.' };
    }
    
    const data = await response.json();

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
    return result;
  },

  async getById(id: string): Promise<ApiResponse<Vendor>> {
    const result = await request<{ vendor: Vendor }>(`/api/vendors/${id}`);
    if (result.data) {
      return { data: result.data.vendor };
    }
    return result;
  },

  async create(vendor: Omit<Vendor, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<Vendor>> {
    const result = await request<{ vendor: Vendor }>('/api/vendors', {
      method: 'POST',
      body: JSON.stringify(vendor),
    });
    if (result.data) {
      return { data: result.data.vendor };
    }
    return result;
  },

  async update(id: string, vendor: Partial<Vendor>): Promise<ApiResponse<Vendor>> {
    const result = await request<{ vendor: Vendor }>(`/api/vendors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(vendor),
    });
    if (result.data) {
      return { data: result.data.vendor };
    }
    return result;
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
    return result;
  },

  async getById(id: string): Promise<ApiResponse<Assessment>> {
    const result = await request<{ assessment: Assessment }>(`/api/assessments/${id}`);
    if (result.data) {
      return { data: result.data.assessment };
    }
    return result;
  },

  async create(assessment: { vendor_id: string; status?: string }): Promise<ApiResponse<Assessment>> {
    const result = await request<{ assessment: Assessment }>('/api/assessments', {
      method: 'POST',
      body: JSON.stringify(assessment),
    });
    if (result.data) {
      return { data: result.data.assessment };
    }
    return result;
  },

  async update(id: string, assessment: Partial<Assessment>): Promise<ApiResponse<Assessment>> {
    const result = await request<{ assessment: Assessment }>(`/api/assessments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(assessment),
    });
    if (result.data) {
      return { data: result.data.assessment };
    }
    return result;
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
    return result;
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
    // Handle case where result.data exists but data array is missing, or return empty array on error
    if (result.error) {
      return { data: [] };
    }
    return result;
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
    return request<EvidenceDocument[]>(`/api/evidence/${assessmentId}`);
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

  async getStats(days?: number): Promise<ApiResponse<any>> {
    const params = days ? `?days=${days}` : '';
    return request(`/api/audit-logs/stats${params}`);
  },
};

// Remediation API
export interface RemediationItem {
  id: string;
  assessment_id: string;
  question_id?: string;
  finding: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'completed' | 'verified' | 'closed';
  due_date?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  assigned_to_email?: string;
  created_by: string;
  created_by_name?: string;
  completed_at?: string;
  verified_at?: string;
  closed_at?: string;
  closed_by?: string;
  comments: Array<{
    id: string;
    user_id: string;
    user_name?: string;
    comment: string;
    created_at: string;
  }>;
  linked_evidence: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateRemediationItem {
  assessment_id: string;
  question_id?: string;
  finding: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  due_date?: string;
  assigned_to?: string;
}

export const remediationApi = {
  async getByAssessment(assessmentId: string): Promise<ApiResponse<RemediationItem[]>> {
    return request<RemediationItem[]>(`/api/remediation/${assessmentId}`);
  },

  async getAll(): Promise<ApiResponse<RemediationItem[]>> {
    return request<RemediationItem[]>('/api/remediation');
  },

  async create(item: CreateRemediationItem): Promise<ApiResponse<RemediationItem>> {
    return request<RemediationItem>('/api/remediation', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  },

  async update(id: string, updates: Partial<RemediationItem>): Promise<ApiResponse<RemediationItem>> {
    return request<RemediationItem>(`/api/remediation/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async complete(id: string, comment?: string): Promise<ApiResponse<RemediationItem>> {
    return request<RemediationItem>(`/api/remediation/${id}/complete`, {
      method: 'PATCH',
      body: JSON.stringify({ comment }),
    });
  },

  async verify(id: string, comment?: string): Promise<ApiResponse<RemediationItem>> {
    return request<RemediationItem>(`/api/remediation/${id}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ comment }),
    });
  },

  async close(id: string, comment?: string): Promise<ApiResponse<RemediationItem>> {
    return request<RemediationItem>(`/api/remediation/${id}/close`, {
      method: 'PATCH',
      body: JSON.stringify({ comment }),
    });
  },

  async addComment(id: string, comment: string): Promise<ApiResponse<RemediationItem>> {
    return request<RemediationItem>(`/api/remediation/${id}/comment`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  },
};

// Notifications API
export interface Notification {
  id: string;
  user_id?: string;
  recipient_email?: string;
  type: 'info' | 'warning' | 'error' | 'success';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: 'assessment' | 'remediation' | 'evidence' | 'system' | 'security';
  title: string;
  message: string;
  action_url?: string;
  metadata?: Record<string, any>;
  status: 'pending' | 'sent' | 'read' | 'expired';
  read_at?: string;
  expires_at?: string;
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
