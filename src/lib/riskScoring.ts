import { Question, QuestionnaireResponse, RiskLevel } from '@/types/tprm';

// Category weights - higher weight = more important for overall risk
export const CATEGORY_WEIGHTS: Record<string, number> = {
  'Data Protection': 1.5,
  'Access Control': 1.4,
  'Incident Response': 1.3,
  'Compliance': 1.2,
  'Security Operations': 1.1,
  'Business Continuity': 1.0,
};

// Risk impact multipliers
const RISK_IMPACT_MULTIPLIERS: Record<string, number> = {
  high: 1.5,
  medium: 1.0,
  low: 0.7,
};

// Scoring rules for different answer types
interface ScoringRule {
  type: 'boolean' | 'single-choice' | 'multiple-choice';
  getScore: (answer: string | string[] | boolean | undefined, options?: string[]) => number;
}

const scoringRules: Record<string, ScoringRule> = {
  boolean: {
    type: 'boolean',
    // true = good security practice = lower risk (higher score)
    getScore: (answer: boolean) => answer ? 100 : 0,
  },
  'single-choice': {
    type: 'single-choice',
    getScore: (answer: string, options?: string[]) => {
      if (!options || !answer) return 50;
      const index = options.indexOf(answer);
      if (index === -1) return 50;
      // First option is typically the best, last is worst
      const score = ((options.length - 1 - index) / (options.length - 1)) * 100;
      return Math.round(score);
    },
  },
  'multiple-choice': {
    type: 'multiple-choice',
    getScore: (answers: string[], options?: string[]) => {
      if (!options || !answers || answers.length === 0) return 0;
      // More certifications/controls = better (except for "None")
      const validAnswers = answers.filter(a => a.toLowerCase() !== 'none');
      if (validAnswers.length === 0) return 0;
      // Score based on how many good options were selected (excluding "None")
      const maxGoodOptions = options.filter(o => o.toLowerCase() !== 'none').length;
      const score = (validAnswers.length / maxGoodOptions) * 100;
      return Math.round(score);
    },
  },
};

export interface QuestionScore {
  questionId: string;
  category: string;
  rawScore: number; // 0-100
  weightedScore: number;
  maxPossibleScore: number;
  riskImpact: string;
}

export interface CategoryScore {
  category: string;
  score: number; // 0-100
  weight: number;
  questionsAnswered: number;
  totalQuestions: number;
  riskContribution: number;
}

export interface RiskScoreResult {
  overallScore: number; // 0-100 (lower = more risk)
  riskScore: number; // 0-100 (higher = more risk) - this is what we display
  riskLevel: RiskLevel;
  categoryScores: CategoryScore[];
  questionScores: QuestionScore[];
  recommendations: string[];
  strengths: string[];
  weaknesses: string[];
}

/**
 * Calculate the score for a single question
 */
export function calculateQuestionScore(
  question: Question,
  answer: string | string[] | boolean | undefined
): QuestionScore {
  const rule = scoringRules[question.type];
  let rawScore = 50; // Default to middle score if no answer

  if (answer !== undefined) {
    rawScore = rule.getScore(answer, question.options);
  }

  const categoryWeight = CATEGORY_WEIGHTS[question.category] || 1.0;
  const impactMultiplier = RISK_IMPACT_MULTIPLIERS[question.riskImpact] || 1.0;
  const maxPossibleScore = question.weight * categoryWeight * impactMultiplier;
  const weightedScore = (rawScore / 100) * maxPossibleScore;

  return {
    questionId: question.id,
    category: question.category,
    rawScore,
    weightedScore,
    maxPossibleScore,
    riskImpact: question.riskImpact,
  };
}

/**
 * Calculate the overall risk score from questionnaire responses
 */
export function calculateRiskScore(
  questions: Question[],
  answers: Record<string, string | string[] | boolean>
): RiskScoreResult {
  // Calculate individual question scores
  const questionScores = questions.map(q => 
    calculateQuestionScore(q, answers[q.id])
  );

  // Group by category
  const categoryMap = new Map<string, QuestionScore[]>();
  for (const qs of questionScores) {
    if (!categoryMap.has(qs.category)) {
      categoryMap.set(qs.category, []);
    }
    categoryMap.get(qs.category)!.push(qs);
  }

  // Calculate category scores
  const categoryScores: CategoryScore[] = [];
  let totalWeightedScore = 0;
  let totalMaxScore = 0;

  for (const [category, scores] of categoryMap) {
    const categoryWeight = CATEGORY_WEIGHTS[category] || 1.0;
    const answeredQuestions = scores.filter(s => answers[s.questionId] !== undefined);
    
    const categoryWeightedSum = scores.reduce((sum, s) => sum + s.weightedScore, 0);
    const categoryMaxSum = scores.reduce((sum, s) => sum + s.maxPossibleScore, 0);
    
    const categoryScore = categoryMaxSum > 0 
      ? Math.round((categoryWeightedSum / categoryMaxSum) * 100) 
      : 50;

    const riskContribution = categoryMaxSum > 0
      ? ((categoryMaxSum - categoryWeightedSum) / categoryMaxSum) * categoryWeight * 100
      : 50;

    categoryScores.push({
      category,
      score: categoryScore,
      weight: categoryWeight,
      questionsAnswered: answeredQuestions.length,
      totalQuestions: scores.length,
      riskContribution: Math.round(riskContribution),
    });

    totalWeightedScore += categoryWeightedSum;
    totalMaxScore += categoryMaxSum;
  }

  // Sort categories by risk contribution (highest risk first)
  categoryScores.sort((a, b) => b.riskContribution - a.riskContribution);

  // Calculate overall score (0-100, where 100 = best security posture)
  const overallScore = totalMaxScore > 0 
    ? Math.round((totalWeightedScore / totalMaxScore) * 100) 
    : 50;

  // Invert to get risk score (0-100, where 100 = highest risk)
  const riskScore = 100 - overallScore;

  // Determine risk level
  const riskLevel = getRiskLevel(riskScore);

  // Generate recommendations, strengths, and weaknesses
  const { recommendations, strengths, weaknesses } = generateInsights(
    categoryScores,
    questionScores,
    questions,
    answers
  );

  return {
    overallScore,
    riskScore,
    riskLevel,
    categoryScores,
    questionScores,
    recommendations,
    strengths,
    weaknesses,
  };
}

/**
 * Determine risk level based on risk score
 */
export function getRiskLevel(riskScore: number): RiskLevel {
  if (riskScore <= 25) return 'low';
  if (riskScore <= 50) return 'medium';
  if (riskScore <= 75) return 'high';
  return 'critical';
}

/**
 * Generate insights based on scores
 */
function generateInsights(
  categoryScores: CategoryScore[],
  questionScores: QuestionScore[],
  questions: Question[],
  answers: Record<string, string | string[] | boolean>
): { recommendations: string[]; strengths: string[]; weaknesses: string[] } {
  const recommendations: string[] = [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Analyze each category
  for (const cs of categoryScores) {
    if (cs.score >= 80) {
      strengths.push(`Strong ${cs.category.toLowerCase()} controls with ${cs.score}% compliance`);
    } else if (cs.score < 50) {
      weaknesses.push(`${cs.category} requires immediate attention (${cs.score}% score)`);
      recommendations.push(`Prioritize improving ${cs.category.toLowerCase()} measures`);
    }
  }

  // Analyze specific question patterns
  const questionMap = new Map(questions.map(q => [q.id, q]));
  
  for (const qs of questionScores) {
    const question = questionMap.get(qs.questionId);
    if (!question) continue;

    if (qs.rawScore < 30 && question.riskImpact === 'high') {
      const shortQuestion = question.question.length > 60 
        ? question.question.substring(0, 60) + '...'
        : question.question;
      recommendations.push(`Address critical gap: "${shortQuestion}"`);
    }
  }

  // Check for specific security controls
  const encryptionAnswer = answers['q1'];
  if (encryptionAnswer === false) {
    recommendations.push('Implement encryption at rest for all sensitive data');
    weaknesses.push('Data at rest is not encrypted');
  } else if (encryptionAnswer === true) {
    strengths.push('Data encryption at rest is enabled');
  }

  const mfaAnswer = answers['q3'];
  if (mfaAnswer === false) {
    recommendations.push('Enable multi-factor authentication for all users');
    weaknesses.push('MFA is not implemented');
  } else if (mfaAnswer === true) {
    strengths.push('Multi-factor authentication is enabled');
  }

  const incidentPlanAnswer = answers['q5'];
  if (incidentPlanAnswer === false) {
    recommendations.push('Develop and document an incident response plan');
    weaknesses.push('No documented incident response plan');
  } else if (incidentPlanAnswer === true) {
    strengths.push('Incident response plan is documented');
  }

  // Limit to top insights
  return {
    recommendations: recommendations.slice(0, 5),
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 4),
  };
}

/**
 * Get a color class for a given score
 */
export function getScoreColorClass(score: number, inverted = false): string {
  const effectiveScore = inverted ? 100 - score : score;
  if (effectiveScore >= 75) return 'text-success';
  if (effectiveScore >= 50) return 'text-warning';
  if (effectiveScore >= 25) return 'text-destructive';
  return 'text-risk-critical';
}

/**
 * Get risk level color class
 */
export function getRiskLevelColorClass(level: RiskLevel): string {
  switch (level) {
    case 'low': return 'text-success';
    case 'medium': return 'text-warning';
    case 'high': return 'text-destructive';
    case 'critical': return 'text-risk-critical';
  }
}
