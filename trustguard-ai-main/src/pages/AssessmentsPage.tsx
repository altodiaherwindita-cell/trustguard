import { motion } from 'framer-motion';
import { mockAssessments } from '@/data/mockData';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ClipboardList,
  Calendar,
  Bot,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';

const statusConfig = {
  'not-started': { label: 'Not Started', icon: Clock, className: 'bg-muted text-muted-foreground' },
  'in-progress': { label: 'In Progress', icon: AlertCircle, className: 'bg-warning/10 text-warning' },
  'submitted': { label: 'Submitted', icon: FileText, className: 'bg-accent/10 text-accent' },
  'reviewed': { label: 'Reviewed', icon: CheckCircle2, className: 'bg-success/10 text-success' },
};

export function AssessmentsPage() {
  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assessments</h1>
          <p className="text-muted-foreground mt-1">
            Track and review vendor risk assessments
          </p>
        </div>
        <Button className="gap-2 bg-gradient-primary hover:opacity-90">
          <ClipboardList className="w-4 h-4" />
          New Assessment
        </Button>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 md:grid-cols-4"
      >
        {Object.entries(statusConfig).map(([key, config], index) => {
          const count = mockAssessments.filter(a => a.status === key).length;
          const StatusIcon = config.icon;
          return (
            <Card key={key}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{config.label}</p>
                    <p className="text-2xl font-bold mt-1">{count}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.className}`}>
                    <StatusIcon className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </motion.div>

      {/* Assessment Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              All Assessments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockAssessments.map((assessment, index) => {
                const statusInfo = statusConfig[assessment.status];
                const StatusIcon = statusInfo.icon;

                return (
                  <motion.div
                    key={assessment.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-6 rounded-xl border bg-card hover:shadow-card transition-all group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <ClipboardList className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{assessment.vendorName}</h3>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            Created {new Date(assessment.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {assessment.overallScore > 0 && (
                          <RiskBadge
                            level={assessment.riskLevel}
                            score={assessment.overallScore}
                            showScore
                          />
                        )}
                        <Badge className={statusInfo.className}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </div>

                    {assessment.aiSummary && (
                      <div className="mb-4 p-4 rounded-lg bg-accent/5 border border-accent/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Bot className="w-4 h-4 text-accent" />
                          <span className="text-sm font-medium text-accent">AI Summary</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{assessment.aiSummary}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {assessment.submittedAt && (
                          <span>Submitted: {new Date(assessment.submittedAt).toLocaleDateString()}</span>
                        )}
                        {assessment.reviewedAt && (
                          <span>Reviewed: {new Date(assessment.reviewedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" className="gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        View Details
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
