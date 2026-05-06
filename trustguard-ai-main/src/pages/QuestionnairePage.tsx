import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { mockQuestions } from '@/data/mockData';
import { calculateRiskScore, RiskScoreResult } from '@/lib/riskScoring';
import { RiskScoreResults } from '@/components/RiskScoreResults';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  FileText,
  ChevronRight,
  ChevronLeft,
  Shield,
  Lock,
  AlertCircle,
  FileCheck,
  Server,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

const categoryIcons: Record<string, React.ElementType> = {
  'Data Protection': Lock,
  'Access Control': Shield,
  'Incident Response': AlertCircle,
  'Compliance': FileCheck,
  'Security Operations': Server,
  'Business Continuity': CheckCircle2,
};

export function QuestionnairePage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[] | boolean>>({});
  const [isCalculating, setIsCalculating] = useState(false);
  const [scoreResult, setScoreResult] = useState<RiskScoreResult | null>(null);

  const categories = [...new Set(mockQuestions.map(q => q.category))];
  const currentCategory = categories[currentStep];
  const categoryQuestions = mockQuestions.filter(q => q.category === currentCategory);

  const progress = ((currentStep + 1) / categories.length) * 100;
  const CategoryIcon = categoryIcons[currentCategory] || FileText;

  const handleAnswer = (questionId: string, answer: string | string[] | boolean) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    setIsCalculating(true);
    
    // Simulate processing time for better UX
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const result = calculateRiskScore(mockQuestions, answers);
    setScoreResult(result);
    setIsCalculating(false);
  };

  const handleNext = () => {
    if (currentStep < categories.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleReset = () => {
    setScoreResult(null);
    setCurrentStep(0);
    setAnswers({});
  };

  // Show calculating state
  if (isCalculating) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-10 h-10 text-accent animate-spin" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Calculating Risk Score</h1>
          <p className="text-muted-foreground">
            Analyzing responses and generating insights...
          </p>
        </motion.div>
      </div>
    );
  }

  // Show results
  if (scoreResult) {
    return (
      <div className="p-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Assessment Results</h1>
              <p className="text-muted-foreground">
                Risk score calculated based on your questionnaire responses
              </p>
            </div>
          </div>
        </motion.div>
        
        <RiskScoreResults
          result={scoreResult}
          vendorName="Third Party Assessment"
          onReset={handleReset}
        />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Security Questionnaire</h1>
            <p className="text-muted-foreground">
              Complete the assessment to evaluate cyber risk posture
            </p>
          </div>
        </div>
      </motion.div>

      {/* Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">
                Section {currentStep + 1} of {categories.length}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
              {categories.map((cat, index) => {
                const categoryAnswered = mockQuestions
                  .filter(q => q.category === cat)
                  .some(q => answers[q.id] !== undefined);
                
                return (
                  <button
                    key={cat}
                    onClick={() => setCurrentStep(index)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                      index === currentStep
                        ? 'bg-primary text-primary-foreground'
                        : categoryAnswered
                        ? 'bg-success/10 text-success'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Questions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentCategory}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <CategoryIcon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle>{currentCategory}</CardTitle>
                  <CardDescription>
                    {categoryQuestions.length} questions in this section
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              {categoryQuestions.map((question, index) => (
                <motion.div
                  key={question.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="space-y-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-sm font-medium">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium mb-1">{question.question}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          question.riskImpact === 'high' ? 'bg-destructive/10 text-destructive' :
                          question.riskImpact === 'medium' ? 'bg-warning/10 text-warning' :
                          'bg-success/10 text-success'
                        }`}>
                          {question.riskImpact} impact
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Weight: {question.weight}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="ml-9">
                    {question.type === 'boolean' && (
                      <div className="flex items-center gap-3">
                        <Switch
                          id={question.id}
                          checked={answers[question.id] as boolean || false}
                          onCheckedChange={(checked) => handleAnswer(question.id, checked)}
                        />
                        <Label htmlFor={question.id} className="cursor-pointer">
                          {answers[question.id] ? 'Yes' : 'No'}
                        </Label>
                      </div>
                    )}

                    {question.type === 'single-choice' && question.options && (
                      <RadioGroup
                        value={answers[question.id] as string || ''}
                        onValueChange={(value) => handleAnswer(question.id, value)}
                        className="space-y-2"
                      >
                        {question.options.map((option) => (
                          <div key={option} className="flex items-center space-x-3">
                            <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                            <Label htmlFor={`${question.id}-${option}`} className="font-normal cursor-pointer">
                              {option}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {question.type === 'multiple-choice' && question.options && (
                      <div className="space-y-2">
                        {question.options.map((option) => {
                          const currentAnswers = (answers[question.id] as string[]) || [];
                          const isChecked = currentAnswers.includes(option);
                          return (
                            <div key={option} className="flex items-center space-x-3">
                              <Checkbox
                                id={`${question.id}-${option}`}
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    handleAnswer(question.id, [...currentAnswers, option]);
                                  } else {
                                    handleAnswer(question.id, currentAnswers.filter(a => a !== option));
                                  }
                                }}
                              />
                              <Label htmlFor={`${question.id}-${option}`} className="font-normal cursor-pointer">
                                {option}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex items-center justify-between pt-4"
      >
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 0}
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </Button>
        <div className="text-sm text-muted-foreground">
          {Object.keys(answers).length} of {mockQuestions.length} questions answered
        </div>
        <Button
          onClick={handleNext}
          className="gap-2 bg-gradient-primary hover:opacity-90"
        >
          {currentStep === categories.length - 1 ? 'Calculate Risk Score' : 'Next Section'}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </motion.div>
    </div>
  );
}
