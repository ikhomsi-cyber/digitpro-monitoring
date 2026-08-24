export const APP_COLOR_THEME_STORAGE_KEY = "digitpro-color-theme";

export const APP_COLOR_THEMES = [
  {
    id: "emerald",
    label: "Émeraude",
    description: "Signature DigitPro",
    swatch: "#34d399"
  },
  {
    id: "sapphire",
    label: "Saphir",
    description: "Bleu financier",
    swatch: "#38bdf8"
  },
  {
    id: "amethyst",
    label: "Améthyste",
    description: "Violet profond",
    swatch: "#a78bfa"
  },
  {
    id: "coral",
    label: "Corail",
    description: "Énergie premium",
    swatch: "#fb7185"
  },
  {
    id: "pearl",
    label: "Gris perle",
    description: "Neutre et lumineux",
    swatch: "#94a3b8"
  },
  {
    id: "mist",
    label: "Gris clair",
    description: "Minimal et très doux",
    swatch: "#cbd5e1"
  },
  {
    id: "cloud",
    label: "Gris nuage",
    description: "Très clair, presque blanc",
    swatch: "#e5e7eb"
  },
  {
    id: "sand",
    label: "Sable",
    description: "Beige très clair",
    swatch: "#c6a36a"
  }
] as const;

export type AppColorTheme = (typeof APP_COLOR_THEMES)[number]["id"];

export const DEFAULT_APP_COLOR_THEME: AppColorTheme = "emerald";

const APP_THEME_COLOR_VALUES: Record<AppColorTheme, { light: string; darkBackground: string; darkChrome: string }> = {
  emerald: { light: "#F5F5F7", darkBackground: "#03191f", darkChrome: "#0c5361" },
  sapphire: { light: "#F5F7FF", darkBackground: "#07152f", darkChrome: "#123f7a" },
  amethyst: { light: "#F8F5FF", darkBackground: "#1c1033", darkChrome: "#4c277a" },
  coral: { light: "#FFF6F5", darkBackground: "#2a1119", darkChrome: "#74293d" },
  pearl: { light: "#F6F7F9", darkBackground: "#121820", darkChrome: "#334155" },
  mist: { light: "#F8FAFC", darkBackground: "#17202b", darkChrome: "#475569" },
  cloud: { light: "#FCFCFD", darkBackground: "#1b1e23", darkChrome: "#5b6470" },
  sand: { light: "#FBF8F1", darkBackground: "#211B12", darkChrome: "#655136" }
};

export function parseAppColorTheme(value: string | null | undefined): AppColorTheme {
  return APP_COLOR_THEMES.some((theme) => theme.id === value)
    ? (value as AppColorTheme)
    : DEFAULT_APP_COLOR_THEME;
}

export function appThemeChromeColor(theme: AppColorTheme, dark: boolean): string {
  const palette = APP_THEME_COLOR_VALUES[theme];
  return dark ? palette.darkChrome : palette.light;
}

export function appThemeBackgroundColor(theme: AppColorTheme, dark: boolean): string {
  const palette = APP_THEME_COLOR_VALUES[theme];
  return dark ? palette.darkBackground : palette.light;
}
