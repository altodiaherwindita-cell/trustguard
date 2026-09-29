// Port of src/lib/riskScoring.ts (server-side). Keep in sync with the TS source.

export const CATEGORY_WEIGHTS = {
  'Data Protection': 1.5,
  'Access Control': 1.4,
  'Incident Response': 1.3,
  'Compliance': 1.2,
  'Security Operations': 1.1,
  'Business Continuity': 1.0,
};

const RISK_IMPACT_MULTIPLIERS = {
  high: 1.5,
  medium: 1.0,
  low: 0.7,
};

const scoringRules = {
  boolean: {
    // true = good security practice = lower risk (higher score)
    getScore: (answer) => (answer ? 100 : 0),
  },
  'single-choice': {
    getScore: (answer, options) => {
      if (!options || !answer) return 50;
      const index = options.indexOf(answer);
      if (index === -1) return 50;
      // First option is typically the best, last is worst
      const score = ((options.length - 1 - index) / (options.length - 1)) * 100;
      return Math.round(score);
    },
  },
  'multiple-choice': {
    getScore: (answers, options) => {
      if (!options || !answers || answers.length === 0) return 0;
      // More certifications/controls = better (except for "None")
      const validAnswers = answers.filter((a) => a.toLowerCase() !== 'none');
      if (validAnswers.length === 0) return 0;
      const maxGoodOptions = options.filter((o) => o.toLowerCase() !== 'none').length;
      const score = (validAnswers.length / maxGoodOptions) * 100;
      return Math.round(score);
    },
  },
};

// ponytail: insights keyed to seeded question ids q1/q3/q5 (encryption/MFA/incident plan);
// rekey if question seeding ever changes ids (init.sql questions insert).
function generateInsights(categoryScores, questionScores, questions, answers) {
  const recommendations = [];
  const strengths = [];
  const weaknesses = [];

  for (const cs of categoryScores) {
    if (cs.score >= 80) {
      strengths.push(`Strong ${cs.category.toLowerCase()} controls with ${cs.score}% compliance`);
    } else if (cs.score < 50) {
      weaknesses.push(`${cs.category} requires immediate attention (${cs.score}% score)`);
      recommendations.push(`Prioritize improving ${cs.category.toLowerCase()} measures`);
    }
  }

  const questionMap = new Map(questions.map((q) => [q.id, q]));

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

  return {
    recommendations: recommendations.slice(0, 5),
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 4),
  };
}

export function calculateQuestionScore(question, answer) {
  const rule = scoringRules[question.type] || scoringRules['single-choice'];
  let rawScore = 50; // Default to middle score if no answer

  if (answer !== undefined && answer !== null) {
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

export function calculateRiskScore(questions, answers) {
  const questionScores = questions.map((q) => calculateQuestionScore(q, answers[q.id]));

  const categoryMap = new Map();
  for (const qs of questionScores) {
    if (!categoryMap.has(qs.category)) {
      categoryMap.set(qs.category, []);
    }
    categoryMap.get(qs.category).push(qs);
  }

  const categoryScores = [];
  let totalWeightedScore = 0;
  let totalMaxScore = 0;

  for (const [category, scores] of categoryMap) {
    const categoryWeight = CATEGORY_WEIGHTS[category] || 1.0;
    const answeredQuestions = scores.filter((s) => answers[s.questionId] !== undefined && answers[s.questionId] !== null);

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

  const overallScore = totalMaxScore > 0
    ? Math.round((totalWeightedScore / totalMaxScore) * 100)
    : 50;

  // Invert: 0-100 where 100 = highest risk
  const riskScore = 100 - overallScore;
  const riskLevel = getRiskLevel(riskScore);

  const { recommendations, strengths, weaknesses } = generateInsights(
    categoryScores, questionScores, questions, answers,
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

export function getRiskLevel(riskScore) {
  if (riskScore <= 25) return 'low';
  if (riskScore <= 50) return 'medium';
  if (riskScore <= 75) return 'high';
  return 'critical';
}
