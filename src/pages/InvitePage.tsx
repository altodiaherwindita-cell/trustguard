import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { invitationsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Shield, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'invalid' | 'needs-auth' | 'binding' | 'done' | 'wrong-account'>('loading');
  const [info, setInfo] = useState<{ assessment_id: string; vendor_name: string; email: string } | null>(null);
  // Binding must survive a React re-run: AuthContext re-renders on focus and the
  // effect below would otherwise fire a second accept for the same token.
  const bound = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      try {
        const lookup = await invitationsApi.get(token!);
        if (lookup.error || !lookup.data) {
          setStatus('invalid');
          return;
        }
        setInfo(lookup.data);

        if (!user) {
          setStatus('needs-auth');
          return;
        }

        // Signed in. The server is still the authority on whether this account
        // is the invited one — accept is what binds the vendor to the user.
        if (user.email.toLowerCase() !== lookup.data.email.toLowerCase()) {
          setStatus('wrong-account');
          return;
        }

        if (bound.current) return;
        bound.current = true;
        setStatus('binding');

        const accepted = await invitationsApi.accept(token!);
        if (accepted.error) {
          toast.error(accepted.error);
          setStatus('invalid');
          return;
        }

        setStatus('done');
        toast.success('Invitation accepted');
        navigate(`/questionnaire/${accepted.data?.assessment_id || lookup.data.assessment_id}`, { replace: true });
      } catch (err) {
        // Fail closed: a network error must not be treated as a valid invitation.
        console.error('Invitation error:', err);
        setStatus('invalid');
      }
    })();
  }, [token, user, authLoading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-2">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle>Vendor Questionnaire Invitation</CardTitle>
          <CardDescription>TrustGuard TPRM Platform</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {(status === 'loading' || status === 'binding') && <Loader2 className="w-6 h-6 animate-spin mx-auto" />}
          {status === 'invalid' && (
            <p className="text-destructive">This invitation is invalid or expired.</p>
          )}
          {status === 'needs-auth' && (
            <>
              <p className="text-sm text-muted-foreground">
                You've been invited to complete a security questionnaire for <strong>{info?.email}</strong>.
                Sign in or create an account to continue.
              </p>
              <Link to={`/auth?redirect=/invite/${token}`}>
                <Button className="w-full">Sign in / Sign up</Button>
              </Link>
            </>
          )}
          {status === 'wrong-account' && (
            <>
              <p className="text-sm text-muted-foreground">
                This invitation was sent to <strong>{info?.email}</strong>, but you're signed in as{' '}
                <strong>{user?.email}</strong>.
              </p>
              <Link to={`/auth?redirect=/invite/${token}`}>
                <Button className="w-full">Sign in as {info?.email}</Button>
              </Link>
            </>
          )}
          {status === 'done' && (
            <div className="space-y-2">
              <CheckCircle2 className="w-8 h-8 text-success mx-auto" />
              <p>Redirecting to your questionnaire...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
