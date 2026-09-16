import { test, expect } from '@playwright/test';
import { login, apiToken, createVendor, createAssessment, completeAssessment, vendorOwnedAssessment } from './helpers';

/** Vendor + submitted assessment, ready for a TPRM analyst to review. */
async function submittedAssessment(request: Parameters<typeof apiToken>[0]) {
  const assessmentId = await vendorOwnedAssessment(
    request,
    `E2E Review Vendor ${Date.now()}`,
  );
  await completeAssessment(request, assessmentId, 'vendor');
  return assessmentId;
}

test.describe('Review and approval flow', () => {
  test('review actions appear only for a submitted assessment', async ({ page }) => {
    const notStarted = await vendorOwnedAssessment(page.request, `E2E Gating Vendor ${Date.now()}`);

    await login(page, 'analyst');
    await page.goto('/assessments');

    // A not-started assessment offers no Approve/Reject/Revision buttons.
    const card = page.locator('div.rounded-xl.border', { hasText: 'E2E Gating Vendor' }).first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.getByRole('button', { name: 'Approve' })).toHaveCount(0);

    // Once submitted, they appear.
    await completeAssessment(page.request, notStarted, 'vendor');
    await page.reload();
    const submittedCard = page
      .locator('div.rounded-xl.border', { hasText: 'E2E Gating Vendor' })
      .first();
    await expect(submittedCard.getByRole('button', { name: 'Approve' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(submittedCard.getByRole('button', { name: 'Reject' })).toBeVisible();
    await expect(submittedCard.getByRole('button', { name: 'Request Revision' })).toBeVisible();
  });

  test('analyst approves an assessment and it moves to Approved', async ({ page }) => {
    const assessmentId = await submittedAssessment(page.request);

    await login(page, 'analyst');
    await page.goto('/assessments');

    const card = page.locator('div.rounded-xl.border', { hasText: 'E2E Review Vendor' }).first();
    await expect(card.getByRole('button', { name: 'Approve' })).toBeVisible({ timeout: 20_000 });

    // The review action is confirmed with a native dialog.
    page.once('dialog', (d) => d.accept());
    await card.getByRole('button', { name: 'Approve' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /Approve/ }).click();

    await expect(page.getByText(/approved successfully/i)).toBeVisible({ timeout: 20_000 });
    await expect(card.getByText('Approved')).toBeVisible({ timeout: 20_000 });

    // The server agrees.
    const token = await apiToken(page.request, 'analyst');
    const res = await page.request.get(`http://localhost:3000/api/assessments/${assessmentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    expect(body.data.status).toBe('approved');
    expect(body.data.reviewed_at).toBeTruthy();
  });

  test('requesting a revision moves the assessment to Revision Requested', async ({ page }) => {
    await submittedAssessment(page.request);

    await login(page, 'analyst');
    await page.goto('/assessments');

    const card = page.locator('div.rounded-xl.border', { hasText: 'E2E Review Vendor' }).first();
    await expect(card.getByRole('button', { name: 'Request Revision' })).toBeVisible({
      timeout: 20_000,
    });

    page.once('dialog', (d) => d.accept());
    await card.getByRole('button', { name: 'Request Revision' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /Request Revision/ }).click();

    await expect(page.getByText(/request revisiond successfully/i)).toBeVisible({ timeout: 20_000 });
    await expect(card.getByText('Revision Requested')).toBeVisible({ timeout: 20_000 });
  });

  test('review history records each action', async ({ page }) => {
    await submittedAssessment(page.request);

    await login(page, 'analyst');
    await page.goto('/assessments');

    const card = page.locator('div.rounded-xl.border', { hasText: 'E2E Review Vendor' }).first();
    await expect(card.getByRole('button', { name: 'Approve' })).toBeVisible({ timeout: 20_000 });

    page.once('dialog', (d) => d.accept());
    await card.getByRole('button', { name: 'Approve' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Approve/ }).click();
    await expect(page.getByText(/approved successfully/i)).toBeVisible({ timeout: 20_000 });

    await card.getByRole('button', { name: 'History' }).click();
    const history = page.getByRole('dialog');
    await expect(history).toBeVisible();
    await expect(history.getByText(/approve/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(history.getByText('E2E Analyst').first()).toBeVisible();
  });
});
