import { annualMileageAllowanceEur, commuteRoundTripKm } from "@/lib/pluxee-commute-indemnity";
import { summarizeNdfDigitProForMonth } from "@/lib/ndf-digitpro";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import type { MobileActivityInput } from "@/lib/mobile/activity";

export function mobileActivityExpenses(transactions: DashboardTx[], activity: MobileActivityInput, monthKey: string, now: Date) {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const currentMonth = today.slice(0, 7);
  const years = new Set([monthKey.slice(0, 4), today.slice(0, 4), ...activity.commuteDays.map(d => d.slice(0, 4)), ...Object.keys(activity.mileageExtraKmByMonth).map(d => d.slice(0, 4)), ...transactions.map(t => t.date.slice(0, 4))]);
  const result: Record<string, { ikEur: number; ikYearToDateEur: number; km: number; commuteDays: number; ndf: ReturnType<typeof summarizeNdfDigitProForMonth> }> = {};
  const personal = transactions.filter(tx => tx.scope === "personal" && tx.date.slice(0, 10) <= today);
  for (const year of years) {
    if (!/^\d{4}$/.test(year)) continue;
    let cumulativeKm = 0;
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      const commuteDays = new Set(activity.commuteDays.filter(d => d.startsWith(key + "-") && d <= today)).size;
      const km = Math.round((commuteDays * commuteRoundTripKm() + (key <= currentMonth ? activity.mileageExtraKmByMonth[key] ?? 0 : 0)) * 10) / 10;
      const before = annualMileageAllowanceEur(cumulativeKm);
      cumulativeKm += km;
      const ikYearToDateEur = annualMileageAllowanceEur(cumulativeKm);
      result[key] = { ikEur: Math.round((ikYearToDateEur - before) * 100) / 100, ikYearToDateEur, km, commuteDays,
        ndf: summarizeNdfDigitProForMonth(personal, key) };
    }
  }
  return result;
}
