import { motion } from 'framer-motion';
import { RiskScoreResult } from '@/lib/riskScoring';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Lightbulb,
  TrendingUp,
  Shield,
  ArrowRight,
  Download,
  RotateCcw,
} from 'lucide-react';

interface RiskScoreResultsProps {
  result: RiskScoreResult;
  vendorName?: string;
  onReset?: () => void;
  onViewDetails?: () => void;
}

export function RiskScoreResults({ result, vendorName, onReset, onViewDetails }: RiskScoreResultsProps) {
  const { riskScore, riskLevel, categoryScores, recommendations, strengths, weaknesses } = result;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Main Score Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="overflow-hidden">
          <div className={`h-2 ${
            riskLevel === 'low' ? 'bg-success' :
            riskLevel === 'medium' ? 'bg-warning' :
            riskLevel === 'high' ? 'bg-destructive' :
            'bg-risk-critical'
          }`} />
          <CardContent className="pt-8 pb-8">
            <div className="text-center mb-8">
              {vendorName && (
                <p className="text-sm text-muted-foreground mb-2">{vendorName}</p>
              )}
              <h2 className="text-2xl font-bold mb-4">Risk Assessment Complete</h2>
              
              <div className="flex items-center justify-center gap-6">
                <div className="relative">
                  <svg className="w-40 h-40 transform -rotate-90">
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="12"
                      className="text-muted"
                    />
                    <motion.circle
                      cx="80"
                      cy="80"
                      r="70"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="12"
                      strokeLinecap="round"
                      className={
                        riskLevel === 'low' ? 'text-success' :
                        riskLevel === 'medium' ? 'text-warning' :
                        riskLevel === 'high' ? 'text-destructive' :
                        'text-risk-critical'
                      }
                      initial={{ strokeDasharray: '0 440' }}
                      animate={{ strokeDasharray: `${(riskScore / 100) * 440} 440` }}
                      transition={{ duration: 1, delay: 0.3 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="text-4xl font-bold"
                    >
                      {riskScore}
                    </motion.span>
                    <span className="text-sm text-muted-foreground">Risk Score</span>
                  </div>
                </div>

                <div className="text-left space-y-2">
                  <RiskBadge level={riskLevel} size="lg" />
                  <p className="text-sm text-muted-foreground max-w-xs">
                    {riskLevel === 'low' && 'Strong security posture with minimal identified risks.'}
                    {riskLevel === 'medium' && 'Moderate risk level requiring attention in some areas.'}
                    {riskLevel === 'high' && 'Significant risks identified. Remediation recommended.'}
                    {riskLevel === 'critical' && 'Critical security gaps. Immediate action required.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <Button variant="outline" className="gap-2" onClick={onReset}>
                <RotateCcw className="w-4 h-4" />
                New Assessment
              </Button>
              <Button className="gap-2 bg-gradient-primary hover:opacity-90">
                <Download className="w-4 h-4" />
                Export Report
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Category Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" />
              Category Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {categoryScores.map((cs, index) => (
              <motion.div
                key={cs.category}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{cs.category}</span>
                    <span className="text-xs text-muted-foreground">
                      ({cs.questionsAnswered}/{cs.totalQuestions} answered)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${
                      cs.score >= 75 ? 'text-success' :
                      cs.score >= 50 ? 'text-warning' :
                      cs.score >= 25 ? 'text-destructive' :
                      'text-risk-critical'
                    }`}>
                      {cs.score}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      (Weight: {cs.weight}x)
                    </span>
                  </div>
                </div>
                <Progress
                  value={cs.score}
                  className={`h-2 ${
                    cs.score >= 75 ? '[&>div]:bg-success' :
                    cs.score >= 50 ? '[&>div]:bg-warning' :
                    cs.score >= 25 ? '[&>div]:bg-destructive' :
                    '[&>div]:bg-risk-critical'
                  }`}
                />
              </motion.div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Insights Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Strengths */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-success">
                <CheckCircle2 className="w-5 h-5" />
                Strengths
              </CardTitle>
            </CardHeader>
            <CardContent>
              {strengths.length > 0 ? (
                <ul className="space-y-3">
                  {strengths.map((strength, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                      className="flex items-start gap-2 text-sm"
                    >
                      <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                      <span>{strength}</span>
                    </motion.li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No significant strengths identified based on responses.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Weaknesses */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="w-5 h-5" />
                Areas of Concern
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weaknesses.length > 0 ? (
                <ul className="space-y-3">
                  {weaknesses.map((weakness, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.65 + index * 0.1 }}
                      className="flex items-start gap-2 text-sm"
                    >
                      <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                      <span>{weakness}</span>
                    </motion.li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No critical weaknesses identified.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-accent">
                <Lightbulb className="w-5 h-5" />
                Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recommendations.map((rec, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 + index * 0.1 }}
                    className="flex items-start gap-3 p-3 rounded-lg bg-accent/5 border border-accent/10"
                  >
                    <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-accent">{index + 1}</span>
                    </div>
                    <p className="text-sm">{rec}</p>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Action Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Need Help with Remediation?</h3>
                  <p className="text-sm text-muted-foreground">
                    Our AI assistant can help you develop an action plan
                  </p>
                </div>
              </div>
              <Button variant="outline" className="gap-2">
                Ask AI Assistant
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
