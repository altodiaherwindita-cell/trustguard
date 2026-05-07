import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi, UserProfile } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function SettingsPage() {
  const { isAdmin, user } = useAuth();
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    (async () => {
      const result = await usersApi.getAll();
      setMembers(result.data || []);
      setLoading(false);
    })();
  }, [isAdmin]);

  const changeRole = async (userId: string, newRole: string) => {
    if (userId === user?.id && newRole !== 'admin') {
      return toast.error("You cannot remove your own admin role");
    }
    const result = await usersApi.updateRole(userId, newRole);
    if (result.error) return toast.error(result.error);
    setMembers(prev => prev.map(m => m.id === userId ? { ...m, roles: [newRole] } : m));
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
