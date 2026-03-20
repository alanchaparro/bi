import { test, expect } from '@playwright/test'

const E2E_USER = process.env.E2E_USERNAME ?? 'admin'
const E2E_PASS = process.env.E2E_PASSWORD ?? 'admin123'

test.describe('Menu de navegacion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/usuario/i).fill(E2E_USER)
    await page.getByLabel(/contrase(ñ|n)a/i).fill(E2E_PASS)
    await page.getByRole('button', { name: /entrar/i }).click()
    await expect(page).toHaveURL(/\/(analisis-cartera|config|analisis-anuales|rendimiento|cobranzas-cohorte)/, { timeout: 15_000 })
    await expect(page.getByTestId('sidebar-toggle')).toBeVisible({ timeout: 15_000 })
  })

  test('tras login, el menu muestra enlaces a analiticas y configuracion', async ({ page }) => {
    await expect(page.getByRole('link', { name: /analisis de cartera|análisis de cartera/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /configuraci(o|ó)n/i })).toBeVisible()
  })

  test('clic en configuracion muestra la seccion correspondiente', async ({ page }) => {
    await page.getByRole('link', { name: /configuraci(o|ó)n/i }).click()
    await expect(page).toHaveURL(/\/config/)
    await expect(page.getByRole('heading', { name: /configuraci(o|ó)n/i })).toBeVisible({ timeout: 5_000 })
  })

  test('clic en analisis anuales navega y muestra contenido', async ({ page }) => {
    await page.getByRole('link', { name: /analisis anuales|análisis anuales/i }).click()
    await expect(page).toHaveURL(/\/analisis-anuales/)
    await expect(page.getByRole('main').or(page.locator('main'))).toBeVisible({ timeout: 5_000 })
  })

  test('toggle del sidebar abre y cierra el menu', async ({ page }) => {
    const toggle = page.getByTestId('sidebar-toggle')
    const nav = page.getByRole('navigation', { name: /men(u|ú) principal/i })
    await expect(toggle).toBeVisible()
    const expanded = await toggle.getAttribute('aria-expanded')
    if (expanded === 'false') {
      await toggle.click()
      await expect(nav).toBeVisible({ timeout: 5_000 })
    }
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false', { timeout: 5_000 })
  })

  test('clic en rendimiento de cartera navega a /rendimiento', async ({ page }) => {
    await page.getByTestId('nav-rendimiento-cartera').click()
    await expect(page).toHaveURL(/\/rendimiento/, { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: /rendimiento de cartera/i })).toBeVisible({ timeout: 10_000 })
  })
})
