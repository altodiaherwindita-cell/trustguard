// API Client for TrustGuard AI Backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || data.message || 'Request failed' };
    }

    return { data: data as T };
  } catch (error) {
    console.error('API request error:', error);
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
    return request<Vendor[]>('/api/vendors');
  },

  async getById(id: string): Promise<ApiResponse<Vendor>> {
    return request<Vendor>(`/api/vendors/${id}`);
  },

  async create(vendor: Omit<Vendor, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<Vendor>> {
    return request<Vendor>('/api/vendors', {
      method: 'POST',
      body: JSON.stringify(vendor),
    });
  },

  async update(id: string, vendor: Partial<Vendor>): Promise<ApiResponse<Vendor>> {
    return request<Vendor>(`/api/vendors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(vendor),
    });
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
    return request<(Assessment & { vendors?: { name: string } })[]>('/api/assessments');
  },

  async getById(id: string): Promise<ApiResponse<Assessment>> {
    return request<Assessment>(`/api/assessments/${id}`);
  },

  async create(assessment: { vendor_id: string; status?: string }): Promise<ApiResponse<Assessment>> {
    return request<Assessment>('/api/assessments', {
      method: 'POST',
      body: JSON.stringify(assessment),
    });
  },

  async update(id: string, assessment: Partial<Assessment>): Promise<ApiResponse<Assessment>> {
    return request<Assessment>(`/api/assessments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(assessment),
    });
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
    return request<UserProfile[]>('/api/users');
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
    return request<Question[]>('/api/questions');
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
