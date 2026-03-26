import { useSyncExternalStore } from "react";

function subscribeTheme(onStoreChange: () => void) {
  const root = document.documentElement;
  const mo = new MutationObserver(onStoreChange);
  mo.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function getIsLightSnapshot() {
  return document.documentElement.dataset.theme === "light";
}

/**
 * `data-theme` en `<html>` (ver themePresets). Reacciona al cambiar preset claro/oscuro sin recargar.
 */
export function useIsLightTheme(): boolean {
  return useSyncExternalStore(subscribeTheme, getIsLightSnapshot, () => false);
}
