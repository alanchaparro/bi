import { test, expect } from '@playwright/test'

const E2E_USER = process.env.E2E_USERNAME ?? 'admin'
const E2E_PASS = process.env.E2E_PASSWORD ?? 'admin123'

test.describe('Login como usuario', () => {
  test('puede ver la pantalla de login y el título Cartera Cobranzas', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /cartera cobranzas/i })).toBeVisible()
    await expect(page.getByLabel(/usuario/i)).toBeVisible()
    await expect(page.getByLabel(/contraseña/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible()
  })

  test('puede iniciar sesión y llegar al dashboard (menú visible)', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/usuario/i).fill(E2E_USER)
    await page.getByLabel(/contraseña/i).fill(E2E_PASS)
    await page.getByRole('button', { name: /entrar/i }).click()

    // Tras login redirige a /analisis-cartera y muestra el layout con header y sidebar
    await expect(page).toHaveURL(/\/analisis-cartera/, { timeout: 15_000 })
    await expect(page.getByRole('navigation', { name: /menú principal/i })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('link', { name: /análisis de cartera/i }).first()).toBeVisible()
    // Layout: header con toggle y sidebar visibles
    await expect(page.getByTestId('sidebar-toggle')).toBeVisible()
    await expect(page.getByRole('heading', { name: /epem - cartera de cobranzas/i })).toBeVisible()
  })

  test('con credenciales incorrectas muestra error', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/usuario/i).fill('usuario_invalido')
    await page.getByLabel(/contraseña/i).fill('clave_falsa')
    await page.getByRole('button', { name: /entrar/i }).click()

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 8_000 })
    await expect(page).toHaveURL(/\/login/)
  })
})
