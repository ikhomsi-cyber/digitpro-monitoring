export type AnnualObjectiveTracking = {
  year: number;
  targetHtEur: number;
  achievedHtEur: number;
  remainingHtEur: number;
  completionPct: number;
};

export function computeAnnualObjectiveTracking(
  targetHtEur: number | null | undefined,
  achievedHtEur: number,
  now = new Date()
): AnnualObjectiveTracking | null {
  if (targetHtEur == null || !Number.isFinite(targetHtEur) || targetHtEur <= 0) {
    return null;
  }

  const achieved = Math.max(0, achievedHtEur);
  const target = Math.round(targetHtEur * 100) / 100;
  const remaining = Math.max(0, Math.round((target - achieved) * 100) / 100);
  const completionPct = Math.min(100, Math.round((achieved / target) * 1000) / 10);

  return {
    year: now.getFullYear(),
    targetHtEur: target,
    achievedHtEur: Math.round(achieved * 100) / 100,
    remainingHtEur: remaining,
    completionPct
  };
}
