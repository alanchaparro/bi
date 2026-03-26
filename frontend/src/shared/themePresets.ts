export type ThemeMode = "dark" | "light";

export type ThemePreset = {
  id: string;
  label: string;
  description: string;
  mode: ThemeMode;
  family: "base" | "premium";
  swatches: string[];
  tokens: Record<string, string>;
};

const STORAGE_KEY = "ui-theme-preset";
const LEGACY_THEME_KEY = "ui-theme";

export const DEFAULT_THEME_PRESET_ID = "epem_obsidiana";

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "epem_obsidiana",
    label: "Obsidiana Operativa",
    description: "Base sobria para foco alto en dato y contraste continuo.",
    mode: "dark",
    family: "base",
    swatches: ["#0F1418", "#182127", "#2F8F83", "#F3F7FA"],
    tokens: {
      "--bg-color": "#0f1418",
      "--bg-gradient-from": "#0b1014",
      "--bg-gradient-via": "#12191f",
      "--bg-gradient-to": "#0f1418",
      "--card-bg": "rgba(20, 27, 33, 0.94)",
      "--card-bg-glass": "rgba(20, 27, 33, 0.92)",
      "--accent-color": "#2f8f83",
      "--text-primary": "#f3f7fa",
      "--text-secondary": "#95a3af",
      "--glass-border": "rgba(148, 163, 184, 0.14)",
      "--color-surface-elevated": "rgba(24, 31, 37, 0.98)",
      "--input-bg": "rgba(18, 24, 29, 0.9)",
      "--input-bg-strong": "rgba(16, 21, 26, 0.98)",
      "--dropdown-bg": "rgba(17, 23, 28, 0.99)",
      "--table-bg": "rgba(17, 23, 28, 0.94)",
      "--table-head-bg": "rgba(23, 31, 38, 0.98)",
      "--table-row-hover": "rgba(47, 143, 131, 0.06)",
      "--sidebar-bg": "#11171c",
      "--sidebar-active-bg": "rgba(47, 143, 131, 0.14)",
      "--bg-glow-primary": "rgba(47, 143, 131, 0.08)",
      "--bg-glow-secondary": "rgba(111, 123, 136, 0.08)",
    },
  },
  {
    id: "epem_marfil_brisa",
    label: "Marfil Brisa",
    description: "Tema claro cálido con acento agua y violeta suave para lectura larga.",
    mode: "light",
    family: "base",
    swatches: ["#F2EAE0", "#B4D3D9", "#BDA6CE", "#9B8EC7"],
    tokens: {
      "--bg-color": "#f2eae0",
      "--bg-gradient-from": "#f6f0e8",
      "--bg-gradient-via": "#f2eae0",
      "--bg-gradient-to": "#ece1d4",
      "--card-bg": "rgba(255, 251, 247, 0.96)",
      "--card-bg-glass": "rgba(255, 251, 247, 0.93)",
      "--accent-color": "#6d77b6",
      "--text-primary": "#2d2435",
      "--text-secondary": "#655a72",
      "--glass-border": "rgba(155, 142, 199, 0.18)",
      "--color-surface-elevated": "rgba(255, 255, 255, 0.98)",
      "--input-bg": "rgba(250, 245, 239, 0.98)",
      "--input-bg-strong": "rgba(255, 255, 255, 1)",
      "--dropdown-bg": "rgba(255, 251, 247, 0.99)",
      "--table-bg": "rgba(255, 251, 247, 0.98)",
      "--table-head-bg": "rgba(228, 218, 241, 0.9)",
      "--table-row-hover": "rgba(180, 211, 217, 0.2)",
      "--sidebar-bg": "#ede2d6",
      "--sidebar-active-bg": "rgba(155, 142, 199, 0.12)",
      "--bg-glow-primary": "rgba(180, 211, 217, 0.2)",
      "--bg-glow-secondary": "rgba(189, 166, 206, 0.16)",
      "--color-chart-1": "#7f92c8",
      "--color-chart-2": "#9b8ec7",
      "--color-chart-3": "#7aa6af",
      "--color-chart-4": "#bda6ce",
    },
  },
  {
    id: "epem_brisa_profesional",
    label: "Brisa Profesional",
    description: "Tema claro más frío y corporativo, usando turquesa suave como guía visual.",
    mode: "light",
    family: "base",
    swatches: ["#F4F8F8", "#B4D3D9", "#8AAAB4", "#627985"],
    tokens: {
      "--bg-color": "#edf3f4",
      "--bg-gradient-from": "#f7fafb",
      "--bg-gradient-via": "#edf3f4",
      "--bg-gradient-to": "#dde9ec",
      "--card-bg": "rgba(250, 253, 253, 0.97)",
      "--card-bg-glass": "rgba(250, 253, 253, 0.94)",
      "--accent-color": "#4d7f88",
      "--text-primary": "#1d2730",
      "--text-secondary": "#4f6470",
      "--glass-border": "rgba(77, 127, 136, 0.16)",
      "--color-surface-elevated": "rgba(255, 255, 255, 0.99)",
      "--input-bg": "rgba(245, 249, 250, 0.99)",
      "--input-bg-strong": "rgba(255, 255, 255, 1)",
      "--dropdown-bg": "rgba(250, 253, 253, 0.99)",
      "--table-bg": "rgba(249, 252, 252, 0.98)",
      "--table-head-bg": "rgba(219, 233, 236, 0.95)",
      "--table-row-hover": "rgba(180, 211, 217, 0.24)",
      "--sidebar-bg": "#e7f0f2",
      "--sidebar-active-bg": "rgba(77, 127, 136, 0.12)",
      "--bg-glow-primary": "rgba(180, 211, 217, 0.24)",
      "--bg-glow-secondary": "rgba(189, 166, 206, 0.12)",
      "--color-chart-1": "#4d7f88",
      "--color-chart-2": "#7b93d1",
      "--color-chart-3": "#9b8ec7",
      "--color-chart-4": "#8cb9c0",
    },
  },
  {
    id: "epem_lavanda_nocturna",
    label: "Lavanda Nocturna",
    description: "Tema oscuro con violeta contenido para un look más distintivo pero todavía usable.",
    mode: "dark",
    family: "base",
    swatches: ["#17141F", "#B4D3D9", "#BDA6CE", "#9B8EC7"],
    tokens: {
      "--bg-color": "#17141f",
      "--bg-gradient-from": "#13101a",
      "--bg-gradient-via": "#1d1927",
      "--bg-gradient-to": "#17141f",
      "--card-bg": "rgba(29, 24, 41, 0.94)",
      "--card-bg-glass": "rgba(29, 24, 41, 0.92)",
      "--accent-color": "#b4d3d9",
      "--text-primary": "#f6f1fb",
      "--text-secondary": "#c2b7cf",
      "--glass-border": "rgba(189, 166, 206, 0.16)",
      "--color-surface-elevated": "rgba(35, 29, 48, 0.98)",
      "--input-bg": "rgba(25, 21, 35, 0.92)",
      "--input-bg-strong": "rgba(22, 18, 31, 0.99)",
      "--dropdown-bg": "rgba(25, 21, 35, 0.99)",
      "--table-bg": "rgba(24, 20, 34, 0.96)",
      "--table-head-bg": "rgba(37, 31, 53, 0.98)",
      "--table-row-hover": "rgba(180, 211, 217, 0.08)",
      "--sidebar-bg": "#16131e",
      "--sidebar-active-bg": "rgba(155, 142, 199, 0.18)",
      "--bg-glow-primary": "rgba(155, 142, 199, 0.12)",
      "--bg-glow-secondary": "rgba(180, 211, 217, 0.08)",
      "--color-chart-1": "#b4d3d9",
      "--color-chart-2": "#9b8ec7",
      "--color-chart-3": "#bda6ce",
      "--color-chart-4": "#c9e2e6",
    },
  },
  {
    id: "epem_marfil_ejecutivo",
    label: "Marfil Ejecutivo",
    description: "VersiÃ³n premium clara, mÃ¡s sobria y directiva, con contraste mÃ¡s serio y menos dulzura visual.",
    mode: "light",
    family: "premium",
    swatches: ["#F2EAE0", "#B4D3D9", "#8E84BA", "#24313A"],
    tokens: {
      "--bg-color": "#f4eee6",
      "--bg-gradient-from": "#faf6f1",
      "--bg-gradient-via": "#f4eee6",
      "--bg-gradient-to": "#e9e0d4",
      "--card-bg": "rgba(255, 252, 249, 0.98)",
      "--card-bg-glass": "rgba(255, 252, 249, 0.95)",
      "--accent-color": "#5f7891",
      "--text-primary": "#24313a",
      "--text-secondary": "#596872",
      "--glass-border": "rgba(94, 120, 145, 0.16)",
      "--color-surface-elevated": "rgba(255, 255, 255, 1)",
      "--input-bg": "rgba(249, 245, 240, 0.98)",
      "--input-bg-strong": "rgba(255, 255, 255, 1)",
      "--dropdown-bg": "rgba(255, 252, 249, 0.99)",
      "--table-bg": "rgba(255, 255, 255, 0.98)",
      "--table-head-bg": "rgba(231, 237, 240, 0.98)",
      "--table-row-hover": "rgba(180, 211, 217, 0.18)",
      "--sidebar-bg": "#ece3d8",
      "--sidebar-active-bg": "rgba(95, 120, 145, 0.11)",
      "--bg-glow-primary": "rgba(180, 211, 217, 0.18)",
      "--bg-glow-secondary": "rgba(155, 142, 199, 0.1)",
      "--color-chart-1": "#5f7891",
      "--color-chart-2": "#8e84ba",
      "--color-chart-3": "#7b9fa6",
      "--color-chart-4": "#bda6ce",
    },
  },
  {
    id: "epem_niebla_directiva",
    label: "Niebla Directiva",
    description: "Tema claro premium con turquesa grisÃ¡ceo y lavanda medida para una lectura mÃ¡s corporativa.",
    mode: "light",
    family: "premium",
    swatches: ["#F7F4EF", "#B4D3D9", "#9BA9C7", "#33424C"],
    tokens: {
      "--bg-color": "#f5f4ef",
      "--bg-gradient-from": "#fbfaf8",
      "--bg-gradient-via": "#f5f4ef",
      "--bg-gradient-to": "#e7eceb",
      "--card-bg": "rgba(253, 253, 252, 0.98)",
      "--card-bg-glass": "rgba(253, 253, 252, 0.95)",
      "--accent-color": "#567a82",
      "--text-primary": "#33424c",
      "--text-secondary": "#63747e",
      "--glass-border": "rgba(86, 122, 130, 0.15)",
      "--color-surface-elevated": "rgba(255, 255, 255, 1)",
      "--input-bg": "rgba(246, 248, 247, 0.99)",
      "--input-bg-strong": "rgba(255, 255, 255, 1)",
      "--dropdown-bg": "rgba(252, 253, 253, 0.99)",
      "--table-bg": "rgba(255, 255, 255, 0.98)",
      "--table-head-bg": "rgba(228, 237, 238, 0.96)",
      "--table-row-hover": "rgba(180, 211, 217, 0.16)",
      "--sidebar-bg": "#edf0ec",
      "--sidebar-active-bg": "rgba(86, 122, 130, 0.1)",
      "--bg-glow-primary": "rgba(180, 211, 217, 0.18)",
      "--bg-glow-secondary": "rgba(189, 166, 206, 0.08)",
      "--color-chart-1": "#567a82",
      "--color-chart-2": "#8798b8",
      "--color-chart-3": "#9b8ec7",
      "--color-chart-4": "#9bbdc3",
    },
  },
  {
    id: "epem_pizarra_premium",
    label: "Pizarra Premium",
    description: "Tema oscuro ejecutivo con carbÃ³n profundo, aqua templado y violeta de apoyo, menos juvenil y mÃ¡s institucional.",
    mode: "dark",
    family: "premium",
    swatches: ["#12181D", "#B4D3D9", "#9B8EC7", "#E8EDF2"],
    tokens: {
      "--bg-color": "#12181d",
      "--bg-gradient-from": "#0e1418",
      "--bg-gradient-via": "#151d22",
      "--bg-gradient-to": "#12181d",
      "--card-bg": "rgba(20, 28, 34, 0.96)",
      "--card-bg-glass": "rgba(20, 28, 34, 0.93)",
      "--accent-color": "#7ca5ad",
      "--text-primary": "#e8edf2",
      "--text-secondary": "#9eacb8",
      "--glass-border": "rgba(124, 165, 173, 0.14)",
      "--color-surface-elevated": "rgba(24, 34, 40, 0.99)",
      "--input-bg": "rgba(17, 24, 29, 0.96)",
      "--input-bg-strong": "rgba(15, 22, 27, 0.99)",
      "--dropdown-bg": "rgba(16, 23, 28, 0.99)",
      "--table-bg": "rgba(16, 23, 28, 0.97)",
      "--table-head-bg": "rgba(26, 35, 42, 0.99)",
      "--table-row-hover": "rgba(124, 165, 173, 0.09)",
      "--sidebar-bg": "#10161a",
      "--sidebar-active-bg": "rgba(124, 165, 173, 0.12)",
      "--bg-glow-primary": "rgba(124, 165, 173, 0.08)",
      "--bg-glow-secondary": "rgba(155, 142, 199, 0.08)",
      "--color-chart-1": "#7ca5ad",
      "--color-chart-2": "#9b8ec7",
      "--color-chart-3": "#b4d3d9",
      "--color-chart-4": "#c6d0dd",
    },
  },
];

export function getThemePresetById(id: string | null | undefined): ThemePreset {
  return THEME_PRESETS.find((preset) => preset.id === id) ?? THEME_PRESETS[0];
}

export function getStoredThemePresetId(): string {
  if (typeof window === "undefined") return DEFAULT_THEME_PRESET_ID;
  try {
    const presetId = window.localStorage.getItem(STORAGE_KEY);
    if (presetId) return getThemePresetById(presetId).id;
    const legacyTheme = window.localStorage.getItem(LEGACY_THEME_KEY);
    if (legacyTheme === "light") return "epem_marfil_brisa";
    return DEFAULT_THEME_PRESET_ID;
  } catch {
    return DEFAULT_THEME_PRESET_ID;
  }
}

export function applyThemePreset(presetId: string) {
  if (typeof document === "undefined") return;
  const preset = getThemePresetById(presetId);
  const root = document.documentElement;

  root.setAttribute("data-theme", preset.mode);
  root.setAttribute("data-theme-preset", preset.id);
  root.classList.remove("dark", "light");
  root.classList.add(preset.mode);

  for (const [token, value] of Object.entries(preset.tokens)) {
    root.style.setProperty(token, value);
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, preset.id);
    window.localStorage.setItem(LEGACY_THEME_KEY, preset.mode);
  } catch {
    // ignore
  }
}
