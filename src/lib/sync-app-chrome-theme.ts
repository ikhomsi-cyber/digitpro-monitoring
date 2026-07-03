import { APP_LAUNCH_BG_LIGHT, APP_THEME_COLOR_DARK } from "@/lib/app-launch-theme";

/** Synchronise theme-color iOS / Safari avec le thème actif (sans écraser le fond CSS). */
export function syncAppChromeTheme(dark: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  const theme = dark ? APP_THEME_COLOR_DARK : APP_LAUNCH_BG_LIGHT;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", theme);
}
