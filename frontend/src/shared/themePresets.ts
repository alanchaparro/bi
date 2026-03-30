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

/** Series categóricas (UN, vía, leyendas): tonos separados, no gradiente monocromático. */
const CATEGORICAL_CHART_TOKENS_DARK: Record<string, string> = {
  "--color-chart-1": "#52c48a",
  "--color-chart-2": "#f0b429",
  "--color-chart-3": "#c084fc",
  "--color-chart-4": "#38bdf8",
  "--color-chart-5": "#f472b6",
  "--color-chart-6": "#fb7185",
  "--color-chart-7": "#60a5fa",
};

const CATEGORICAL_CHART_TOKENS_LIGHT: Record<string, string> = {
  "--color-chart-1": "#15803d",
  "--color-chart-2": "#b45309",
  "--color-chart-3": "#7c3aed",
  "--color-chart-4": "#0369a1",
  "--color-chart-5": "#a21caf",
  "--color-chart-6": "#be123c",
  "--color-chart-7": "#1d4ed8",
};

const STORAGE_KEY = "ui-theme-preset";
const LEGACY_THEME_KEY = "ui-theme";

export const DEFAULT_THEME_PRESET_ID = "epem_obsidiana";

/** Orden del botón rápido de tema (solo oscuros; los claros quedan en Configuración). */
export const DARK_THEME_CYCLE_IDS = [
  "epem_obsidiana",
  "epem_pizarra_premium",
  "epem_lavanda_nocturna",
] as const;

/** Etiqueta corta en el header legacy (App.tsx). */
export const DARK_THEME_QUICK_BADGE: Record<string, string> = {
  epem_obsidiana: "O",
  epem_pizarra_premium: "P",
  epem_lavanda_nocturna: "L",
};

/**
 * Siguiente preset en el ciclo oscuro, o el primero si el actual es claro / desconocido.
 */
export function cycleDarkThemePresetId(currentId: string): string {
  const preset = getThemePresetById(currentId);
  if (preset.mode !== "dark") {
    return DARK_THEME_CYCLE_IDS[0];
  }
  const idx = (DARK_THEME_CYCLE_IDS as readonly string[]).indexOf(preset.id);
  const i = idx < 0 ? 0 : idx;
  return DARK_THEME_CYCLE_IDS[(i + 1) % DARK_THEME_CYCLE_IDS.length];
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "epem_obsidiana",
    label: "Obsidiana Operativa",
    description:
      "Oscuro por defecto, un poco más claro que un negro puro para leer bien con mucha luz ambiental.",
    mode: "dark",
    family: "base",
    swatches: ["#171E27", "#1F2832", "#2F8F83", "#F5F9FC"],
    tokens: {
      "--bg-color": "#171e27",
      "--bg-gradient-from": "#121920",
      "--bg-gradient-via": "#1a222c",
      "--bg-gradient-to": "#171e27",
      "--card-bg": "rgba(30, 38, 47, 0.95)",
      "--card-bg-glass": "rgba(30, 38, 47, 0.93)",
      "--accent-color": "#3a9e91",
      "--text-primary": "#f5f9fc",
      "--text-secondary": "#b3bec8",
      "--glass-border": "rgba(180, 198, 214, 0.22)",
      "--color-surface-elevated": "rgba(34, 43, 52, 0.98)",
      "--input-bg": "rgba(26, 33, 41, 0.94)",
      "--input-bg-strong": "rgba(22, 29, 36, 0.98)",
      "--dropdown-bg": "rgba(24, 31, 38, 0.99)",
      "--table-bg": "rgba(24, 31, 38, 0.95)",
      "--table-head-bg": "rgba(32, 40, 49, 0.98)",
      "--table-row-hover": "rgba(47, 143, 131, 0.1)",
      "--sidebar-bg": "#1a222a",
      "--sidebar-active-bg": "rgba(47, 143, 131, 0.18)",
      "--bg-glow-primary": "rgba(47, 143, 131, 0.1)",
      "--bg-glow-secondary": "rgba(130, 145, 160, 0.1)",
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
      ...CATEGORICAL_CHART_TOKENS_LIGHT,
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
      ...CATEGORICAL_CHART_TOKENS_LIGHT,
    },
  },
  {
    id: "epem_lavanda_nocturna",
    label: "Lavanda Nocturna",
    description: "Oscuro con violeta suave; superficies un poco más claras para uso con luz diurna.",
    mode: "dark",
    family: "base",
    swatches: ["#1E1A28", "#B4D3D9", "#BDA6CE", "#9B8EC7"],
    tokens: {
      "--bg-color": "#1e1a28",
      "--bg-gradient-from": "#181522",
      "--bg-gradient-via": "#221d30",
      "--bg-gradient-to": "#1e1a28",
      "--card-bg": "rgba(36, 30, 50, 0.95)",
      "--card-bg-glass": "rgba(36, 30, 50, 0.93)",
      "--accent-color": "#bdd9de",
      "--text-primary": "#f8f4fc",
      "--text-secondary": "#cec4d8",
      "--glass-border": "rgba(189, 166, 206, 0.24)",
      "--color-surface-elevated": "rgba(42, 35, 58, 0.98)",
      "--input-bg": "rgba(30, 26, 42, 0.94)",
      "--input-bg-strong": "rgba(26, 22, 38, 0.99)",
      "--dropdown-bg": "rgba(28, 24, 40, 0.99)",
      "--table-bg": "rgba(28, 24, 40, 0.96)",
      "--table-head-bg": "rgba(44, 37, 62, 0.98)",
      "--table-row-hover": "rgba(180, 211, 217, 0.12)",
      "--sidebar-bg": "#1c1826",
      "--sidebar-active-bg": "rgba(155, 142, 199, 0.22)",
      "--bg-glow-primary": "rgba(155, 142, 199, 0.14)",
      "--bg-glow-secondary": "rgba(180, 211, 217, 0.1)",
      ...CATEGORICAL_CHART_TOKENS_DARK,
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
      ...CATEGORICAL_CHART_TOKENS_LIGHT,
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
      ...CATEGORICAL_CHART_TOKENS_LIGHT,
    },
  },
  {
    id: "epem_pizarra_premium",
    label: "Pizarra Premium",
    description:
      "Oscuro ejecutivo con carbón templado; contraste reforzado para pantallas a la luz del día.",
    mode: "dark",
    family: "premium",
    swatches: ["#181F26", "#B4D3D9", "#9B8EC7", "#EEF2F6"],
    tokens: {
      "--bg-color": "#181f26",
      "--bg-gradient-from": "#131a20",
      "--bg-gradient-via": "#1b232b",
      "--bg-gradient-to": "#181f26",
      "--card-bg": "rgba(28, 36, 44, 0.96)",
      "--card-bg-glass": "rgba(28, 36, 44, 0.93)",
      "--accent-color": "#8ab3ba",
      "--text-primary": "#eef2f6",
      "--text-secondary": "#aebcc6",
      "--glass-border": "rgba(142, 178, 186, 0.22)",
      "--color-surface-elevated": "rgba(32, 41, 49, 0.99)",
      "--input-bg": "rgba(24, 31, 38, 0.96)",
      "--input-bg-strong": "rgba(20, 27, 33, 0.99)",
      "--dropdown-bg": "rgba(22, 29, 35, 0.99)",
      "--table-bg": "rgba(22, 29, 35, 0.97)",
      "--table-head-bg": "rgba(34, 43, 51, 0.99)",
      "--table-row-hover": "rgba(124, 165, 173, 0.12)",
      "--sidebar-bg": "#161c22",
      "--sidebar-active-bg": "rgba(124, 165, 173, 0.16)",
      "--bg-glow-primary": "rgba(124, 165, 173, 0.1)",
      "--bg-glow-secondary": "rgba(155, 142, 199, 0.1)",
      ...CATEGORICAL_CHART_TOKENS_DARK,
    },
  },
];

export function getThemePresetById(id: string | null | undefined): ThemePreset {
  return THEME_PRESETS.find((preset) => preset.id === id) ?? THEME_PRESETS[0];
}

/**
 * Tema al arrancar: siempre un preset **oscuro** (por defecto Obsidiana).
 * Si en `localStorage` quedó un tema claro o el legado `light`, se migra a Obsidiana y se reescribe el storage.
 */
function persistStoredPresetId(id: string, mode: ThemeMode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
    window.localStorage.setItem(LEGACY_THEME_KEY, mode);
  } catch {
    // ignore
  }
}

export function getStoredThemePresetId(): string {
  if (typeof window === "undefined") return DEFAULT_THEME_PRESET_ID;
  try {
    const presetId = window.localStorage.getItem(STORAGE_KEY);
    if (presetId) {
      const preset = getThemePresetById(presetId);
      if (preset.mode === "light") {
        persistStoredPresetId(DEFAULT_THEME_PRESET_ID, "dark");
        return DEFAULT_THEME_PRESET_ID;
      }
      return preset.id;
    }
    const legacyTheme = window.localStorage.getItem(LEGACY_THEME_KEY);
    if (legacyTheme === "light") {
      persistStoredPresetId(DEFAULT_THEME_PRESET_ID, "dark");
      return DEFAULT_THEME_PRESET_ID;
    }
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
