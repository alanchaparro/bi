import { test, expect } from '@playwright/test'

const E2E_USER = process.env.E2E_USERNAME ?? 'admin'
const E2E_PASS = process.env.E2E_PASSWORD ?? 'admin123'
const LOGIN_REDIRECT_MS = Number(process.env.E2E_LOGIN_TIMEOUT_MS) || 45_000
const LOGIN_HEADING_MS = Math.min(LOGIN_REDIRECT_MS + 10_000, 45_000)

async function loginAndWaitDashboard(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel(/usuario/i).fill(E2E_USER)
  await page.getByLabel(/contrase(ñ|n)a/i).fill(E2E_PASS)
  await page.getByRole('button', { name: /entrar/i }).click()
  await expect(page).toHaveURL(/\/(cartera|analisis-cartera|config|analisis-anuales|rendimiento|cobranzas-cohorte)/, { timeout: LOGIN_REDIRECT_MS })
  await expect(page.getByRole('heading', { name: /epem - cartera de cobranzas/i })).toBeVisible({ timeout: LOGIN_HEADING_MS })
}

test.describe('Todas las secciones tras login', () => {
  test.setTimeout(60_000)

  test.beforeEach(async ({ page }) => {
    await loginAndWaitDashboard(page)
  })

  test('Analisis de Cartera: titulo, filtros y contenido', async ({ page }) => {
    await page.goto('/analisis-cartera')
    await expect(page.getByRole('heading', { name: /analisis de cartera|análisis de cartera/i })).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByRole('button', { name: /aplicar filtros/i }).or(page.getByText(/gestion|gestión|cierre|unidad/i)).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('Analisis Anuales: pagina carga', async ({ page }) => {
    await page.getByRole('link', { name: /analisis anuales|análisis anuales/i }).click()
    await expect(page).toHaveURL(/\/analisis-anuales/)
    await expect(page.getByRole('main').or(page.locator('main'))).toBeVisible({ timeout: 10_000 })
  })

  test('Rendimiento de Cartera: titulo y contenido', async ({ page }) => {
    await page.getByRole('link', { name: /rendimiento de cartera/i }).click()
    await expect(page).toHaveURL(/\/rendimiento/)
    await expect(page.getByRole('heading', { name: /rendimiento de cartera/i })).toBeVisible({ timeout: 15_000 })
  })

  test('Analisis Cobranzas Corte: titulo y contenido', async ({ page }) => {
    await page.getByRole('link', { name: /analisis cobranzas corte|análisis cobranzas corte/i }).click()
    await expect(page).toHaveURL(/\/cobranzas-cohorte/)
    await expect(page.getByRole('heading', { name: /analisis de cobranzas por corte|análisis de cobranzas por corte|cobranzas por corte/i })).toBeVisible({ timeout: 15_000 })
  })

  test('Configuracion: seccion visible', async ({ page }) => {
    await page.getByTestId('nav-config').click()
    await expect(page).toHaveURL(/\/config/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { level: 1 }).or(page.getByRole('heading', { level: 2 })).first()).toBeVisible({ timeout: 10_000 })
  })

  test('Menu desplegable movil: abrir y cerrar', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 800 })
    const headerToggle = page.getByTestId('sidebar-toggle')
    await expect(headerToggle).toBeVisible({ timeout: 5_000 })
    await expect(headerToggle).toHaveAttribute('aria-label', /abrir men(u|ú)|cerrar men(u|ú)/i)
    await headerToggle.click()
    await expect(page.getByRole('navigation', { name: /men(u|ú) principal/i })).toBeInViewport()
    const sidebarClose = page.locator('aside').getByRole('button', { name: /^cerrar men(u|ú)$/i })
    await expect(sidebarClose).toBeVisible({ timeout: 5_000 })
    await sidebarClose.click()
    await expect(headerToggle).toHaveAttribute('aria-expanded', 'false')
  })
})
