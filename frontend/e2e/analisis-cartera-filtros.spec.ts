import { test, expect } from '@playwright/test'

const E2E_USER = process.env.E2E_USERNAME ?? 'admin'
const E2E_PASS = process.env.E2E_PASSWORD ?? 'admin123'

test.describe('Analisis de Cartera - filtros y datos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/usuario/i).fill(E2E_USER)
    await page.getByLabel(/contrase(ñ|n)a/i).fill(E2E_PASS)
    await page.getByRole('button', { name: /entrar/i }).click()
    await expect(page.getByRole('navigation', { name: /men(u|ú) principal/i })).toBeVisible({ timeout: 15_000 })
    await page.goto('/analisis-cartera')
  })

  test('la pagina muestra titulo y zona de contenido', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /analisis de cartera|análisis de cartera/i })).toBeVisible({ timeout: 15_000 })
    const main = page.getByRole('main').or(page.locator('[class*="container-main"]'))
    await expect(main.first()).toBeVisible({ timeout: 10_000 })
  })

  test('tras cargar se ven filtros o resumen', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /analisis de cartera|análisis de cartera/i })).toBeVisible({ timeout: 15_000 })
    await expect(
      page.locator('.analysis-filters-grid, .analysis-selection-summary, .ui-state').first()
    ).toBeVisible({ timeout: 20_000 })
  })

  test('abrir un filtro no rompe la pagina', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /analisis de cartera|análisis de cartera/i })).toBeVisible({ timeout: 15_000 })
    const filterByLabel = page.getByLabel(/unidad de negocio|mes de gestión|mes de cierre|fecha de gestión|fecha de cierre/i).first()
    const hasFilter = (await filterByLabel.count()) > 0
    if (hasFilter) {
      await filterByLabel.getByRole('button').click()
      await expect(page.locator('[role="listbox"]').first()).toBeVisible({ timeout: 5_000 })
    }
    await expect(page.getByRole('heading', { name: /analisis de cartera|análisis de cartera/i })).toBeVisible()
  })
})
