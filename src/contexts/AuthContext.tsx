import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi } from '@/lib/api';

type Role = 'admin' | 'tprm_analyst' | 'vendor';

interface User {
  id: string;
  email: string;
  fullName?: string;
  company?: string;
  roles: Role[];
  mustChangePassword?: boolean;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  error: string | null;
  isTPRM: boolean;
  isAdmin: boolean;
  isVendor: boolean;
  signOut: () => Promise<void>;
  setUserFromToken: (userData: User) => void;
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
          if (mounted) {
            setLoading(false);
          }
          return;
        }

        // Get current user from API
        const result = await authApi.getCurrentUser();

        if (!mounted) return;

        if (result.error) {
          console.error('Auth error:', result.error);
          // Clear storage on auth error (including session expiration)
          authApi.clearStorage();
          if (mounted) {
            setLoading(false);
          }
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
            mustChangePassword: (apiUser as any).mustChangePassword,
          });
          // Update stored user to match API response
          localStorage.setItem('auth_user', JSON.stringify(apiUser));
        }
        setLoading(false);
      } catch (err) {
        console.error('Auth initialization error:', err);
        // Fallback to stored user on error
        const storedUser = authApi.getStoredUser();
        if (storedUser && mounted) {
          setUser({
            id: storedUser.id,
            email: storedUser.email,
            fullName: storedUser.fullName,
            company: storedUser.company,
            roles: storedUser.roles as Role[],
            mustChangePassword: (storedUser as any).mustChangePassword,
          });
        } else {
          authApi.clearStorage();
        }
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth-user-changed events (e.g., after login)
    const handleAuthUserChanged = () => {
      const storedUser = authApi.getStoredUser();
      if (storedUser && mounted) {
        setUser({
          id: storedUser.id,
          email: storedUser.email,
          fullName: storedUser.fullName,
          company: storedUser.company,
          roles: storedUser.roles as Role[],
          mustChangePassword: (storedUser as any).mustChangePassword,
        });
      }
    };

    // Listen for session expiration events
    const handleSessionExpired = () => {
      console.log('Session expired, clearing user state');
      if (mounted) {
        setUser(null);
        authApi.clearStorage();
      }
    };

    window.addEventListener('auth-user-changed', handleAuthUserChanged);
    window.addEventListener('auth-session-expired', handleSessionExpired);

    return () => {
      mounted = false;
      window.removeEventListener('auth-user-changed', handleAuthUserChanged);
      window.removeEventListener('auth-session-expired', handleSessionExpired);
    };
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
    setUserFromToken: setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
