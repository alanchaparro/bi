import { test, expect } from '@playwright/test'

const E2E_USER = process.env.E2E_USERNAME ?? 'admin'
const E2E_PASS = process.env.E2E_PASSWORD ?? 'change_me_demo_admin_password'

test.describe('Menú de navegación', () => {
  test('tras login, clic en Comisiones muestra la sección comisiones visible', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: /cartera cobranzas/i })).toBeVisible()

    const username = page.getByLabel(/usuario/i)
    const password = page.getByLabel(/contraseña/i)
    await username.fill(E2E_USER)
    await password.fill(E2E_PASS)
    await page.getByRole('button', { name: /entrar|iniciar sesión|login/i }).click()

    await expect(page.getByRole('navigation', { name: /menú principal/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('link', { name: 'Config. Comisiones' })).toBeVisible()

    await page.getByRole('link', { name: 'Config. Comisiones' }).click()

    const section = page.locator('#brokersCommissions')
    await expect(section).toBeVisible()
    await expect(section).toBeInViewport()
  })
})
