import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORY_WEIGHTS: Record<string, number> = {
  'Data Protection': 1.5, 'Access Control': 1.4, 'Incident Response': 1.3,
  'Compliance': 1.2, 'Security Operations': 1.1, 'Business Continuity': 1.0,
};
const RISK_IMPACT_MULT: Record<string, number> = { high: 1.5, medium: 1.0, low: 0.7 };

function scoreAnswer(q: any, answer: any): number {
  if (answer === undefined || answer === null) return 50;
  if (q.type === 'boolean') return answer ? 100 : 0;
  if (q.type === 'single-choice') {
    const opts = q.options || [];
    const i = opts.indexOf(answer);
    if (i === -1) return 50;
    return Math.round(((opts.length - 1 - i) / Math.max(1, opts.length - 1)) * 100);
  }
  if (q.type === 'multiple-choice') {
    const arr = Array.isArray(answer) ? answer : [];
    const opts = q.options || [];
    const valid = arr.filter((a: string) => a.toLowerCase() !== 'none');
    if (valid.length === 0) return 0;
    const maxGood = opts.filter((o: string) => o.toLowerCase() !== 'none').length;
    return Math.round((valid.length / Math.max(1, maxGood)) * 100);
  }
  return 50;
}

function calc(questions: any[], answersByQId: Record<string, any>) {
  const byCat: Record<string, { ws: number; mx: number; score: number; }> = {};
  let tWs = 0, tMx = 0;
  const lowImpactGaps: string[] = [];
  for (const q of questions) {
    const raw = scoreAnswer(q, answersByQId[q.id]);
    const cw = CATEGORY_WEIGHTS[q.category] || 1.0;
    const im = RISK_IMPACT_MULT[q.risk_impact] || 1.0;
    const mx = q.weight * cw * im;
    const ws = (raw / 100) * mx;
    if (!byCat[q.category]) byCat[q.category] = { ws: 0, mx: 0, score: 0 };
    byCat[q.category].ws += ws;
    byCat[q.category].mx += mx;
    tWs += ws; tMx += mx;
    if (raw < 30 && q.risk_impact === 'high') lowImpactGaps.push(q.question);
  }
  const categoryScores = Object.entries(byCat).map(([category, v]) => ({
    category,
    score: v.mx > 0 ? Math.round((v.ws / v.mx) * 100) : 50,
  }));
  const overall = tMx > 0 ? Math.round((tWs / tMx) * 100) : 50;
  const risk = 100 - overall;
  const level = risk <= 25 ? 'low' : risk <= 50 ? 'medium' : risk <= 75 ? 'high' : 'critical';
  const strengths = categoryScores.filter(c => c.score >= 80).map(c => `Strong ${c.category}`);
  const weaknesses = categoryScores.filter(c => c.score < 50).map(c => `${c.category} needs attention`);
  const recommendations = [
    ...categoryScores.filter(c => c.score < 50).map(c => `Improve ${c.category.toLowerCase()} controls`),
    ...lowImpactGaps.slice(0, 3).map(q => `Address: ${q.substring(0, 80)}`),
  ].slice(0, 6);
  return { overall, risk, level, categoryScores, strengths, weaknesses, recommendations };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: auth } } }
    );
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });

    const { assessmentId } = await req.json();
    if (!assessmentId) return new Response(JSON.stringify({ error: 'assessmentId required' }), { status: 400, headers: corsHeaders });

    // Verify access via RLS-aware client
    const { data: assessment, error: aErr } = await userClient
      .from('assessments').select('*, vendors(name, contact_email)').eq('id', assessmentId).maybeSingle();
    if (aErr || !assessment) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: corsHeaders });

    const { data: questions } = await supabase.from('questions').select('*').order('display_order');
    const { data: responses } = await supabase.from('assessment_responses').select('question_id, answer').eq('assessment_id', assessmentId);
    const answersMap: Record<string, any> = {};
    for (const r of responses || []) answersMap[r.question_id] = r.answer;

    const result = calc(questions || [], answersMap);

    // AI summary via Lovable AI
    let aiSummary = `Assessment scored ${result.risk}/100 risk (${result.level}).`;
    const LOVABLE_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (LOVABLE_KEY) {
      try {
        const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${LOVABLE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { role: 'system', content: 'You are a cyber-risk analyst. Write a concise 3-5 sentence executive summary of a vendor risk assessment for the TPRM team. Be specific and actionable.' },
              { role: 'user', content: `Vendor: ${(assessment as any).vendors?.name}\nRisk score: ${result.risk}/100 (${result.level})\nCategory scores: ${JSON.stringify(result.categoryScores)}\nStrengths: ${result.strengths.join('; ') || 'none notable'}\nWeaknesses: ${result.weaknesses.join('; ') || 'none notable'}\nTop recommendations: ${result.recommendations.join('; ')}` },
            ],
          }),
        });
        if (aiResp.status === 429) {
          aiSummary += ' (AI summary unavailable: rate limit)';
        } else if (aiResp.status === 402) {
          aiSummary += ' (AI summary unavailable: add credits to your workspace)';
        } else if (aiResp.ok) {
          const j = await aiResp.json();
          aiSummary = j.choices?.[0]?.message?.content || aiSummary;
        }
      } catch (e) {
        console.error('AI error', e);
      }
    }

    const { error: upErr } = await supabase.from('assessments').update({
      status: 'submitted',
      overall_score: result.overall,
      risk_score: result.risk,
      risk_level: result.level,
      ai_summary: aiSummary,
      strengths: result.strengths,
      weaknesses: result.weaknesses,
      recommendations: result.recommendations,
      category_scores: result.categoryScores,
      submitted_at: new Date().toISOString(),
    }).eq('id', assessmentId);
    if (upErr) throw upErr;

    await supabase.from('vendors').update({
      current_risk_score: result.risk,
      current_risk_level: result.level,
      last_assessment_at: new Date().toISOString(),
      status: 'in-review',
    }).eq('id', (assessment as any).vendor_id);

    return new Response(JSON.stringify({ ...result, aiSummary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
