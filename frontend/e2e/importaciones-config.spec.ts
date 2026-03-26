/**
 * Flujo Config → Importaciones: botones masivo vs defecto.
 * Ejecutar contra dev (3000, levanta API) o Docker (8080): E2E_BASE_URL=http://localhost:8080 npx playwright test importaciones-config.spec.ts
 */
import { expect, test } from '@playwright/test'

const E2E_USER = process.env.E2E_USERNAME ?? 'admin'
const E2E_PASS = process.env.E2E_PASSWORD ?? 'admin123'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel(/usuario/i).fill(E2E_USER)
  await page.getByLabel(/contraseña/i).fill(E2E_PASS)
  await page.getByRole('button', { name: /entrar/i }).click()
  await expect(page).toHaveURL(/\/(cartera|analisis-cartera)/, { timeout: 20_000 })
}

test.describe('Config — Importaciones (experiencia operativa)', () => {
  test.use({ viewport: { width: 1366, height: 768 } })

  test('Seleccionar todos activa modo masivo; Solo Analytics restaura defecto', async ({ page }) => {
    await login(page)
    await page.goto('/config')
    await expect(page.getByRole('heading', { name: /configuración/i })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('tab', { name: /^importaciones$/i }).click()
    await expect(page.getByRole('heading', { name: /carga dual sql/i })).toBeVisible()

    await page.getByRole('button', { name: /seleccionar todos los dominios/i }).click()
    await expect(page.locator('p.config-warn-text')).toBeVisible()

    for (const name of ['Analytics', 'Cartera', 'Cobranzas', 'Contratos', 'Gestores']) {
      const row = page.locator('label.config-check-row').filter({ hasText: name })
      await expect(row.locator('input[type="checkbox"]')).toBeChecked()
    }

    await page.getByRole('button', { name: /solo analytics \(por defecto\)/i }).click()
    const analyticsOnly = page.locator('label.config-check-row').filter({ hasText: /^Analytics$/ })
    await expect(analyticsOnly.locator('input[type="checkbox"]')).toBeChecked()
    for (const name of ['Cartera', 'Cobranzas', 'Contratos', 'Gestores']) {
      const row = page.locator('label.config-check-row').filter({ hasText: name })
      await expect(row.locator('input[type="checkbox"]')).not.toBeChecked()
    }
    await expect(page.locator('p.config-warn-text')).toHaveCount(0)
  })
})
