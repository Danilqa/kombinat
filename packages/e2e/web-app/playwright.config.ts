import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../../web-app/src',
  testMatch: '**/*.e2e.ts',
  globalSetup: './global-setup.ts',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  use: {
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
