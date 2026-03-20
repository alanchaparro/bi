const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    baseURL: "http://localhost:8080",
    viewport: {
      width: Number(process.env.VIEWPORT_WIDTH || 1366),
      height: Number(process.env.VIEWPORT_HEIGHT || 768),
    },
  });
  const result = {};

  await page.goto("/login");
  await page.getByLabel(/usuario/i).fill("qa_front");
  await page.getByLabel(/contraseña/i).fill("admin123");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/analisis-cartera/, { timeout: 20000 });
  await page.getByRole("navigation", { name: /menú principal/i }).waitFor({ timeout: 20000 });

  const sections = [
    { label: "Análisis de Cartera", href: "/analisis-cartera" },
    { label: "Análisis Anuales", href: "/analisis-anuales" },
    { label: "Rendimiento de Cartera", href: "/rendimiento" },
    { label: "Análisis Cobranzas Corte", href: "/cobranzas-cohorte" },
    { label: "Configuración", href: "/config" },
  ];
  result.menu = {};
  for (const section of sections) {
    await page.goto(section.href);
    await page.waitForTimeout(900);
    result.menu[section.label] = page.url();
  }

  await page.goto("/analisis-cartera");
  await page.locator(".analysis-filters-grid").first().waitFor({ timeout: 20000 });

  const targetCloseMonth = process.env.TARGET_CLOSE_MONTH || "02/2026";
  const closeWrap = page.locator('[aria-label="Fecha de Cierre"]').first();
  await closeWrap.getByRole("button").click();
  const targetOption = page.locator('[role="option"]', { hasText: targetCloseMonth }).first();
  const targetCount = await targetOption.count();
  const optionToPick = targetCount > 0 ? targetOption : page.locator('[role="option"]').first();
  const closeMonth = ((await optionToPick.textContent()) || "").trim();
  await optionToPick.click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /aplicar filtros/i }).click();
  await page.waitForTimeout(2000);

  const summaryText = ((await page.locator(".analysis-selection-summary").first().textContent()) || "").trim();
  const totalContracts = ((await page.locator("article.kpi-card", { hasText: "TOTAL CONTRATOS" }).locator(".kpi-card-value").first().textContent()) || "").trim();
  const montoCard = page.locator("article.kpi-card", { hasText: "MONTO TOTAL CORTE" }).locator(".kpi-card-value").first();
  const montoVisible = ((await montoCard.textContent()) || "").trim();
  const montoFull = ((await montoCard.getAttribute("aria-label")) || "").trim();

  result.analisisCartera = {
    closeMonth,
    summaryText,
    totalContracts,
    montoVisible,
    montoFull,
    url: page.url(),
  };

  console.log(JSON.stringify(result));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
