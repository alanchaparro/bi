import type { Page } from "@playwright/test";

/**
 * Escritorio (lg+): menú lateral cerrado por defecto; abre al pasar el mouse por el borde izquierdo.
 * Móvil: usa el botón hamburguesa si el menú está cerrado.
 */
export async function ensureSidebarOpen(page: Page) {
  const zone = page.getByTestId("sidebar-hover-zone");
  if (await zone.isVisible()) {
    await zone.hover();
    return;
  }
  const toggle = page.getByTestId("sidebar-toggle");
  if (await toggle.isVisible() && (await toggle.getAttribute("aria-expanded")) === "false") {
    await toggle.click();
  }
}
