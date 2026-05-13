import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi, UserProfile } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Users, Mail, Bot, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface SettingsState {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  smtpFromEmail: string;
  smtpSecure: boolean;
  aiEnabled: boolean;
  aiModel: string;
  aiApiKey: string;
  aiTemperature: number;
}

export function SettingsPage() {
  const { isAdmin, user } = useAuth();
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SettingsState>({
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
    smtpFromEmail: '',
    smtpSecure: true,
    aiEnabled: true,
    aiModel: 'gpt-4',
    aiApiKey: '',
    aiTemperature: 0.7,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    (async () => {
      const result = await usersApi.getAll();
      setMembers(result.data || []);
      setLoading(false);
    })();
    
    // Load saved settings from localStorage
    const savedSettings = localStorage.getItem('app_settings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error('Failed to load settings', e);
      }
    }
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

  const toggleUserActive = async (userId: string, currentlyActive: boolean) => {
    const result = await usersApi.toggleActive(userId, !currentlyActive);
    if (result.error) return toast.error(result.error);
    setMembers(prev => prev.map(m => m.id === userId ? { ...m, is_active: !currentlyActive } : m));
    toast.success(`User ${!currentlyActive ? 'activated' : 'deactivated'}`);
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      localStorage.setItem('app_settings', JSON.stringify(settings));
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account, team, and application settings</p>
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
                  <div className="flex items-center gap-2">
                    <Select value={m.roles[0]} onValueChange={(v) => changeRole(m.id, v)}>
                      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="tprm_analyst">TPRM Analyst</SelectItem>
                        <SelectItem value="vendor">Vendor</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant={m.is_active ? "outline" : "destructive"}
                      size="sm"
                      onClick={() => toggleUserActive(m.id, m.is_active)}
                    >
                      {m.is_active ? 'Active' : 'Inactive'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5 text-primary" /> Email / SMTP Settings</CardTitle>
          <CardDescription>Configure SMTP server for sending notifications and invitations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtpHost">SMTP Host</Label>
              <Input
                id="smtpHost"
                placeholder="smtp.example.com"
                value={settings.smtpHost}
                onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPort">SMTP Port</Label>
              <Input
                id="smtpPort"
                placeholder="587"
                value={settings.smtpPort}
                onChange={(e) => setSettings({ ...settings, smtpPort: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtpUser">SMTP Username</Label>
              <Input
                id="smtpUser"
                placeholder="username@example.com"
                value={settings.smtpUser}
                onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPassword">SMTP Password</Label>
              <Input
                id="smtpPassword"
                type="password"
                placeholder="••••••••"
                value={settings.smtpPassword}
                onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpFromEmail">From Email</Label>
            <Input
              id="smtpFromEmail"
              placeholder="noreply@example.com"
              value={settings.smtpFromEmail}
              onChange={(e) => setSettings({ ...settings, smtpFromEmail: e.target.value })}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="smtpSecure"
              checked={settings.smtpSecure}
              onCheckedChange={(checked) => setSettings({ ...settings, smtpSecure: checked })}
            />
            <Label htmlFor="smtpSecure">Use SSL/TLS</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bot className="w-5 h-5 text-primary" /> AI Settings</CardTitle>
          <CardDescription>Configure AI model settings for automated risk analysis and summaries</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="aiEnabled"
              checked={settings.aiEnabled}
              onCheckedChange={(checked) => setSettings({ ...settings, aiEnabled: checked })}
            />
            <Label htmlFor="aiEnabled">Enable AI Features</Label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aiModel">AI Model</Label>
              <Select
                value={settings.aiModel}
                onValueChange={(value) => setSettings({ ...settings, aiModel: value })}
              >
                <SelectTrigger id="aiModel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                  <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                  <SelectItem value="gemini-pro">Gemini Pro (Free)</SelectItem>
                  <SelectItem value="gemini-flash">Gemini Flash (Free)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="aiApiKey">API Key</Label>
              <Input
                id="aiApiKey"
                type="password"
                placeholder="sk-..."
                value={settings.aiApiKey}
                onChange={(e) => setSettings({ ...settings, aiApiKey: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="aiTemperature">AI Temperature: {settings.aiTemperature}</Label>
            <input
              id="aiTemperature"
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.aiTemperature}
              onChange={(e) => setSettings({ ...settings, aiTemperature: parseFloat(e.target.value) })}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">Higher values = more creative, lower values = more deterministic</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={savingSettings} className="gap-2">
          {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
