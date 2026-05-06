import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { RiskScoreResults } from '@/components/RiskScoreResults';
import { RiskScoreResult } from '@/lib/riskScoring';
import {
  FileText, ChevronRight, ChevronLeft, Shield, Lock, AlertCircle, FileCheck, Server,
  CheckCircle2, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

const categoryIcons: Record<string, React.ElementType> = {
  'Data Protection': Lock, 'Access Control': Shield, 'Incident Response': AlertCircle,
  'Compliance': FileCheck, 'Security Operations': Server, 'Business Continuity': CheckCircle2,
};

type Question = {
  id: string; category: string; question: string; type: string;
  options: string[] | null; weight: number; risk_impact: string; display_order: number;
};

export function QuestionnairePage() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scoreResult, setScoreResult] = useState<RiskScoreResult | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [readonly, setReadonly] = useState(false);

  useEffect(() => {
    if (!assessmentId) return;
    (async () => {
      const [{ data: qs }, { data: assessment }, { data: responses }] = await Promise.all([
        supabase.from('questions').select('*').order('display_order'),
        supabase.from('assessments').select('*').eq('id', assessmentId).maybeSingle(),
        supabase.from('assessment_responses').select('question_id, answer').eq('assessment_id', assessmentId),
      ]);
      setQuestions((qs || []) as Question[]);
      const map: Record<string, any> = {};
      for (const r of responses || []) map[r.question_id] = r.answer;
      setAnswers(map);
      if (assessment && (assessment.status === 'submitted' || assessment.status === 'reviewed')) {
        setReadonly(true);
        setScoreResult(buildResultFromAssessment(assessment));
        setAiSummary(assessment.ai_summary);
      }
      setLoading(false);
    })();
  }, [assessmentId]);

  const buildResultFromAssessment = (a: any): RiskScoreResult => ({
    overallScore: a.overall_score ?? 0,
    riskScore: a.risk_score ?? 0,
    riskLevel: (a.risk_level || 'medium') as any,
    categoryScores: (a.category_scores || []).map((c: any) => ({
      category: c.category, score: c.score, weight: 1, questionsAnswered: 0, totalQuestions: 0, riskContribution: 100 - c.score,
    })),
    questionScores: [],
    recommendations: a.recommendations || [],
    strengths: a.strengths || [],
    weaknesses: a.weaknesses || [],
  });

  const categories = [...new Set(questions.map(q => q.category))];
  const currentCategory = categories[currentStep];
  const categoryQuestions = questions.filter(q => q.category === currentCategory);
  const progress = categories.length ? ((currentStep + 1) / categories.length) * 100 : 0;
  const CategoryIcon = categoryIcons[currentCategory] || FileText;

  const handleAnswer = async (qId: string, answer: any) => {
    setAnswers(prev => ({ ...prev, [qId]: answer }));
    // Autosave
    await supabase.from('assessment_responses').upsert(
      { assessment_id: assessmentId, question_id: qId, answer, updated_at: new Date().toISOString() },
      { onConflict: 'assessment_id,question_id' }
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('submit-assessment', {
      body: { assessmentId },
    });
    setSubmitting(false);
    if (error) return toast.error(error.message || 'Submission failed');
    toast.success('Assessment submitted');
    setAiSummary(data.aiSummary);
    setScoreResult({
      overallScore: data.overall, riskScore: data.risk, riskLevel: data.level,
      categoryScores: (data.categoryScores || []).map((c: any) => ({
        category: c.category, score: c.score, weight: 1, questionsAnswered: 0, totalQuestions: 0, riskContribution: 100 - c.score,
      })),
      questionScores: [],
      recommendations: data.recommendations || [],
      strengths: data.strengths || [],
      weaknesses: data.weaknesses || [],
    });
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  if (submitting) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-accent animate-spin mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Calculating Risk Score</h1>
          <p className="text-muted-foreground">Running scoring + AI analysis...</p>
        </div>
      </div>
    );
  }

  if (scoreResult) {
    return (
      <div className="p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Assessment Results</h1>
            <p className="text-muted-foreground">Risk score and AI analysis</p>
          </div>
        </div>
        {aiSummary && (
          <Card className="mb-6 max-w-4xl mx-auto bg-accent/5 border-accent/20">
            <CardHeader><CardTitle className="text-base">AI Executive Summary</CardTitle></CardHeader>
            <CardContent><p className="text-sm whitespace-pre-wrap">{aiSummary}</p></CardContent>
          </Card>
        )}
        <RiskScoreResults result={scoreResult} vendorName="Vendor Assessment" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Security Questionnaire</h1>
            <p className="text-muted-foreground">Complete the assessment to evaluate cyber risk posture</p>
          </div>
        </div>
      </motion.div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-muted-foreground">Section {currentStep + 1} of {categories.length}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        <motion.div key={currentCategory} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <CategoryIcon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle>{currentCategory}</CardTitle>
                  <CardDescription>{categoryQuestions.length} questions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              {categoryQuestions.map((question, index) => (
                <div key={question.id} className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-sm font-medium">{index + 1}</span>
                    <div className="flex-1">
                      <p className="font-medium mb-1">{question.question}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        question.risk_impact === 'high' ? 'bg-destructive/10 text-destructive' :
                        question.risk_impact === 'medium' ? 'bg-warning/10 text-warning' :
                        'bg-success/10 text-success'
                      }`}>{question.risk_impact} impact</span>
                    </div>
                  </div>
                  <div className="ml-9">
                    {question.type === 'boolean' && (
                      <div className="flex items-center gap-3">
                        <Switch checked={!!answers[question.id]} onCheckedChange={(c) => handleAnswer(question.id, c)} disabled={readonly} />
                        <Label>{answers[question.id] ? 'Yes' : 'No'}</Label>
                      </div>
                    )}
                    {question.type === 'single-choice' && question.options && (
                      <RadioGroup value={answers[question.id] || ''} onValueChange={(v) => handleAnswer(question.id, v)} disabled={readonly}>
                        {question.options.map((option) => (
                          <div key={option} className="flex items-center space-x-3">
                            <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                            <Label htmlFor={`${question.id}-${option}`} className="font-normal cursor-pointer">{option}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}
                    {question.type === 'multiple-choice' && question.options && (
                      <div className="space-y-2">
                        {question.options.map((option) => {
                          const cur = (answers[question.id] as string[]) || [];
                          const checked = cur.includes(option);
                          return (
                            <div key={option} className="flex items-center space-x-3">
                              <Checkbox checked={checked} disabled={readonly}
                                onCheckedChange={(c) => handleAnswer(question.id, c ? [...cur, option] : cur.filter(x => x !== option))} />
                              <Label className="font-normal cursor-pointer">{option}</Label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setCurrentStep(s => Math.max(0, s - 1))} disabled={currentStep === 0} className="gap-2">
          <ChevronLeft className="w-4 h-4" /> Previous
        </Button>
        <div className="text-sm text-muted-foreground">{Object.keys(answers).length} of {questions.length} answered</div>
        {currentStep < categories.length - 1 ? (
          <Button onClick={() => setCurrentStep(s => s + 1)} className="gap-2 bg-gradient-primary hover:opacity-90">
            Next Section <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} className="gap-2 bg-gradient-primary hover:opacity-90" disabled={readonly}>
            Submit Assessment <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
