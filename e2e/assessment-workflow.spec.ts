import { test, expect } from '@playwright/test';
import { login, apiToken, createVendor, createAssessment, completeAssessment, vendorOwnedAssessment } from './helpers';

test.describe('Assessment workflow', () => {
  test('analyst creates an assessment that then appears in the list', async ({ page }) => {
    const vendorName = `E2E Workflow Vendor ${Date.now()}`;
    const vendorId = await createVendor(page.request, vendorName);

    await login(page, 'analyst');
    await page.goto('/assessments');

    // The list is populated from the API; the vendor we just made must show up
    // once an assessment exists for it.
    await createAssessment(page.request, vendorId);
    await page.reload();

    await expect(page.getByText(vendorName)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Not Started').first()).toBeVisible();
  });

  test('the questionnaire renders an input for every seeded question type', async ({ page }) => {
    const assessmentId = await vendorOwnedAssessment(
      page.request,
      `E2E Types Vendor ${Date.now()}`,
    );

    await login(page, 'admin');
    await page.goto(`/questionnaire/${assessmentId}`);

    await expect(page.getByRole('heading', { name: 'Security Questionnaire' })).toBeVisible({
      timeout: 20_000,
    });

    // Data Protection holds one boolean (q1) and one single-choice (q2).
    // The single-choice must render its options as radios — this is what
    // regressed when the page checked for 'select' instead of 'single-choice'.
    await expect(page.getByText('Does your organization encrypt data at rest?')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Yes', exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'No', exact: true })).toBeVisible();

    await expect(
      page.getByText('What encryption standards do you use for data in transit?'),
    ).toBeVisible();
    for (const option of ['TLS 1.3', 'TLS 1.2', 'TLS 1.1 or lower', 'No encryption']) {
      await expect(page.getByRole('radio', { name: option, exact: true })).toBeVisible();
    }

    // Walk to the Compliance step and confirm the multiple-choice renders checkboxes.
    await page.getByRole('button', { name: /Next/ }).click(); // Access Control
    await page.getByRole('button', { name: /Next/ }).click(); // Incident Response
    await page.getByRole('button', { name: /Next/ }).click(); // Compliance
    await expect(
      page.getByText('Which compliance certifications does your organization hold?'),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('checkbox', { name: 'SOC 2', exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'ISO 27001', exact: true })).toBeVisible();
  });

  test('answering in the UI persists across a reload', async ({ page }) => {
    const assessmentId = await vendorOwnedAssessment(
      page.request,
      `E2E Persist Vendor ${Date.now()}`,
    );

    await login(page, 'admin');
    await page.goto(`/questionnaire/${assessmentId}`);
    await expect(page.getByRole('heading', { name: 'Security Questionnaire' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('radio', { name: 'Yes', exact: true }).click();
    await page.getByRole('radio', { name: 'TLS 1.3', exact: true }).click();

    // Reload and confirm the server stored both answers.
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Yes', exact: true })).toBeChecked({
      timeout: 20_000,
    });
    await expect(page.getByRole('radio', { name: 'TLS 1.3', exact: true })).toBeChecked();
  });

  test('vendor submits, and the assessment becomes read-only', async ({ page }) => {
    const assessmentId = await vendorOwnedAssessment(
      page.request,
      `E2E Submit Vendor ${Date.now()}`,
    );
    await completeAssessment(page.request, assessmentId, 'vendor');

    await login(page, 'vendor');
    await page.goto(`/questionnaire/${assessmentId}`);

    // Submitted assessments open read-only: every answer control is disabled and
    // the risk results panel replaces the editable form.
    await expect(page.getByText('Risk Assessment Complete')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('radio', { name: 'Yes', exact: true })).toBeDisabled();
    await expect(page.getByRole('radio', { name: 'TLS 1.3', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: /Submit Assessment/ })).toHaveCount(0);
  });

  test('a vendor cannot read an assessment it does not own', async ({ page }) => {
    // TPRM-owned vendor: the seeded vendor account is not the owner.
    const vendorId = await createVendor(page.request, `E2E NotMine Vendor ${Date.now()}`);
    const assessmentId = await createAssessment(page.request, vendorId);

    // The API is the security boundary and must refuse a non-owner vendor.
    const vendorToken = await apiToken(page.request, 'vendor');
    for (const path of [
      `/api/assessments/${assessmentId}`,
      `/api/assessments/${assessmentId}/responses`,
      `/api/assessments/${assessmentId}/details`,
    ]) {
      const res = await page.request.get(`http://localhost:3000${path}`, {
        headers: { Authorization: `Bearer ${vendorToken}` },
      });
      expect(res.status(), `${path} must be denied`).toBe(403);
    }

    // And the UI never renders the submitted risk results for that assessment.
    await login(page, 'vendor');
    await page.goto(`/questionnaire/${assessmentId}`);
    await expect(page.getByText('Risk Assessment Complete')).toHaveCount(0, { timeout: 20_000 });
  });
});
