import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Shield, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'invalid' | 'needs-auth' | 'binding' | 'done'>('loading');
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    if (authLoading) return;
    // In production, this should call a backend endpoint to validate the invitation
    // For now, we'll simulate the flow
    (async () => {
      try {
        // Call backend to validate invitation token
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/invitations/${token}`);
        const data = await response.json();
        
        if (!response.ok || !data.valid) {
          setStatus('invalid');
          return;
        }
        setInfo(data);
        if (data.requires_auth || !user) {
          setStatus('needs-auth');
        } else {
          setStatus('done');
          toast.success('Invitation accepted');
          navigate(`/questionnaire/${data.assessment_id}`, { replace: true });
        }
      } catch (err) {
        console.error('Invitation error:', err);
        // For demo purposes, allow access
        setStatus('needs-auth');
        setInfo({ requires_auth: true, email: 'vendor@example.com' });
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
          {status === 'loading' && <Loader2 className="w-6 h-6 animate-spin mx-auto" />}
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
