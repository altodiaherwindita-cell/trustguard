import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { assessmentsApi, Assessment } from '@/lib/api';
import { reviewApi, reportsApi, ReviewHistoryItem } from '@/lib/api';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2, XCircle, RotateCcw, FileText, Download, Loader2, AlertCircle, CheckCircle, Clock, Bot, FileSpreadsheet, Loader, Eye, AlertTriangle, ClipboardList } from 'lucide-react';

interface StatusConfigItem {
  label: string;
  icon: typeof Clock;
  className: string;
}

const statusConfig: Record<string, StatusConfigItem> = {
  'not-started': { label: 'Not Started', icon: Clock, className: 'bg-muted text-muted-foreground' },
  'in-progress': { label: 'In Progress', icon: AlertCircle, className: 'bg-warning/10 text-warning' },
  'submitted': { label: 'Submitted', icon: FileText, className: 'bg-accent/10 text-accent' },
  'reviewed': { label: 'Reviewed', icon: CheckCircle2, className: 'bg-success/10 text-success' },
  'approved': { label: 'Approved', icon: CheckCircle, className: 'bg-success/10 text-success' },
  'rejected': { label: 'Rejected', icon: XCircle, className: 'bg-destructive/10 text-destructive' },
  'revision-requested': { label: 'Revision Requested', icon: RotateCcw, className: 'bg-warning/10 text-warning' },
};

interface ActionConfigItem {
  label: string;
  icon: typeof CheckCircle2;
  className: string;
  description: string;
}

const actionConfig: Record<string, ActionConfigItem> = {
  approve: { label: 'Approve', icon: CheckCircle2, className: 'bg-success/10 text-success hover:bg-success/20', description: 'Mark assessment as approved and notify vendor' },
  reject: { label: 'Reject', icon: XCircle, className: 'bg-destructive/10 text-destructive hover:bg-destructive/20', description: 'Reject assessment and notify vendor' },
  request_revision: { label: 'Request Revision', icon: RotateCcw, className: 'bg-warning/10 text-warning hover:bg-warning/20', description: 'Request vendor to revise and resubmit assessment' },
};

export function AssessmentsPage() {
  const [assessments, setAssessments] = useState<(Assessment & { vendors?: { name: string }; risk_score?: number; risk_level?: string; ai_summary?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<typeof assessments[0] | null>(null);
  const [reviewHistory, setReviewHistory] = useState<ReviewHistoryItem[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'request_revision'>('approve');
  const [reviewForm, setReviewForm] = useState({
    riskScore: '',
    riskLevel: '',
    overallScore: '',
    aiSummary: '',
    strengths: '',
    weaknesses: '',
    recommendations: '',
    categoryScores: '',
    comments: '',
  });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [downloadingExcel, setDownloadingExcel] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserRole(user.roles?.[0] || null);
      } catch (e) {
        console.error('Failed to parse user', e);
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      const result = await assessmentsApi.getAll();
      setAssessments(result.data || []);
      setLoading(false);
    })();
  }, []);

  const loadReviewHistory = async (assessmentId: string) => {
    setHistoryLoading(true);
    try {
      const result = await reviewApi.getHistory(assessmentId);
      if (result.data?.reviews) {
        setReviewHistory(result.data.reviews);
      } else {
        setReviewHistory([]);
      }
    } catch (error) {
      console.error('Failed to load review history:', error);
      setReviewHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openReviewDialog = (assessment: typeof assessments[0], action: 'approve' | 'reject' | 'request_revision') => {
    setSelectedAssessment(assessment);
    setReviewAction(action);
    setReviewForm({
      riskScore: '',
      riskLevel: '',
      overallScore: '',
      aiSummary: '',
      strengths: '',
      weaknesses: '',
      recommendations: '',
      categoryScores: '',
      comments: '',
    });
    setReviewDialogOpen(true);
  };

  const openHistoryDialog = async (assessment: typeof assessments[0]) => {
    setSelectedAssessment(assessment);
    setHistoryDialogOpen(true);
    await loadReviewHistory(assessment.id);
  };

  const handleReviewSubmit = async () => {
    if (!selectedAssessment) return;

    const config = actionConfig[reviewAction];
    if (!config) return;

    const shouldConfirm = window.confirm(`${config.label} this assessment? ${config.description}`);
    if (!shouldConfirm) return;

    setSubmittingReview(true);
    try {
      const data: {
        action: 'approve' | 'reject' | 'request_revision';
        comments?: string;
        riskScore?: number;
        riskLevel?: string;
        overallScore?: number;
        aiSummary?: string;
        strengths?: string[];
        weaknesses?: string[];
        recommendations?: string[];
        categoryScores?: Record<string, number>;
      } = {
        action: reviewAction,
        comments: reviewForm.comments || undefined,
      };

      if (reviewAction === 'approve') {
        if (reviewForm.riskScore) data.riskScore = Number(reviewForm.riskScore);
        if (reviewForm.riskLevel) data.riskLevel = reviewForm.riskLevel;
        if (reviewForm.overallScore) data.overallScore = Number(reviewForm.overallScore);
        if (reviewForm.aiSummary) data.aiSummary = reviewForm.aiSummary;
        if (reviewForm.strengths) data.strengths = reviewForm.strengths.split('\n').filter(s => s.trim());
        if (reviewForm.weaknesses) data.weaknesses = reviewForm.weaknesses.split('\n').filter(s => s.trim());
        if (reviewForm.recommendations) data.recommendations = reviewForm.recommendations.split('\n').filter(s => s.trim());
        if (reviewForm.categoryScores) {
          try {
            data.categoryScores = JSON.parse(reviewForm.categoryScores);
          } catch (e) {
            toast.error('Invalid category scores JSON format');
            return;
          }
        }
      }

      const result = await reviewApi.review(selectedAssessment.id, data);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`Assessment ${reviewAction.replace('_', ' ')}d successfully`);
      setReviewDialogOpen(false);
      setSelectedAssessment(null);

      // Refresh assessments list
      const refresh = await assessmentsApi.getAll();
      setAssessments(refresh.data || []);
    } catch (error) {
      console.error('Review failed:', error);
      toast.error('Failed to review assessment');
    } finally {
      setSubmittingReview(false);
    }
  };

  const downloadPdf = async (assessmentId: string) => {
    setDownloadingPdf(assessmentId);
    try {
      const blob = await reportsApi.downloadPdf(assessmentId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assessment-${assessmentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('PDF downloaded successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download PDF');
    } finally {
      setDownloadingPdf(null);
    }
  };

  const downloadExcel = async (assessmentId: string) => {
    setDownloadingExcel(assessmentId);
    try {
      const blob = await reportsApi.downloadExcel(assessmentId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assessment-${assessmentId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Excel downloaded successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download Excel');
    } finally {
      setDownloadingExcel(null);
    }
  };

  const isTPRM = userRole === 'admin' || userRole === 'tprm_analyst';
  const canReview = isTPRM;

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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            All Assessments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
            </div>
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
                        <h3 className="font-semibold text-lg">{a.vendor_name || 'Unknown'}</h3>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          Created {new Date(a.created_at).toLocaleDateString()}
                          {a.submitted_at && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <FileText className="w-4 h-4" />
                              Submitted {new Date(a.submitted_at).toLocaleDateString()}
                            </>
                          )}
                          {a.reviewed_at && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <CheckCircle className="w-4 h-4" />
                              Reviewed {new Date(a.reviewed_at).toLocaleDateString()}
                            </>
                          )}
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
                        <Button variant="outline" size="sm" className="gap-2">
                          <Eye className="w-4 h-4" />
                          View Details
                        </Button>
                      </Link>

                      {/* Review Actions for TPRM Analysts when status is 'submitted' */}
                      {canReview && a.status === 'submitted' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openReviewDialog(a, 'approve')}
                            className="gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openReviewDialog(a, 'reject')}
                            className="gap-2 text-destructive border-destructive hover:bg-destructive/10"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openReviewDialog(a, 'request_revision')}
                            className="gap-2 text-warning border-warning hover:bg-warning/10"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Request Revision
                          </Button>
                        </>
                      )}

                      {/* View History Button */}
                      {canReview && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openHistoryDialog(a)}
                          className="gap-2"
                        >
                          <FileText className="w-4 h-4" />
                          History
                        </Button>
                      )}

                      {/* Export Buttons for reviewed/approved/rejected assessments */}
                      {['reviewed', 'approved', 'rejected', 'revision-requested'].includes(a.status) && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadPdf(a.id)}
                            disabled={downloadingPdf === a.id}
                            className="gap-2"
                          >
                            {downloadingPdf === a.id ? (
                              <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                            PDF
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadExcel(a.id)}
                            disabled={downloadingExcel === a.id}
                            className="gap-2"
                          >
                            {downloadingExcel === a.id ? (
                              <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                              <FileSpreadsheet className="w-4 h-4" />
                            )}
                            Excel
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {(() => {
                const ActionIcon = actionConfig[reviewAction].icon;
                const colorClass = actionConfig[reviewAction].className.split(' ').find(c => c.includes('text-')) || '';
                return ActionIcon ? <ActionIcon className={`w-5 h-5 ${colorClass}`} /> : null;
              })()}
              {actionConfig[reviewAction].label} Assessment
            </DialogTitle>
          </DialogHeader>

          {selectedAssessment && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted/30 rounded-lg text-sm">
                <p className="font-medium">Vendor:</p>
                <p>{selectedAssessment.vendor_name || 'Unknown'}</p>
              </div>

              <p className="text-sm text-muted-foreground">
                {actionConfig[reviewAction].description}
              </p>

              {reviewAction === 'approve' && (
                <div className="space-y-4 border-t pt-4">
                  <h4 className="font-medium">Assessment Details (Optional)</h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="riskScore">Risk Score (0-100)</Label>
                      <Input
                        id="riskScore"
                        type="number"
                        min="0"
                        max="100"
                        value={reviewForm.riskScore}
                        onChange={(e) => setReviewForm({...reviewForm, riskScore: e.target.value})}
                        placeholder="e.g., 45"
                      />
                    </div>
                    <div>
                      <Label htmlFor="riskLevel">Risk Level</Label>
                      <Select
                        value={reviewForm.riskLevel}
                        onValueChange={(value) => setReviewForm({...reviewForm, riskLevel: value})}
                      >
                        <SelectTrigger id="riskLevel">
                          <SelectValue placeholder="Select risk level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Critical">Critical</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="overallScore">Overall Score (%)</Label>
                      <Input
                        id="overallScore"
                        type="number"
                        min="0"
                        max="100"
                        value={reviewForm.overallScore}
                        onChange={(e) => setReviewForm({...reviewForm, overallScore: e.target.value})}
                        placeholder="e.g., 85"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="aiSummary">AI Summary</Label>
                    <Textarea
                      id="aiSummary"
                      value={reviewForm.aiSummary}
                      onChange={(e) => setReviewForm({...reviewForm, aiSummary: e.target.value})}
                      placeholder="AI-generated risk summary..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="strengths">Strengths (one per line)</Label>
                      <Textarea
                        id="strengths"
                        value={reviewForm.strengths}
                        onChange={(e) => setReviewForm({...reviewForm, strengths: e.target.value})}
                        placeholder="Strength 1\nStrength 2"
                        rows={4}
                      />
                    </div>
                    <div>
                      <Label htmlFor="weaknesses">Areas for Improvement (one per line)</Label>
                      <Textarea
                        id="weaknesses"
                        value={reviewForm.weaknesses}
                        onChange={(e) => setReviewForm({...reviewForm, weaknesses: e.target.value})}
                        placeholder="Weakness 1\nWeakness 2"
                        rows={4}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="recommendations">Recommendations (one per line)</Label>
                      <Textarea
                        id="recommendations"
                        value={reviewForm.recommendations}
                        onChange={(e) => setReviewForm({...reviewForm, recommendations: e.target.value})}
                        placeholder="Recommendation 1\nRecommendation 2"
                        rows={4}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="categoryScores">Category Scores (JSON)</Label>
                      <Textarea
                        id="categoryScores"
                        value={reviewForm.categoryScores}
                        onChange={(e) => setReviewForm({...reviewForm, categoryScores: e.target.value})}
                        placeholder='{"Security Policy": 85, "Access Control": 70, "Incident Response": 90}'
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Optional: JSON object with category scores</p>
                    </div>
                  </div>
                </div>
              )}

              {reviewAction === 'reject' && (
                <div className="border-t pt-4">
                  <p className="text-sm text-destructive/80 mb-2">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    Rejecting will mark the assessment as rejected and notify the vendor.
                  </p>
                </div>
              )}

              {reviewAction === 'request_revision' && (
                <div className="border-t pt-4">
                  <p className="text-sm text-warning/80 mb-2">
                    <RotateCcw className="w-4 h-4 inline mr-1" />
                    Vendor will be notified to revise and resubmit the assessment.
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="comments">Reviewer Comments</Label>
                <Textarea
                  id="comments"
                  value={reviewForm.comments}
                  onChange={(e) => setReviewForm({...reviewForm, comments: e.target.value})}
                  placeholder="Add comments for the vendor or internal notes..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => { setReviewDialogOpen(false); setSelectedAssessment(null); }} disabled={submittingReview}>
              Cancel
            </Button>
            <Button
              onClick={handleReviewSubmit}
              disabled={submittingReview}
              variant={reviewAction === 'reject' ? 'destructive' : reviewAction === 'approve' ? 'default' : 'secondary'}
              className="gap-2"
            >
              {submittingReview ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {(() => {
                    const ActionIcon = actionConfig[reviewAction].icon;
                    return ActionIcon ? <ActionIcon className="w-4 h-4" /> : null;
                  })()}
                  {actionConfig[reviewAction].label}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Review History
              {selectedAssessment && <span className="text-muted-foreground text-lg font-normal">- {selectedAssessment.vendors?.name}</span>}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {historyLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : reviewHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No review history yet.</p>
            ) : (
              <div className="space-y-4">
                {reviewHistory.map((review) => (
                  <div key={review.id} className="p-4 rounded-lg border">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">
                            {review.action.replace('_', ' ')}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            by {review.reviewer_name || review.reviewer_email || 'Unknown'} on {new Date(review.created_at).toLocaleString()}
                          </span>
                        </div>
                        {review.is_internal === false && (
                          <span className="ml-2 text-xs text-muted-foreground">(External)</span>
                        )}
                      </div>
                    </div>

                    {review.comments && (
                      <div className="p-3 bg-muted/30 rounded-md">
                        <p className="text-sm">{review.comments}</p>
                      </div>
                    )}

                    {(review.risk_score_before !== null || review.risk_score_after !== null) && (
                      <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Risk Score Before:</span>
                          <p className="font-medium">{review.risk_score_before !== null ? review.risk_score_before : 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Risk Score After:</span>
                          <p className="font-medium">{review.risk_score_after !== null ? review.risk_score_after : 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Risk Level Before:</span>
                          <p className="font-medium">{review.risk_level_before || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Risk Level After:</span>
                          <p className="font-medium">{review.risk_level_after || 'N/A'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

