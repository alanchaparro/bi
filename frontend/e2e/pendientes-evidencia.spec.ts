/**
 * Capturas para experiencia-cliente / pendientes.md (1366×768).
 * Flujo importaciones: seleccionar todos los dominios, completar rango Cartera,
 * pulsar Ejecutar; si aparece el modal de carga masiva, captura y Cancelar (no ejecuta sync real).
 */
import * as fs from 'fs'
import * as path from 'path'
import { expect, test } from '@playwright/test'

const E2E_USER = process.env.E2E_USERNAME ?? 'admin'
const E2E_PASS = process.env.E2E_PASSWORD ?? 'admin123'

const TMP_DIR = path.join(process.cwd(), 'tmp')

function ensureTmp() {
  fs.mkdirSync(TMP_DIR, { recursive: true })
}

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel(/usuario/i).fill(E2E_USER)
  await page.getByLabel(/contraseña/i).fill(E2E_PASS)
  await page.getByRole('button', { name: /entrar/i }).click()
  await expect(page).toHaveURL(/\/(cartera|analisis-cartera)/, { timeout: 15_000 })
}

test.describe('Evidencia experiencia-cliente (pendientes)', () => {
  test.use({ viewport: { width: /** @see spec analytics */ 1366, height: 768 } })

  test.beforeAll(() => {
    ensureTmp()
  })

  test('capturas PEND-02/03/04 y pantalla Importaciones', async ({ page }) => {
    await login(page)

    await page.goto('/analisis-cartera')
    await page.waitForLoadState('domcontentloaded')
    await page.screenshot({
      path: path.join(TMP_DIR, 'pendientes-analisis-cartera-copy-2026-03-26.png'),
      fullPage: true,
    })

    await expect(page.getByRole('navigation', { name: /menú principal/i })).toBeVisible()
    await page.screenshot({
      path: path.join(TMP_DIR, 'pendientes-sidebar-rolo-2026-03-26.png'),
      fullPage: true,
    })

    await page.screenshot({
      path: path.join(TMP_DIR, 'pendientes-menu-resumen-vs-analisis-2026-03-26.png'),
      fullPage: true,
    })

    await page.goto('/config')
    await expect(page.getByRole('heading', { name: /configuración/i })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('tab', { name: /^importaciones$/i }).click()
    await expect(page.getByRole('heading', { name: /carga dual sql/i })).toBeVisible()
    await page.screenshot({
      path: path.join(TMP_DIR, 'pendientes-config-importaciones-2026-03-26.png'),
      fullPage: true,
    })
  })

  test('importaciones: todos los dominios — modal, error o sync (sin confirmar masivo)', async ({
    page,
  }) => {
    test.setTimeout(120_000)

    await login(page)
    await page.goto('/config')
    await page.getByRole('tab', { name: /^importaciones$/i }).click()
    await expect(page.getByRole('heading', { name: /carga dual sql/i })).toBeVisible()

    await page.getByRole('button', { name: /seleccionar todos los dominios/i }).click()
    await expect(page.locator('p.config-warn-text')).toBeVisible()
    await page.screenshot({
      path: path.join(TMP_DIR, 'pendientes-config-importaciones-todos-dominios-2026-03-26.png'),
      fullPage: true,
    })

    await page.getByPlaceholder('MM').first().fill('01')
    await page.getByPlaceholder('MM').nth(1).fill('12')
    await page.getByPlaceholder('YYYY').first().fill('2025')
    await page.getByPlaceholder('YYYY').nth(1).fill('2025')

    await page.getByRole('button', { name: /ejecutar carga/i }).click()

    const dialog = page.getByRole('dialog', { name: /confirmar carga masiva/i })
    const errorMsg = page.locator('.status-error').first()
    const progressShell = page.locator('.sync-progress-shell')
    const confirmMsg = page.getByText(/se requiere confirmacion/i)

    await expect(dialog.or(errorMsg).or(progressShell).or(confirmMsg)).toBeVisible({
      timeout: 90_000,
    })

    if (await dialog.isVisible().catch(() => false)) {
      await page.screenshot({
        path: path.join(TMP_DIR, 'pendientes-config-carga-masiva-modal-2026-03-26.png'),
        fullPage: true,
      })
      await page.getByRole('button', { name: /^cancelar$/i }).click()
      await expect(dialog).toBeHidden({ timeout: 15_000 })
    } else if (await progressShell.isVisible().catch(() => false)) {
      await page.screenshot({
        path: path.join(TMP_DIR, 'pendientes-config-sync-iniciado-sin-modal-2026-03-26.png'),
        fullPage: true,
      })
    } else {
      await page.screenshot({
        path: path.join(TMP_DIR, 'pendientes-config-importaciones-error-o-api-2026-03-26.png'),
        fullPage: true,
      })
    }
  })
})
