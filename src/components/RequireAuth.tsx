import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export function RequireAuth({ children, role }: { children: ReactNode; role?: 'tprm' | 'admin' }) {
  const { session, loading, isTPRM, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to={`/auth?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (role === 'tprm' && !isTPRM) return <Navigate to="/" replace />;
  if (role === 'admin' && !isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}
