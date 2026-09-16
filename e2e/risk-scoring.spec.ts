import { test, expect } from '@playwright/test';
import { API_URL, vendorOwnedAssessment, completeAssessment } from './helpers';

test.describe('Risk scoring on submit', () => {
  test('submitting a completed assessment persists a risk score', async ({ page }) => {
    const assessmentId = await vendorOwnedAssessment(
      page.request,
      `E2E Scoring Vendor ${Date.now()}`,
    );
    // completeAssessment answers every question (first option = best) and submits.
    await completeAssessment(page.request, assessmentId, 'vendor');

    const token = await (await import('./helpers')).apiToken(page.request, 'admin');
    const res = await page.request.get(`${API_URL}/api/assessments/${assessmentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const assessment = (await res.json()).data;

    expect(assessment.risk_score).not.toBeNull();
    expect(assessment.risk_level).toMatch(/^(low|medium|high|critical)$/);
    expect(assessment.overall_score).not.toBeNull();
    expect(Array.isArray(assessment.category_scores)).toBeTruthy();
    for (const cs of assessment.category_scores) {
      expect(cs.category).toBeTruthy();
      expect(typeof cs.score).toBe('number');
    }
    expect(assessment.status).toBe('submitted');
  });

  test('bad answers score worse than good answers', async ({ page }) => {
    const goodId = await vendorOwnedAssessment(
      page.request,
      `E2E Score Good ${Date.now()}`,
    );
    // Every first option is the best one (Yes / TLS 1.3 / Monthly / ...).
    await completeAssessment(page.request, goodId, 'vendor');

    const badId = await vendorOwnedAssessment(
      page.request,
      `E2E Score Bad ${Date.now()}`,
    );
    const { apiToken: tokenOf } = await import('./helpers');
    const vendorToken = await tokenOf(page.request, 'vendor');
    const auth = { Authorization: `Bearer ${vendorToken}` };

    const qRes = await page.request.get(`${API_URL}/api/questions`, { headers: auth });
    const questions = (await qRes.json()).data as { id: string; type: string; options: string[] | null }[];
    for (const q of questions) {
      // Last option is the worst (No encryption / Never / Over 24 hours / None).
      const answer =
        q.type === 'boolean'
          ? false
          : q.type === 'multiple-choice'
            ? ['None']
            : q.options?.[q.options.length - 1];
      const r = await page.request.post(`${API_URL}/api/assessments/${badId}/responses`, {
        headers: auth,
        data: { question_id: q.id, answer },
      });
      expect(r.ok()).toBeTruthy();
    }
    const submit = await page.request.post(`${API_URL}/api/assessments/${badId}/submit`, {
      headers: auth,
    });
    expect(submit.ok()).toBeTruthy();

    const token = await tokenOf(page.request, 'admin');
    const scoreOf = async (id: string) => {
      const res = await page.request.get(`${API_URL}/api/assessments/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return (await res.json()).data;
    };

    const good = await scoreOf(goodId);
    const bad = await scoreOf(badId);
    expect(good.risk_score).not.toBeNull();
    expect(bad.risk_score).not.toBeNull();
    expect(bad.risk_score).toBeGreaterThan(good.risk_score);
    expect(good.risk_level).toBe('low');
    expect(bad.risk_level).toMatch(/^(high|critical)$/);
  });
});
