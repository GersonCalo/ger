import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

const MOBILE_PROJECTS = [
  { name: 'android-small', device: 'Galaxy S9+', browser: 'chromium' },
  { name: 'android-large', device: 'Pixel 7', browser: 'chromium' },
  { name: 'ios-small', device: 'iPhone SE', browser: 'webkit' },
  { name: 'ios-large', device: 'iPhone 14', browser: 'webkit' },
] as const;

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 1,
  workers: isCI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFolder: 'playwright-report', outputFile: 'results.json' }],
    ['junit', { outputFolder: 'playwright-report', outputFile: 'junit.xml' }],
    ['list'],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    navigationTimeout: 30000,
    actionTimeout: 10000,
  },
  timeout: 60000,
  projects: MOBILE_PROJECTS.map(({ name, device }) => ({
    name,
    use: {
      ...devices[device],
      locale: 'es-ES',
      timezoneId: 'America/Caracas',
    },
  })),
  webServer: isCI
    ? undefined
    : {
        command: 'npm run dev:web',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
