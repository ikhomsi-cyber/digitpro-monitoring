import { describe, expect, it } from "vitest";
import {
  currentDashboardMonthKey,
  formatCompactEuroAxis,
  formatDashboardMonthShort,
  smoothDashboardSvgPath,
  sumDashboardValues
} from "@/lib/dashboard-client-utils";

describe("dashboard client utilities", () => {
  it("formats dashboard dates and euro axes", () => {
    expect(currentDashboardMonthKey(new Date(2026, 8, 6))).toBe("2026-09");
    expect(formatDashboardMonthShort("2026-09")).toBe("sept. 2026");
    expect(formatCompactEuroAxis(12_400)).toBe("12k€");
    expect(formatCompactEuroAxis(-1_250)).toBe("-1.2k€");
  });

  it("builds stable totals and SVG paths", () => {
    expect(sumDashboardValues([12.5, -2.5, 8])).toBe(18);
    expect(smoothDashboardSvgPath([])).toBe("");
    expect(smoothDashboardSvgPath([{ x: 1, y: 2 }])).toBe("M 1.0 2.0");
    expect(smoothDashboardSvgPath([{ x: 0, y: 0 }, { x: 12, y: 6 }])).toContain("C");
  });
});
