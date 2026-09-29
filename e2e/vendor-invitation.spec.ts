import { test, expect } from '@playwright/test';
import { API_URL, login, apiToken, createVendor, createAssessment } from './helpers';

test.describe('Vendor invitation flow', () => {
  test('analyst adds a vendor and the invite link carries a backend-issued token', async ({ page }) => {
    const name = `E2E Invite Vendor ${Date.now()}`;
    await login(page, 'analyst');
    await page.goto('/vendors');

    // Scope to the page body: the sidebar has its own "Add Vendor" quick action.
    await page.getByRole('main').getByRole('button', { name: 'Add Vendor' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByLabel('Category').fill('Cloud Services');
    await dialog.getByLabel('Contact Email').fill('invitee@e2e.test');
    await dialog.getByRole('button', { name: /Add Vendor/i }).click();

    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toBeVisible({ timeout: 20_000 });

    // "Send Questionnaire" creates the assessment AND the invitation server-side.
    await row.getByRole('button', { name: /Send Questionnaire/i }).click();

    const linkInput = page.getByRole('dialog').locator('input[readonly]');
    await expect(linkInput).toBeVisible({ timeout: 20_000 });
    const link = await linkInput.inputValue();
    expect(link).toMatch(/\/invite\/[a-f0-9]{64}$/);

    // The token must resolve server-side — a client-minted UUID would 404 here.
    const token = link.split('/invite/')[1];
    const res = await page.request.get(`${API_URL}/api/invitations/${token}`);
    expect(res.status(), 'invite token must exist in the database').toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.vendor_name).toBe(name);
    expect(body.assessment_id).toBeTruthy();
  });

  test('invitee sees the sign-in prompt for a real token', async ({ page }) => {
    const token = await apiToken(page.request, 'analyst');
    const vendorId = await createVendor(page.request, `E2E Invitee ${Date.now()}`);
    const assessmentId = await createAssessment(page.request, vendorId);
    const inviteRes = await page.request.post(`${API_URL}/api/invitations`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        vendorId,
        assessmentId,
        email: 'invitee2@e2e.test',
        sendEmailNotification: false,
      },
    });
    expect(inviteRes.ok(), await inviteRes.text()).toBeTruthy();
    const realToken = (await inviteRes.json()).invitation.token;

    await page.goto(`/invite/${realToken}`);
    await expect(page.getByRole('button', { name: /Sign in \/ Sign up/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/invited to complete a security questionnaire/i)).toBeVisible();
  });

  test('an unknown token is reported invalid, not silently accepted', async ({ page }) => {
    await page.goto('/invite/deadbeefdeadbeefdeadbeefdeadbeef');
    await expect(page.getByText(/invalid or expired/i)).toBeVisible({ timeout: 20_000 });
    // Must NOT offer to continue into a questionnaire.
    await expect(page.getByRole('button', { name: /Sign in \/ Sign up/i })).toHaveCount(0);
  });
});
