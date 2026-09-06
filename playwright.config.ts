import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

if (!process.env.TEST_DATABASE_URL || new URL(process.env.TEST_DATABASE_URL).pathname !== '/tms_test') {
  throw new Error('TEST_DATABASE_URL must point to the dedicated tms_test database');
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'yarn workspace @tms/web exec next dev --webpack --hostname 127.0.0.1 --port 3100',
      url: 'http://127.0.0.1:3100',
      env: { API_INTERNAL_URL: 'http://127.0.0.1:3101' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'yarn workspace @tms/api build && yarn start:api',
      url: 'http://127.0.0.1:3101/health',
      env: {
        PORT: '3101',
        DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
        APP_ORIGIN: 'http://127.0.0.1:3100',
        LOGIN_IDENTITY_LIMIT: '100',
        LOGIN_IP_LIMIT: '250',
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
