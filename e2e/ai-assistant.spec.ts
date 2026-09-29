import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('AI Assistant', () => {
  test('vendor is bounced from /ai-assistant', async ({ page }) => {
    await login(page, 'vendor');
    await page.goto('/ai-assistant');
    // RequireAuth redirects non-TPRM roles to the dashboard.
    await expect(page).toHaveURL(/\/$|\/dashboard/);
    await expect(page).not.toHaveURL(/ai-assistant/);
  });

  test('TPRM user sees the AI Assistant page', async ({ page }) => {
    await login(page, 'analyst');
    await page.goto('/ai-assistant');
    await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible();
  });

  test('sending a prompt without a configured key shows the not-configured notice', async ({ page }) => {
    await login(page, 'analyst');
    await page.goto('/ai-assistant');
    await page.fill('input[placeholder*="Ask me about"]', 'What is our biggest vendor risk?');
    await page.click('button:has(svg.lucide-send)');

    const notice = page.getByTestId('ai-not-configured');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('AI is not configured');
    // No canned reply was faked in its place.
    await expect(
      page.getByText('Based on my analysis of CloudSecure Inc.'),
    ).toHaveCount(0);
  });
});
