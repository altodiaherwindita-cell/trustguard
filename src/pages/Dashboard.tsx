import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { StatCard } from '@/components/ui/StatCard';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Building2, ClipboardList, AlertTriangle, CheckCircle2, TrendingUp, ArrowRight, Loader2, FileText } from 'lucide-react';

export function Dashboard() {
  const { isTPRM, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, pending: 0, highRisk: 0, completed: 0, avg: 0 });
  const [dist, setDist] = useState({ low: 0, medium: 0, high: 0, critical: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [vendorAssessment, setVendorAssessment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (isTPRM) {
        const [{ data: vendors }, { data: assessments }] = await Promise.all([
          supabase.from('vendors').select('*'),
          supabase.from('assessments').select('*, vendors(name)').order('created_at', { ascending: false }),
        ]);
        const vs = vendors || [];
        const as = assessments || [];
        const scored = vs.filter(v => v.current_risk_score != null);
        const avg = scored.length ? Math.round(scored.reduce((s, v) => s + v.current_risk_score, 0) / scored.length) : 0;
        const counts = { low: 0, medium: 0, high: 0, critical: 0 };
        for (const v of scored) counts[v.current_risk_level as keyof typeof counts]++;
        const total = scored.length || 1;
        const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
        setStats({
          total: vs.length,
          pending: as.filter(a => a.status !== 'reviewed' && a.status !== 'submitted').length + as.filter(a => a.status === 'submitted').length,
          highRisk: vs.filter(v => v.current_risk_level === 'high' || v.current_risk_level === 'critical').length,
          completed: as.filter(a => a.submitted_at && new Date(a.submitted_at) > monthAgo).length,
          avg,
        });
        setDist({
          low: Math.round((counts.low / total) * 100),
          medium: Math.round((counts.medium / total) * 100),
          high: Math.round((counts.high / total) * 100),
          critical: Math.round((counts.critical / total) * 100),
        });
        setRecent(vs.slice(0, 5));
        setPending(as.filter(a => a.status !== 'reviewed').slice(0, 6));
      } else {
        // Vendor: find their vendor + assessment
        const { data: vs } = await supabase.from('vendors').select('*').eq('owner_user_id', user?.id);
        const vendor = vs?.[0];
        if (vendor) {
          const { data: as } = await supabase.from('assessments').select('*').eq('vendor_id', vendor.id).order('created_at', { ascending: false });
          setVendorAssessment({ vendor, assessment: as?.[0] });
        }
      }
      setLoading(false);
    })();
  }, [isTPRM, user]);

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

  if (!isTPRM) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Welcome</h1>
          <p className="text-muted-foreground">Your vendor assessment</p>
        </div>
        {vendorAssessment ? (
          <Card>
            <CardHeader>
              <CardTitle>{vendorAssessment.vendor.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Status: <strong>{vendorAssessment.assessment?.status || 'not started'}</strong></p>
              {vendorAssessment.assessment && (
                <Button onClick={() => navigate(`/questionnaire/${vendorAssessment.assessment.id}`)} className="gap-2">
                  <FileText className="w-4 h-4" />
                  {vendorAssessment.assessment.status === 'submitted' ? 'View Results' : 'Continue Questionnaire'}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card><CardContent className="pt-6 text-center text-muted-foreground">No assessment assigned yet. Wait for an invitation from your TPRM team.</CardContent></Card>
        )}
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Monitor and manage your third-party risk assessments</p>
        </div>
        <Link to="/vendors">
          <Button className="gap-2 bg-gradient-primary hover:opacity-90"><Building2 className="w-4 h-4" /> Add Vendor</Button>
        </Link>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Vendors" value={stats.total} subtitle="Active third parties" icon={Building2} variant="primary" />
        <StatCard title="Pending Assessments" value={stats.pending} subtitle="Awaiting review" icon={ClipboardList} variant="accent" />
        <StatCard title="High Risk Vendors" value={stats.highRisk} subtitle="Require attention" icon={AlertTriangle} variant="warning" />
        <StatCard title="Completed (30d)" value={stats.completed} subtitle="Assessments submitted" icon={CheckCircle2} variant="success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-accent" /> Risk Distribution</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {(['low', 'medium', 'high', 'critical'] as const).map((lvl) => (
              <div key={lvl} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground capitalize">{lvl} Risk</span>
                  <span className="font-medium">{dist[lvl]}%</span>
                </div>
                <Progress value={dist[lvl]} className={`h-2 [&>div]:${
                  lvl === 'low' ? 'bg-success' : lvl === 'medium' ? 'bg-warning' : lvl === 'high' ? 'bg-destructive' : 'bg-risk-critical'
                }`} />
              </div>
            ))}
            <div className="pt-4 border-t flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Average Risk Score</span>
              <span className="text-2xl font-bold">{stats.avg}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5 text-primary" /> Recent Vendors</CardTitle>
            <Link to="/vendors"><Button variant="ghost" size="sm" className="gap-1">View All <ArrowRight className="w-4 h-4" /></Button></Link>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No vendors yet</p>
            ) : (
              <div className="space-y-3">
                {recent.map(v => (
                  <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{v.name}</p>
                      <p className="text-xs text-muted-foreground">{v.category}</p>
                    </div>
                    {v.current_risk_score != null
                      ? <RiskBadge level={v.current_risk_level} score={v.current_risk_score} showScore size="sm" />
                      : <span className="text-xs text-muted-foreground">Not assessed</span>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><ClipboardList className="w-5 h-5 text-accent" /> Pending Assessments</CardTitle>
          <Link to="/assessments"><Button variant="ghost" size="sm" className="gap-1">View All <ArrowRight className="w-4 h-4" /></Button></Link>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No pending assessments</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pending.map((a) => (
                <div key={a.id} className="p-4 rounded-lg border">
                  <p className="font-medium">{a.vendors?.name}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-1">{a.status?.replace('-', ' ')}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
