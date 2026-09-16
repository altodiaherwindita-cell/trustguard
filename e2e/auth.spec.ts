import { test, expect } from '@playwright/test';
import { ACCOUNTS, login } from './helpers';

test.describe('Authentication and role gating', () => {
  test('unauthenticated visitor is redirected to /auth with a redirect param', async ({ page }) => {
    await page.goto('/vendors');
    await expect(page).toHaveURL(/\/auth\?redirect=/);
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  });

  test('rejects a bad password without creating a session', async ({ page }) => {
    await page.goto('/auth');
    await page.fill('#email', ACCOUNTS.admin.email);
    await page.fill('#password', 'definitely-not-the-password');
    await page.click('button[type=submit]');

    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
    await expect(page).toHaveURL(/\/auth/);
    expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();
  });

  test('admin lands on the dashboard and sees admin-only navigation', async ({ page }) => {
    await login(page, 'admin');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link', { name: 'Audit Logs' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Vendors' })).toBeVisible();
  });

  test('vendor does not get TPRM or admin navigation', async ({ page }) => {
    await login(page, 'vendor');

    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link', { name: 'Evidence' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Vendors' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Audit Logs' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'AI Assistant' })).toHaveCount(0);
  });

  test('vendor is bounced off admin-only routes by RequireAuth', async ({ page }) => {
    await login(page, 'vendor');

    for (const path of ['/audit-logs', '/users', '/vendors']) {
      await page.goto(path);
      await expect(page, `${path} should redirect a vendor`).toHaveURL(/\/$|\/\?/);
    }
  });

  test('sign out clears the session and re-gates the app', async ({ page }) => {
    await login(page, 'admin');
    expect(await page.evaluate(() => localStorage.getItem('auth_token'))).not.toBeNull();

    await page.getByTitle('Sign out').click();
    await expect(page).toHaveURL(/\/auth/);
    expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();

    await page.goto('/vendors');
    await expect(page).toHaveURL(/\/auth/);
  });

  test('a tampered token is rejected and the session is cleared', async ({ page }) => {
    await login(page, 'admin');

    // Corrupt the signature but keep a well-formed JWT shape.
    await page.evaluate(() => {
      const t = localStorage.getItem('auth_token')!;
      const [h, p] = t.split('.');
      localStorage.setItem('auth_token', `${h}.${p}.deadbeefsignature`);
    });

    await page.goto('/vendors');
    await expect(page).toHaveURL(/\/auth/, { timeout: 20_000 });
    expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();
  });
});
