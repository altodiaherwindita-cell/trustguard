import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import {
  usersApi, settingsApi, UserProfile,
  AppSettings, SettingsStatus, SettingsResponse,
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Users, Loader2, Mail, Sparkles, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

// A settings form field. Every control on this page is label + input + optional
// hint, so the wrapper earns its keep after the second one.
//
// htmlFor is required: a bare <Label> is not associated with anything, so a
// screen reader announces the placeholder instead of the field name. The caller
// passes the same id to its control.
function Field({ label, hint, htmlFor, children }: {
  label: string; hint?: string; htmlFor: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

/** Configured / not-configured pill. Green reads as "working", amber as "incomplete". */
function StatusPill({ ok, okText, badText }: { ok: boolean; okText: string; badText: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        ok ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning',
      )}
    >
      {ok ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {ok ? okText : badText}
    </span>
  );
}

const EMAIL_FIELDS: Array<{ key: keyof AppSettings; label: string; placeholder?: string }> = [
  { key: 'SMTP_HOST', label: 'SMTP host', placeholder: 'smtp.example.com' },
  { key: 'SMTP_PORT', label: 'Port', placeholder: '587' },
  { key: 'SMTP_USER', label: 'Username', placeholder: 'notifications@example.com' },
  { key: 'SMTP_FROM', label: 'From address', placeholder: 'TrustGuard <noreply@example.com>' },
];

const AI_FIELDS: Array<{ key: keyof AppSettings; label: string; placeholder?: string }> = [
  { key: 'AI_MODEL', label: 'Model', placeholder: 'gpt-4o-mini' },
  { key: 'AI_BASE_URL', label: 'Base URL', placeholder: 'https://api.openai.com/v1/chat/completions' },
];

// Each card saves only its own keys. Posting the whole object meant an unsaved
// edit in the other card rode along on whatever Save was clicked first.
const EMAIL_KEYS: Array<keyof AppSettings> = [
  ...EMAIL_FIELDS.map((f) => f.key),
  'SMTP_SECURE',
  'SMTP_REJECT_UNAUTHORIZED',
];
const AI_KEYS: Array<keyof AppSettings> = [...AI_FIELDS.map((f) => f.key), 'AI_PROVIDER'];

function pick(settings: AppSettings, keys: Array<keyof AppSettings>) {
  return Object.fromEntries(keys.map((k) => [k, settings[k]]));
}

/** DOM id for a setting's control, so <Label htmlFor> can point at it. */
const fieldId = (key: keyof AppSettings) => `setting-${key.toLowerCase()}`;

export function SettingsPage() {
  const { isAdmin, user } = useAuth();
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [secretsSet, setSecretsSet] = useState<SettingsResponse['secretsSet']>({ SMTP_PASSWORD: false, AI_API_KEY: false });
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  // New secret values, held apart from `settings` so a stored secret is never
  // round-tripped: blank here means "leave whatever is saved alone".
  const [smtpPassword, setSmtpPassword] = useState('');
  const [aiApiKey, setAiApiKey] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    (async () => {
      const [people, config] = await Promise.all([usersApi.getAll(), settingsApi.get()]);
      setMembers(people.data || []);
      if (config.data) {
        setSettings(config.data.settings);
        setSecretsSet(config.data.secretsSet);
        setStatus(config.data.status);
      }
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

  const toggleUserActive = async (userId: string, currentlyActive: boolean) => {
    const result = await usersApi.toggleActive(userId, !currentlyActive);
    if (result.error) return toast.error(result.error);
    setMembers(prev => prev.map(m => m.id === userId ? { ...m, is_active: !currentlyActive } : m));
    toast.success(`User ${!currentlyActive ? 'activated' : 'deactivated'}`);
  };

  const applyResult = (result: { data?: SettingsResponse; error?: string }, label: string) => {
    if (result.error) return toast.error(result.error);
    if (result.data) {
      setSettings(result.data.settings);
      setSecretsSet(result.data.secretsSet);
      setStatus(result.data.status);
    }
    toast.success(`${label} saved`);
  };

  const saveEmail = async () => {
    if (!settings) return;
    setBusy('email');
    const result = await settingsApi.update({
      ...pick(settings, EMAIL_KEYS),
      ...(smtpPassword ? { SMTP_PASSWORD: smtpPassword } : {}),
    });
    setBusy(null);
    if (!result.error) setSmtpPassword('');
    applyResult(result, 'Email settings');
  };

  const saveAi = async () => {
    if (!settings) return;
    setBusy('ai');
    const result = await settingsApi.update({
      ...pick(settings, AI_KEYS),
      ...(aiApiKey ? { AI_API_KEY: aiApiKey } : {}),
    });
    setBusy(null);
    if (!result.error) setAiApiKey('');
    applyResult(result, 'AI settings');
  };

  const test = async (kind: 'email' | 'ai') => {
    setBusy(`test-${kind}`);
    const result = kind === 'email' ? await settingsApi.testEmail() : await settingsApi.testAi();
    setBusy(null);
    if (result.error) return toast.error(result.error);
    toast.success(result.data?.message || 'Connection works');
  };

  const set = (key: keyof AppSettings, value: string) =>
    setSettings(prev => (prev ? { ...prev, [key]: value } : prev));

  if (!isAdmin) {
    return (
      <div className="p-8 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Contact your admin to change team roles or server configuration.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your team, email delivery, and AI provider</p>
      </motion.div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Team & Roles</CardTitle>
          <CardDescription>Assign roles to users. Vendors are limited to their own assessment.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
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

      {settings && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5 text-primary" /> Email delivery</CardTitle>
                  <CardDescription>
                    SMTP used for invitations and scheduled reminders. Blank fields fall back to
                    the server's environment variables.
                  </CardDescription>
                </div>
                {status && (
                  <StatusPill
                    ok={status.email.configured}
                    okText="Configured"
                    badText={`Missing ${status.email.missing.join(', ')}`}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {EMAIL_FIELDS.map(({ key, label, placeholder }) => (
                  <Field key={key} label={label} htmlFor={fieldId(key)}>
                    <Input
                      id={fieldId(key)}
                      value={settings[key]}
                      placeholder={placeholder}
                      onChange={(e) => set(key, e.target.value)}
                    />
                  </Field>
                ))}
                <Field
                  label="Password"
                  htmlFor="setting-smtp-password"
                  hint={secretsSet.SMTP_PASSWORD ? 'A password is saved. Leave blank to keep it.' : undefined}
                >
                  <Input
                    id="setting-smtp-password"
                    type="password"
                    autoComplete="new-password"
                    value={smtpPassword}
                    placeholder={secretsSet.SMTP_PASSWORD ? '••••••••' : 'SMTP password'}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                  />
                </Field>
              </div>

              <fieldset className="flex flex-wrap gap-6">
                <legend className="sr-only">TLS options</legend>
                <div className="flex items-center gap-3">
                  <Switch
                    id="smtp-secure"
                    checked={settings.SMTP_SECURE === 'true'}
                    onCheckedChange={(v) => set('SMTP_SECURE', String(v))}
                  />
                  <Label htmlFor="smtp-secure" className="cursor-pointer">Implicit TLS (port 465)</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id="smtp-reject"
                    checked={settings.SMTP_REJECT_UNAUTHORIZED !== 'false'}
                    onCheckedChange={(v) => set('SMTP_REJECT_UNAUTHORIZED', String(v))}
                  />
                  <Label htmlFor="smtp-reject" className="cursor-pointer">Verify TLS certificate</Label>
                </div>
              </fieldset>

              <div className="flex items-center gap-3 pt-2">
                <Button onClick={saveEmail} disabled={busy !== null}>
                  {busy === 'email' && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save
                </Button>
                <Button variant="outline" onClick={() => test('email')} disabled={busy !== null}>
                  {busy === 'test-email' && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send test email
                </Button>
                <span className="text-xs text-muted-foreground">Sends to your own address</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> AI assistant</CardTitle>
                  <CardDescription>
                    Bring your own key. Until a provider and key are set, the assistant page
                    reports that it is unavailable rather than failing silently.
                  </CardDescription>
                </div>
                {status && (
                  <StatusPill ok={status.ai.configured} okText="Configured" badText="Not configured" />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Provider" htmlFor="setting-ai-provider">
                  <Select value={settings.AI_PROVIDER || 'openai'} onValueChange={(v) => set('AI_PROVIDER', v)}>
                    <SelectTrigger id="setting-ai-provider"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {AI_FIELDS.map(({ key, label, placeholder }) => (
                  <Field key={key} label={label} htmlFor={fieldId(key)}>
                    <Input
                      id={fieldId(key)}
                      value={settings[key]}
                      placeholder={placeholder}
                      onChange={(e) => set(key, e.target.value)}
                    />
                  </Field>
                ))}
                <Field
                  label="API key"
                  htmlFor="setting-ai-api-key"
                  hint={secretsSet.AI_API_KEY ? 'A key is saved. Leave blank to keep it.' : undefined}
                >
                  <Input
                    id="setting-ai-api-key"
                    type="password"
                    autoComplete="new-password"
                    value={aiApiKey}
                    placeholder={secretsSet.AI_API_KEY ? '••••••••' : 'sk-…'}
                    onChange={(e) => setAiApiKey(e.target.value)}
                  />
                </Field>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button onClick={saveAi} disabled={busy !== null}>
                  {busy === 'ai' && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save
                </Button>
                <Button variant="outline" onClick={() => test('ai')} disabled={busy !== null}>
                  {busy === 'test-ai' && <Loader2 className="w-4 h-4 animate-spin" />}
                  Test connection
                </Button>
                <span className="text-xs text-muted-foreground">One small request to the provider</span>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Values saved here take precedence over the server's environment variables.
            Clearing a field restores the environment default. Anthropic also needs an
            explicit model — there is no default for it.
          </p>
        </>
      )}
    </div>
  );
}
