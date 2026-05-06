import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Member = { id: string; email: string; full_name: string | null; role: string };

export function SettingsPage() {
  const { isAdmin, user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    (async () => {
      const { data: profiles } = await supabase.from('profiles').select('id, email, full_name');
      const { data: roles } = await supabase.from('user_roles').select('user_id, role');
      const roleMap = new Map<string, string>();
      for (const r of roles || []) roleMap.set(r.user_id, r.role);
      setMembers((profiles || []).map(p => ({ ...p, role: roleMap.get(p.id) || 'vendor' })));
      setLoading(false);
    })();
  }, [isAdmin]);

  const changeRole = async (userId: string, newRole: string) => {
    if (userId === user?.id && newRole !== 'admin') {
      return toast.error("You cannot remove your own admin role");
    }
    const { error: delErr } = await supabase.from('user_roles').delete().eq('user_id', userId);
    if (delErr) return toast.error(delErr.message);
    const { error: insErr } = await supabase.from('user_roles').insert({ user_id: userId, role: newRole as any });
    if (insErr) return toast.error(insErr.message);
    setMembers(prev => prev.map(m => m.id === userId ? { ...m, role: newRole } : m));
    toast.success('Role updated');
  };

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and team</p>
      </motion.div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Team & Roles</CardTitle>
          <CardDescription>{isAdmin ? 'Assign roles to users. Vendors are limited to their own assessment.' : 'Only admins can manage team roles.'}</CardDescription>
        </CardHeader>
        <CardContent>
          {!isAdmin ? (
            <p className="text-sm text-muted-foreground">Contact your admin to change roles.</p>
          ) : loading ? (
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
          ) : (
            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{m.full_name || m.email}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <Select value={m.role} onValueChange={(v) => changeRole(m.id, v)}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="tprm_analyst">TPRM Analyst</SelectItem>
                      <SelectItem value="vendor">Vendor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
