import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { assessmentsApi, Assessment } from '@/lib/api';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ClipboardList, Calendar, Bot, ArrowRight, Clock, CheckCircle2, AlertCircle, FileText, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

const statusConfig: Record<string, any> = {
  'not-started': { label: 'Not Started', icon: Clock, className: 'bg-muted text-muted-foreground' },
  'in-progress': { label: 'In Progress', icon: AlertCircle, className: 'bg-warning/10 text-warning' },
  'submitted': { label: 'Submitted', icon: FileText, className: 'bg-accent/10 text-accent' },
  'reviewed': { label: 'Reviewed', icon: CheckCircle2, className: 'bg-success/10 text-success' },
};

export function AssessmentsPage() {
  const [assessments, setAssessments] = useState<(Assessment & { vendors?: { name: string }; risk_score?: number; risk_level?: string; ai_summary?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const result = await assessmentsApi.getAll();
      setAssessments(result.data || []);
      setLoading(false);
    })();
  }, []);

  const markReviewed = async (id: string) => {
    const result = await assessmentsApi.update(id, { status: 'reviewed' });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setAssessments(prev => prev.map(a => a.id === id ? { ...a, status: 'reviewed' } : a));
    toast.success('Assessment marked as reviewed');
  };

  return (
    <div className="p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight">Assessments</h1>
        <p className="text-muted-foreground mt-1">Track and review vendor risk assessments</p>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(statusConfig).map(([key, config]) => {
          const count = assessments.filter(a => a.status === key).length;
          const Icon = config.icon;
          return (
            <Card key={key}>
              <CardContent className="pt-6 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{config.label}</p>
                  <p className="text-2xl font-bold mt-1">{count}</p>
                </div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.className}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="w-5 h-5 text-primary" /> All Assessments</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
          ) : assessments.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No assessments yet. Send a questionnaire from the Vendors page.</p>
          ) : (
            <div className="space-y-4">
              {assessments.map((a) => {
                const cfg = statusConfig[a.status] || statusConfig['not-started'];
                const Icon = cfg.icon;
                return (
                  <div key={a.id} className="p-6 rounded-xl border">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg">{a.vendors?.name || 'Unknown'}</h3>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          Created {new Date(a.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {a.risk_score != null && <RiskBadge level={a.risk_level} score={a.risk_score} showScore />}
                        <Badge className={cfg.className}><Icon className="w-3 h-3 mr-1" />{cfg.label}</Badge>
                      </div>
                    </div>
                    {a.ai_summary && (
                      <div className="mb-4 p-4 rounded-lg bg-accent/5 border border-accent/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Bot className="w-4 h-4 text-accent" />
                          <span className="text-sm font-medium text-accent">AI Summary</span>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.ai_summary}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-2">
                      <Link to={`/questionnaire/${a.id}`}>
                        <Button variant="outline" size="sm" className="gap-2">View Details <ArrowRight className="w-4 h-4" /></Button>
                      </Link>
                      {a.status === 'submitted' && (
                        <Button size="sm" onClick={() => markReviewed(a.id)}>Mark Reviewed</Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
