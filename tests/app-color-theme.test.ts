import { describe, expect, it } from "vitest";
import {
  DEFAULT_APP_COLOR_THEME,
  appThemeBackgroundColor,
  appThemeChromeColor,
  parseAppColorTheme
} from "@/lib/app-color-theme";

describe("app color themes", () => {
  it("keeps supported themes and falls back safely", () => {
    expect(parseAppColorTheme("sapphire")).toBe("sapphire");
    expect(parseAppColorTheme("pearl")).toBe("pearl");
    expect(parseAppColorTheme("mist")).toBe("mist");
    expect(parseAppColorTheme("unknown")).toBe(DEFAULT_APP_COLOR_THEME);
    expect(parseAppColorTheme(null)).toBe(DEFAULT_APP_COLOR_THEME);
  });

  it("uses distinct colors for light and dark app chrome", () => {
    expect(appThemeChromeColor("amethyst", true)).not.toBe(appThemeChromeColor("amethyst", false));
    expect(appThemeBackgroundColor("coral", true)).not.toBe(appThemeBackgroundColor("coral", false));
  });
});
