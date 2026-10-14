import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  timeout: 45000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.F1_TEST_URL || 'http://127.0.0.1:3029',
    trace: 'retain-on-failure',
    // Offline/CI containers may ship a different Chromium build; F1_CHROME points Playwright at it.
    launchOptions: process.env.F1_CHROME
      ? { executablePath: process.env.F1_CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] }
      : undefined,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } },
    },
    { name: 'android', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run start',
    url: process.env.F1_TEST_URL || 'http://127.0.0.1:3029',
    reuseExistingServer: true,
    timeout: 60000,
  },
});
