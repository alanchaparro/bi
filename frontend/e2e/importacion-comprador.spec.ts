/**
 * Experiencia comprador: ejecutar importación y capturar resultado (OK / error).
 *
 * - Por defecto `E2E_IMPORT_SCOPE=cartera` (un dominio + rango cierre): suele terminar en minutos.
 * - `E2E_IMPORT_SCOPE=masiva`: todos los dominios + confirmación modal; puede tardar **mucho** (desactiva reintentos).
 *
 * PowerShell:
 *   cd frontend
 *   $env:E2E_BASE_URL='http://localhost:3000'   # o http://localhost:8080 con stack ya arriba
 *   $env:E2E_IMPORT_SCOPE='cartera'               # opcional; es el default
 *   $env:E2E_IMPORT_FULL_YEAR='1'                 # opcional: 01–12/2025 (lento)
 *   npx playwright test importacion-comprador.spec.ts --project=chromium
 */
import * as fs from 'fs'
import * as path from 'path'
import { expect, test } from '@playwright/test'

const E2E_USER = process.env.E2E_USERNAME ?? 'admin'
const E2E_PASS = process.env.E2E_PASSWORD ?? 'admin123'
const IMPORT_SCOPE = process.env.E2E_IMPORT_SCOPE ?? 'cartera'
/** `0` = rango ancho 01–12/2025 (lento). Por defecto un solo mes (rápido para ver resultado en E2E). */
const IMPORT_FULL_YEAR = process.env.E2E_IMPORT_FULL_YEAR === '1'
const TMP = path.join(process.cwd(), 'tmp')

function ensureTmp() {
  fs.mkdirSync(TMP, { recursive: true })
}

test.describe.configure({ retries: IMPORT_SCOPE === 'masiva' ? 0 : 1 })

test.describe('Importación — mirada comprador (resultado real)', () => {
  test.use({ viewport: { width: 1366, height: 768 } })

  test.beforeAll(() => {
    ensureTmp()
  })

  test('ejecutar carga y capturar resultado para revisión ejecutiva', async ({ page }) => {
    test.setTimeout(IMPORT_SCOPE === 'masiva' ? 900_000 : 420_000)

    await page.goto('/login')
    await page.getByLabel(/usuario/i).fill(E2E_USER)
    await page.getByLabel(/contraseña/i).fill(E2E_PASS)
    await page.getByRole('button', { name: /entrar/i }).click()
    await expect(page).toHaveURL(/\/(cartera|analisis-cartera)/, { timeout: 25_000 })

    await page.goto('/config')
    await expect(page.getByRole('heading', { name: /configuración/i })).toBeVisible({ timeout: 25_000 })
    await page.getByRole('tab', { name: /^importaciones$/i }).click()
    await expect(page.getByRole('heading', { name: /carga dual sql/i })).toBeVisible()

    if (IMPORT_SCOPE === 'masiva') {
      await page.getByRole('button', { name: /seleccionar todos los dominios/i }).click()
      await expect(page.locator('p.config-warn-text')).toBeVisible()
    } else {
      await page.getByRole('button', { name: /solo analytics \(por defecto\)/i }).click()
      const analyticsRow = page.locator('label.config-check-row').filter({ hasText: /^Analytics$/ })
      await analyticsRow.locator('input[type="checkbox"]').uncheck()
      const carteraRow = page.locator('label.config-check-row').filter({ hasText: 'Cartera' })
      await carteraRow.locator('input[type="checkbox"]').check()
      await expect(analyticsRow.locator('input[type="checkbox"]')).not.toBeChecked()
      await expect(carteraRow.locator('input[type="checkbox"]')).toBeChecked()
    }

    if (IMPORT_FULL_YEAR) {
      await page.getByPlaceholder('MM').first().fill('01')
      await page.getByPlaceholder('MM').nth(1).fill('12')
    } else {
      await page.getByPlaceholder('MM').first().fill('03')
      await page.getByPlaceholder('MM').nth(1).fill('03')
    }
    await page.getByPlaceholder('YYYY').first().fill('2025')
    await page.getByPlaceholder('YYYY').nth(1).fill('2025')

    await page.screenshot({
      path: path.join(TMP, `experiencia-comprador-importacion-pre-ejecutar-${IMPORT_SCOPE}.png`),
      fullPage: true,
    })

    await page.getByRole('button', { name: /ejecutar carga/i }).click()

    if (IMPORT_SCOPE === 'masiva') {
      const dialog = page.getByRole('dialog', { name: /confirmar carga masiva/i })
      try {
        await dialog.waitFor({ state: 'visible', timeout: 180_000 })
        await page.screenshot({
          path: path.join(TMP, 'experiencia-comprador-importacion-modal-confirmar.png'),
          fullPage: true,
        })
        await page.getByRole('button', { name: /confirmar y continuar/i }).click()
      } catch {
        /* sin modal: preview deshabilitado o riesgo bajo */
      }
    }

    const outcome = page.locator('.status-ok').or(page.locator('.status-error')).first()
    const syncingBtn = page.getByRole('button', { name: /sincronizando/i })

    await Promise.race([
      outcome.waitFor({ state: 'visible', timeout: 120_000 }),
      syncingBtn.waitFor({ state: 'visible', timeout: 120_000 }),
    ]).catch(() => {})

    if (await syncingBtn.isVisible().catch(() => false)) {
      await expect(syncingBtn).toBeHidden({
        timeout: IMPORT_SCOPE === 'masiva' ? 840_000 : 420_000,
      })
    }

    await expect(outcome).toBeVisible({ timeout: 120_000 })

    await expect(page.getByRole('button', { name: /ejecutar carga/i })).toBeEnabled({ timeout: 30_000 })

    await page.screenshot({
      path: path.join(TMP, `experiencia-comprador-importacion-resultado-${IMPORT_SCOPE}.png`),
      fullPage: true,
    })

    const err = page.locator('.status-error').first()
    const ok = page.locator('.status-ok').first()
    if (await err.isVisible().catch(() => false)) {
      const msg = await err.textContent()
      expect.soft(msg, 'comprador debe ver mensaje claro ante fallo').toBeTruthy()
    } else if (await ok.isVisible().catch(() => false)) {
      const msg = await ok.textContent()
      expect.soft(
        msg?.includes('OK') || msg?.toLowerCase().includes('sincron'),
        'mensaje de éxito reconocible'
      ).toBeTruthy()
    }
  })
})
