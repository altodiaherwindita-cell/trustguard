import { test, expect } from '@playwright/test';
import { API_URL, login, apiToken, createVendor, createAssessment, completeAssessment, vendorOwnedAssessment } from './helpers';

test.describe('Report generation', () => {
  test('PDF and Excel reports download for an approved assessment', async ({ page }) => {
    const assessmentId = await vendorOwnedAssessment(
      page.request,
      `E2E Report Vendor ${Date.now()}`,
    );
    await completeAssessment(page.request, assessmentId, 'vendor');

    // Approve so the export buttons become available.
    const token = await apiToken(page.request, 'analyst');
    const review = await page.request.post(`${API_URL}/api/assessments/${assessmentId}/review`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        action: 'approve',
        riskScore: 72,
        riskLevel: 'medium',
        overallScore: 78,
        aiSummary: 'E2E generated summary',
        strengths: ['Strong encryption'],
        weaknesses: ['Thin incident response'],
        recommendations: ['Add MFA'],
        comments: 'E2E approval',
      },
    });
    expect(review.ok(), await review.text()).toBeTruthy();

    await login(page, 'analyst');
    await page.goto('/assessments');

    const card = page.locator('div.rounded-xl.border', { hasText: 'E2E Report Vendor' }).first();
    await expect(card).toBeVisible({ timeout: 20_000 });

    // PDF — assert real PDF magic bytes, not just a 200.
    const pdfDownload = page.waitForEvent('download');
    await card.getByRole('button', { name: 'PDF' }).click();
    const pdf = await pdfDownload;
    expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
    expect((await firstBytes(await pdf.createReadStream(), 5)).toString('latin1')).toBe('%PDF-');

    await expect(page.getByText(/pdf downloaded successfully/i)).toBeVisible({ timeout: 20_000 });

    // Excel — xlsx is a zip container, so it starts with the PK signature.
    const xlsxDownload = page.waitForEvent('download');
    await card.getByRole('button', { name: 'Excel' }).click();
    const xlsx = await xlsxDownload;
    expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/);
    expect((await firstBytes(await xlsx.createReadStream(), 2)).toString('latin1')).toBe('PK');

    await expect(page.getByText(/excel downloaded successfully/i)).toBeVisible({ timeout: 20_000 });
  });

  test('PDF body renders answers instead of crashing on string answers', async ({ page }) => {
    // Regression: answers are JSONB, so pg returns "Yes" as a JS string.
    // The route used to JSON.parse it and 500 the request (and kill the process).
    const assessmentId = await vendorOwnedAssessment(
      page.request,
      `E2E PdfBody Vendor ${Date.now()}`,
    );
    await completeAssessment(page.request, assessmentId, 'vendor');

    const token = await apiToken(page.request, 'analyst');
    const res = await page.request.get(`${API_URL}/api/reports/assessment/${assessmentId}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status(), await res.text()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/pdf');

    const body = await res.body();
    expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(body.length).toBeGreaterThan(1000);
  });

  test('Excel body is a valid workbook', async ({ page }) => {
    const assessmentId = await vendorOwnedAssessment(
      page.request,
      `E2E XlsxBody Vendor ${Date.now()}`,
    );
    await completeAssessment(page.request, assessmentId, 'vendor');

    const token = await apiToken(page.request, 'analyst');
    const res = await page.request.get(`${API_URL}/api/reports/assessment/${assessmentId}/excel`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status(), await res.text()).toBe(200);
    const body = await res.body();
    expect(body.subarray(0, 2).toString('latin1')).toBe('PK');
    expect(body.length).toBeGreaterThan(1000);
  });

  test('export buttons are hidden until the assessment is reviewed', async ({ page }) => {
    const vendorId = await createVendor(page.request, `E2E NoReport Vendor ${Date.now()}`);
    await createAssessment(page.request, vendorId);

    await login(page, 'analyst');
    await page.goto('/assessments');

    const card = page.locator('div.rounded-xl.border', { hasText: 'E2E NoReport Vendor' }).first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.getByRole('button', { name: 'PDF' })).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Excel' })).toHaveCount(0);
  });

  test('report endpoints reject an unauthenticated caller', async ({ page }) => {
    const vendorId = await createVendor(page.request, `E2E AuthReport Vendor ${Date.now()}`);
    const assessmentId = await createAssessment(page.request, vendorId);

    const res = await page.request.get(`${API_URL}/api/reports/assessment/${assessmentId}/pdf`);
    expect(res.status()).toBe(401);
  });
});

/** Read the first `n` bytes of a stream, then destroy it. */
async function firstBytes(stream: NodeJS.ReadableStream, n: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let len = 0;
    stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      len += chunk.length;
      if (len >= n) {
        (stream as NodeJS.ReadStream).destroy();
        resolve(Buffer.concat(chunks).subarray(0, n));
      }
    });
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).subarray(0, n)));
  });
}
