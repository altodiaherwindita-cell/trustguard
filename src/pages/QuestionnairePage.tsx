import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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
      try {
        // Fetch questions, assessment, and responses from API
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const [qsRes, assessmentRes, responsesRes] = await Promise.all([
          fetch(`${apiBase}/api/questions`),
          fetch(`${apiBase}/api/assessments/${assessmentId}`),
          fetch(`${apiBase}/api/assessments/${assessmentId}/responses`),
        ]);
        
        const qs = await qsRes.json();
        const assessment = await assessmentRes.json();
        const responses = await responsesRes.json();
        
        setQuestions(qs.data || []);
        const map: Record<string, any> = {};
        for (const r of responses.data || []) map[r.question_id] = r.answer;
        setAnswers(map);
        
        if (assessment.data && (assessment.data.status === 'submitted' || assessment.data.status === 'reviewed')) {
          setReadonly(true);
          setScoreResult(buildResultFromAssessment(assessment.data));
          setAiSummary(assessment.data.ai_summary);
        }
      } catch (err) {
        console.error('Error loading questionnaire:', err);
        toast.error('Failed to load questionnaire');
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
    // Autosave to API
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      await fetch(`${apiBase}/api/assessments/${assessmentId}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: qId, answer }),
      });
    } catch (err) {
      console.error('Error saving answer:', err);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${apiBase}/api/assessments/${assessmentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      
      toast.success('Assessment submitted');
      setAiSummary(data.aiSummary);
      setScoreResult(data.scoreResult);
      setReadonly(true);
    } catch (err: any) {
      toast.error(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No questions available for this assessment.
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Security Questionnaire</h1>
          <p className="text-muted-foreground mt-1">{currentCategory}</p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CategoryIcon className="w-5 h-5 text-primary" />
            {currentCategory}
          </CardTitle>
          <CardDescription>Answer all questions in this section</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <AnimatePresence mode="wait">
            {categoryQuestions.map((q, idx) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: idx * 0.1 }}
                className="space-y-3"
              >
                <Label className="text-base font-medium">{q.question}</Label>
                {q.type === 'boolean' && (
                  <RadioGroup
                    value={answers[q.id]?.toString()}
                    onValueChange={(v) => handleAnswer(q.id, v === 'true')}
                    disabled={readonly}
                    className="flex gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="true" id={`${q.id}-yes`} />
                      <Label htmlFor={`${q.id}-yes`}>Yes</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="false" id={`${q.id}-no`} />
                      <Label htmlFor={`${q.id}-no`}>No</Label>
                    </div>
                  </RadioGroup>
                )}
                {q.type === 'select' && q.options && (
                  <RadioGroup
                    value={answers[q.id]}
                    onValueChange={(v) => handleAnswer(q.id, v)}
                    disabled={readonly}
                    className="space-y-2"
                  >
                    {q.options.map((opt) => (
                      <div key={opt} className="flex items-center gap-2">
                        <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                        <Label htmlFor={`${q.id}-${opt}`}>{opt}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}
                {q.type === 'multiselect' && q.options && (
                  <div className="space-y-2">
                    {q.options.map((opt) => (
                      <div key={opt} className="flex items-center gap-2">
                        <Checkbox
                          id={`${q.id}-${opt}`}
                          checked={(answers[q.id] || []).includes(opt)}
                          onCheckedChange={(checked) => {
                            const current = answers[q.id] || [];
                            const updated = checked
                              ? [...current, opt]
                              : current.filter((o: string) => o !== opt);
                            handleAnswer(q.id, updated);
                          }}
                          disabled={readonly}
                        />
                        <Label htmlFor={`${q.id}-${opt}`}>{opt}</Label>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
          disabled={currentStep === 0}
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </Button>
        
        {currentStep < categories.length - 1 ? (
          <Button
            onClick={() => setCurrentStep(s => Math.min(categories.length - 1, s + 1))}
            className="gap-2"
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitting || readonly}
            className="gap-2 bg-gradient-primary"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {readonly ? 'Submitted' : 'Submit Assessment'}
          </Button>
        )}
      </div>

      {scoreResult && (
        <RiskScoreResults result={scoreResult} aiSummary={aiSummary} />
      )}
    </div>
  );
}
