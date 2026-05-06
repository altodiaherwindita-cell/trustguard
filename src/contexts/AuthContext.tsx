import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type Role = 'admin' | 'tprm_analyst' | 'vendor';

interface AuthCtx {
  session: Session | null;
  user: User | null;
  roles: Role[];
  loading: boolean;
  isTPRM: boolean;
  isAdmin: boolean;
  isVendor: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadRoles(s.user.id), 0);
      } else {
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) loadRoles(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadRoles = async (userId: string) => {
    const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId);
    setRoles((data ?? []).map((r: any) => r.role as Role));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value: AuthCtx = {
    session,
    user: session?.user ?? null,
    roles,
    loading,
    isAdmin: roles.includes('admin'),
    isTPRM: roles.includes('admin') || roles.includes('tprm_analyst'),
    isVendor: roles.includes('vendor'),
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
