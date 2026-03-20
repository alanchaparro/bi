import { defineConfig, devices } from '@playwright/test'

/** URL del frontend para E2E. Por defecto localhost:8080 (Docker frontend-prod). */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:8080'
const isLocalDev = baseURL.includes('3000') || baseURL.includes('5173')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  /** 1 retry local para tests con login (p. ej. secciones); en CI ya hay 2. */
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Solo arrancar servidores si se usa dev (3000/5173). Para 8080 se asume Docker ya levantado.
  webServer: isLocalDev
    ? [
        {
          command: 'docker compose --profile dev up api-v1',
          cwd: '..',
          url: 'http://localhost:8000/api/v1/health',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: 'npm run dev',
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      ]
    : undefined,
})
