import { test, expect } from '@playwright/test';
import { login } from './helpers';

// Regression: /remediation was linked from the sidebar and /notifications from
// the header bell, but neither had a <Route>. Both rendered NotFound.
test.describe('Navigation reaches every linked page', () => {
  test('sidebar links all resolve to a real page', async ({ page }) => {
    await login(page, 'admin');

    for (const [name, href] of [
      ['Dashboard', '/'],
      ['Vendors', '/vendors'],
      ['Assessments', '/assessments'],
      ['Questionnaires', '/questionnaires'],
      ['Evidence', '/evidence'],
      ['Remediation', '/remediation'],
      ['Audit Logs', '/audit-logs'],
      ['AI Assistant', '/ai-assistant'],
      ['Settings', '/settings'],
    ] as const) {
      await page.goto(href, { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Oops! Page not found'), `${name} (${href}) must be routed`).toHaveCount(0);
    }
  });

  test('the header bell opens notifications, not NotFound', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/notifications', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Oops! Page not found')).toHaveCount(0);
  });

  test('the remediation page renders its tabs', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/remediation', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('tab', { name: /In Progress/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('tab', { name: /Overdue/ })).toBeVisible();
  });
});
