import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi } from '@/lib/api';

type Role = 'admin' | 'tprm_analyst' | 'vendor';

interface User {
  id: string;
  email: string;
  fullName?: string;
  company?: string;
  roles: Role[];
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  error: string | null;
  isTPRM: boolean;
  isAdmin: boolean;
  isVendor: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Check if we have a stored token
        const token = authApi.getToken();
        
        if (!token) {
          setLoading(false);
          return;
        }

        // Get current user from API
        const result = await authApi.getCurrentUser();
        
        if (!mounted) return;

        if (result.error) {
          console.error('Auth error:', result.error);
          authApi.clearStorage();
          setLoading(false);
          return;
        }

        const apiUser = result.data?.user;
        if (apiUser) {
          setUser({
            id: apiUser.id,
            email: apiUser.email,
            fullName: apiUser.fullName,
            company: apiUser.company,
            roles: apiUser.roles as Role[],
          });
        }
        setLoading(false);
      } catch (err) {
        console.error('Auth initialization error:', err);
        authApi.clearStorage();
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    };

    initializeAuth();
  }, []);

  const signOut = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setUser(null);
    }
  };

  const value: AuthCtx = {
    user,
    loading,
    error,
    isAdmin: user?.roles.includes('admin') ?? false,
    isTPRM: (user?.roles.includes('admin') ?? false) || (user?.roles.includes('tprm_analyst') ?? false),
    isVendor: user?.roles.includes('vendor') ?? false,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
