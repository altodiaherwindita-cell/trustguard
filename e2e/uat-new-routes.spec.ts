/**
 * UAT for the routes added after the original suite was written:
 * questions CRUD, remediation create-from-list, remediation comments
 * (including the is_internal visibility boundary), and evidence upload.
 *
 * These drive the real UI against the real API and real Postgres. No mocking.
 */
import { test, expect, Page } from '@playwright/test';
import { login, apiToken, API_URL, vendorOwnedAssessment } from './helpers';

/** Collect console errors and 4xx/5xx responses so a silent failure is visible. */
function watch(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().includes('/api/')) {
      errors.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
    }
  });
  return errors;
}

test.describe('UAT: question management', () => {
  test('analyst creates, edits, and deletes a question through the UI', async ({ page }) => {
    const errors = watch(page);
    await login(page, 'analyst');
    await page.goto('/questionnaires');

    await expect(page.getByRole('heading', { name: 'Questionnaire Management' })).toBeVisible();
    const before = await page.getByText(/^Questions \(\d+\)$/).textContent();

    // --- Create ---
    await page.getByRole('button', { name: /Add Question/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Add New Question')).toBeVisible();

    const marker = `UAT question ${Date.now()}`;
    // Category is a Radix Select, not a text input.
    await dialog.locator('#category').click();
    await page.getByRole('option', { name: 'Compliance' }).click();
    await dialog.locator('#question').fill(marker);
    await dialog.locator('#weight').fill('7');
    await dialog.getByRole('button', { name: 'Create Question' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText(marker)).toBeVisible();

    // --- Edit ---
    const rowOf = (text: string) => page.locator('div.justify-between').filter({ hasText: text });
    await rowOf(marker).getByRole('button').first().click();
    await expect(page.getByRole('dialog').getByText('Edit Question')).toBeVisible();
    const edited = `${marker} (edited)`;
    await page.getByRole('dialog').locator('#question').fill(edited);
    await page.getByRole('dialog').getByRole('button', { name: 'Update Question' }).click();
    await expect(page.getByText(edited)).toBeVisible();

    // --- Delete --- (the page uses a native confirm())
    page.once('dialog', (d) => d.accept());
    await rowOf(edited).getByRole('button').last().click();
    await expect(page.getByText(edited)).toBeHidden();

    const after = await page.getByText(/^Questions \(\d+\)$/).textContent();
    expect(after).toBe(before);
    expect(errors).toEqual([]);
  });
});

test.describe('UAT: remediation', () => {
  test('analyst creates an item from the list page, which has no assessment in scope', async ({ page }) => {
    const errors = watch(page);
    // Seed an assessment so the picker has something to choose.
    await vendorOwnedAssessment(page.request, `UAT Remediation Vendor ${Date.now()}`);

    await login(page, 'analyst');
    await page.goto('/remediation');

    await expect(page.getByRole('heading', { name: 'Remediation Tracking' })).toBeVisible();
    await page.getByRole('button', { name: /Create Remediation/ }).click();

    const dialog = page.getByRole('dialog');
    // The assessment picker only renders when the page has no assessmentId,
    // which is the /remediation route's whole reason for existing.
    await expect(dialog.locator('#assessment')).toBeVisible();
    await dialog.locator('#assessment').click();
    const option = page.getByRole('option').first();
    await expect(option).toBeVisible();
    await option.click();
    // Radix keeps the placeholder until the value actually commits; asserting on
    // it stops the create from racing ahead with an empty assessment_id.
    await expect(dialog.locator('#assessment')).not.toContainText('Select the assessment');

    const title = `UAT finding ${Date.now()}`;
    await dialog.locator('#title').fill(title);
    await dialog.locator('#description').fill('UAT: created from the list page.');
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText(title)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('internal comment is hidden from the vendor, visible to the analyst', async ({ page }) => {
    const assessmentId = await vendorOwnedAssessment(
      page.request,
      `UAT Comment Vendor ${Date.now()}`,
    );

    // Analyst creates the item and posts an internal note.
    const adminToken = await apiToken(page.request, 'admin');
    const created = await page.request.post(`${API_URL}/api/remediation`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        assessment_id: assessmentId,
        title: 'UAT internal note item',
        description: 'UAT: internal note visibility.',
      },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    const itemId = (await created.json()).remediation.id;

    const secret = `INTERNAL-ONLY-${Date.now()}`;
    const posted = await page.request.post(`${API_URL}/api/remediation/${itemId}/comment`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { comment: secret, is_internal: true },
    });
    expect(posted.ok(), await posted.text()).toBeTruthy();

    // The analyst sees it.
    const asAdmin = await page.request.get(`${API_URL}/api/remediation/${assessmentId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(JSON.stringify(await asAdmin.json())).toContain(secret);

    // The owning vendor does not.
    const vendorToken = await apiToken(page.request, 'vendor');
    const asVendor = await page.request.get(`${API_URL}/api/remediation/${assessmentId}`, {
      headers: { Authorization: `Bearer ${vendorToken}` },
    });
    expect(asVendor.ok(), await asVendor.text()).toBeTruthy();
    expect(JSON.stringify(await asVendor.json())).not.toContain(secret);

    // A vendor posting with is_internal: true is forced to false.
    const forced = await page.request.post(`${API_URL}/api/remediation/${itemId}/comment`, {
      headers: { Authorization: `Bearer ${vendorToken}` },
      data: { comment: 'vendor trying to post internal', is_internal: true },
    });
    expect(forced.ok(), await forced.text()).toBeTruthy();

    const rows = await page.request.get(
      `${API_URL}/api/remediation/${assessmentId}`,
      { headers: { Authorization: `Bearer ${vendorToken}` } },
    );
    expect(JSON.stringify(await rows.json())).toContain('vendor trying to post internal');
  });
});

test.describe('UAT: evidence', () => {
  test('analyst uploads a file and downloads it back byte-for-byte', async ({ page }) => {
    const errors = watch(page);
    const vendorName = `UAT Evidence Vendor ${Date.now()}`;
    const assessmentId = await vendorOwnedAssessment(page.request, vendorName);

    await login(page, 'analyst');
    await page.goto('/evidence');

    // Scope to the assessment we just made. The name carries a timestamp so it
    // is unique even though earlier runs left assessments behind.
    await page.getByRole('button', { name: new RegExp(vendorName) }).click();
    await page.getByRole('button', { name: /Upload Evidence/ }).click();

    // A 1x1 PNG: the client and server both allowlist by MIME type, and
    // text/plain is deliberately not on it.
    const payload = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    await page.getByRole('dialog').locator('#file').setInputFiles({
      name: 'uat-evidence.png',
      mimeType: 'image/png',
      buffer: payload,
    });
    await page.getByRole('dialog').locator('#description').fill('UAT upload');
    await page.getByRole('dialog').getByRole('button', { name: 'Upload' }).click();

    await expect(page.getByText('uat-evidence.png')).toBeVisible();

    // The download route reads from disk via the stored path; if the hash or
    // path handling regressed this is where it shows.
    const token = await apiToken(page.request, 'admin');
    const list = await page.request.get(`${API_URL}/api/evidence/${assessmentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(list.ok(), await list.text()).toBeTruthy();
    const doc = (await list.json()).evidence.find(
      (d: { file_name: string }) => d.file_name === 'uat-evidence.png',
    );
    expect(doc, 'uploaded document missing from list').toBeTruthy();

    const download = await page.request.get(`${API_URL}/api/evidence/${doc.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(download.ok(), await download.text()).toBeTruthy();
    expect(Buffer.from(await download.body()).equals(payload)).toBe(true);

    expect(errors).toEqual([]);
  });
});
