import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Shield, Loader2 } from 'lucide-react';

/**
 * The four bands the scoring service actually produces, in order, with the
 * thresholds from riskScoring.js. The scale below renders these and nothing
 * else, so the two cannot drift apart without this array changing.
 */
const RISK_BANDS = [
  { label: 'Low', className: 'bg-risk-low' },
  { label: 'Medium', className: 'bg-risk-medium' },
  { label: 'High', className: 'bg-risk-high' },
  { label: 'Critical', className: 'bg-risk-critical' },
];

const SCALE_TICKS = [0, 25, 50, 75, 100];

export default function AuthPage() {
  const { user, setUserFromToken } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '/';
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (user && !user.mustChangePassword) navigate(redirect, { replace: true });
  }, [user, navigate, redirect]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await authApi.login({ email, password });
    setLoading(false);
    if (result.error) return toast.error(result.error);

    // Update user state immediately after successful login
    if (result.data?.user) {
      localStorage.setItem('auth_user', JSON.stringify(result.data.user));
      // Directly update the AuthContext state
      setUserFromToken(result.data.user);

      // Redirect to change password if required
      if (result.data.user.mustChangePassword) {
        toast.info('Set a new password to continue');
        navigate('/change-password', { replace: true });
        return;
      }
    }

    toast.success('Signed in');
    navigate(redirect, { replace: true });
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.15fr_1fr]">
      {/* Identity panel. Wider than the form on purpose: the product's model is
          the first thing you see, not a centred card floating in empty space. */}
      <section className="relative flex flex-col justify-between px-8 py-10 sm:px-12 lg:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: 'var(--gradient-signal-glow)', opacity: 0.45 }}
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-[var(--shadow-signal)]">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <span
              className="text-lg font-semibold tracking-tight text-foreground"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              TrustGuard
            </span>
          </div>

          <h1
            className="mt-14 max-w-lg text-[2rem] font-semibold leading-[1.08] tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Risk you can put a number on.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
            Assess every third party against one model, score it from 0 to 100, and track
            what gets fixed. The audit trail writes itself.
          </p>
        </div>

        {/* The signature: the scoring model itself, drawn. Higher is worse. */}
        <div className="relative mt-14 max-w-md">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Risk score
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/60">
              higher is worse
            </span>
          </div>

          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-muted/40">
            {RISK_BANDS.map((band, i) => (
              <div
                key={band.label}
                className={cn('auth-band h-full w-1/4 motion-reduce:animate-none', band.className)}
                style={{ animationDelay: `${280 + i * 90}ms` }}
              />
            ))}
          </div>

          <div className="mt-2.5 flex">
            {RISK_BANDS.map((band) => (
              <span
                key={band.label}
                className="w-1/4 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70"
              >
                {band.label}
              </span>
            ))}
          </div>

          <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground/50">
            {SCALE_TICKS.map((tick) => (
              <span key={tick}>{tick}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Form panel. The seam on its left edge repeats the four band colors as a
          vertical rule — the same model, continued. Horizontal on narrow screens. */}
      <section className="relative flex items-center justify-center border-t border-card-border px-6 py-14 sm:px-12 lg:border-l lg:border-t-0">
        <div
          aria-hidden="true"
          className="auth-seam pointer-events-none absolute left-0 top-0 hidden h-full w-px lg:block"
        />

        <div className="w-full max-w-sm">
          <h2
            className="text-xl font-semibold tracking-tight text-foreground"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Sign in
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Use your work email to continue.
          </p>

          <form onSubmit={handleSignIn} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 text-xs leading-relaxed text-muted-foreground/70">
            Sessions end after 15 minutes of inactivity, and ask for a new sign-in every
            8 hours.
          </p>
        </div>
      </section>
    </div>
  );
}
