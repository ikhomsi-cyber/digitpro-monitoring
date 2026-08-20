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
  }
] as const;

export type AppColorTheme = (typeof APP_COLOR_THEMES)[number]["id"];

export const DEFAULT_APP_COLOR_THEME: AppColorTheme = "emerald";

const APP_THEME_COLOR_VALUES: Record<AppColorTheme, { light: string; darkBackground: string; darkChrome: string }> = {
  emerald: { light: "#F5F5F7", darkBackground: "#03191f", darkChrome: "#0c5361" },
  sapphire: { light: "#F5F7FF", darkBackground: "#07152f", darkChrome: "#123f7a" },
  amethyst: { light: "#F8F5FF", darkBackground: "#1c1033", darkChrome: "#4c277a" },
  coral: { light: "#FFF6F5", darkBackground: "#2a1119", darkChrome: "#74293d" }
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
