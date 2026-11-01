import {
  appThemeUsesDark,
  appThemeBackgroundColor,
  appThemeChromeColor,
  parseAppColorTheme
} from "@/lib/app-color-theme";

/** Synchronise theme-color iOS / Safari avec le thème actif. */
export function syncAppChromeTheme(dark: boolean): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const appTheme = parseAppColorTheme(root.dataset.colorTheme);
  dark = appThemeUsesDark(appTheme, dark);
  root.classList.toggle("dark",dark);
  root.style.colorScheme = dark ? "dark" : "light";
  root.style.backgroundColor = appThemeBackgroundColor(appTheme, dark);
  const theme = appThemeChromeColor(appTheme, dark);
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", theme);
  window.dispatchEvent(new Event("app-appearance-change"));
}
