import { defineConfig, devices } from '@playwright/test';

/**
 * בדיקות דפדפן. רצות מול האתר הבנוי (dist), כפי שהוא עולה לאוויר, ולא מול שרת הפיתוח.
 * הרצה: npm run verify (בונה ואז בודק), או npx playwright test אחרי npm run build.
 */
const PORT = 4329;
const BASE = `http://localhost:${PORT}/tash-tzrifin/`;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [[process.env.CI ? 'list' : 'dot']],
  timeout: 30_000,
  use: {
    ...devices['Pixel 7'],
    baseURL: BASE,
    viewport: { width: 375, height: 812 },
    locale: 'he-IL',
  },
  webServer: {
    command: `npx astro preview --port ${PORT}`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
