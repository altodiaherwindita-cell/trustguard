import { defineConfig, devices } from '@playwright/test';

const WEB_URL = process.env.E2E_WEB_URL || 'http://localhost:8080';
const API_URL = process.env.E2E_API_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // specs share one database
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Both servers are assumed to be running. Start them with:
  //   docker run -d --name tg-e2e-pg ... postgres:15-alpine   (see e2e/README.md)
  //   ./e2e/start-api.sh
  //   npm run dev
  // Playwright does not manage them so a failure mid-run leaves the stack up for
  // debugging.
  metadata: { apiUrl: API_URL },
});
