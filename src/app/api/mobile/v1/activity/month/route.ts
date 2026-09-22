import { z } from "zod";
import { mobileAuth, mobileFailure, mobileJSON, MobileError } from "@/lib/mobile/auth";
import { buildMobileActivityMonth } from "@/lib/mobile/activity";
import { mobileActivityExpenses } from "@/lib/mobile/activity-expenses";
import type { DashboardTx } from "@/lib/dashboard-metrics";

export const dynamic = "force-dynamic";
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export async function GET(request: Request) {
  try {
    const { client, userId } = await mobileAuth(request);
    const parsed = monthSchema.safeParse(new URL(request.url).searchParams.get("month"));
    if (!parsed.success) throw new MobileError(400, "Mois invalide.");
    const month = parsed.data;
    const year = Number(month.slice(0, 4));
    const month0 = Number(month.slice(5, 7)) - 1;
    const lastDay = new Date(year, month0 + 1, 0).getDate();
    const start = `${month}-01`;
    const end = `${month}-${String(lastDay).padStart(2, "0")}`;
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const [work, vacation, commute, mileage, settings, rates, yearCommute, yearMileage, ndfCount] = await Promise.all([
      client.from("billable_work_days").select("work_date").eq("user_id", userId)
        .gte("work_date", start).lte("work_date", end).order("work_date"),
      client.from("billable_vacation_days").select("vacation_date").eq("user_id", userId)
        .gte("vacation_date", start).lte("vacation_date", end).order("vacation_date"),
      client.from("billable_commute_days").select("commute_date").eq("user_id", userId)
        .gte("commute_date", start).lte("commute_date", end),
      client.from("billable_mileage_adjustments").select("month_date,extra_km").eq("user_id", userId).eq("month_date", start).maybeSingle(),
      client.from("user_billable_settings").select("tjm_ht").eq("user_id", userId).maybeSingle(),
      client.from("billable_rate_periods").select("client_name,start_date,end_date,tjm_ht")
        .eq("user_id", userId).order("start_date", { ascending: false }),
      client.from("billable_commute_days").select("commute_date", { count: "exact" }).eq("user_id", userId)
        .gte("commute_date", yearStart).lte("commute_date", yearEnd).order("commute_date").range(0, 999),
      client.from("billable_mileage_adjustments").select("month_date,extra_km", { count: "exact" }).eq("user_id", userId)
        .gte("month_date", yearStart).lte("month_date", yearEnd).order("month_date").range(0, 999),
      client.from("transactions").select("id,date,label,category,category_manual,amount,company,scope", { count: "exact" })
        .eq("user_id", userId).eq("scope", "personal").lt("amount", 0)
        .gte("date", start).lte("date", end).order("date", { ascending: false }).order("id", { ascending: false }).range(0, 999)
    ]);
    const activityReads = [work, vacation, commute, rates];
    if (mileage.error || settings.error || activityReads.some(result => result.error) ||
        yearCommute.error || yearMileage.error || ndfCount.error ||
        yearCommute.count == null || yearMileage.count == null || ndfCount.count == null ||
        yearCommute.count > 1000 || yearMileage.count > 1000 || ndfCount.count > 1000 ||
        yearCommute.data?.length !== yearCommute.count || yearMileage.data?.length !== yearMileage.count ||
        ndfCount.data?.length !== ndfCount.count) {
      throw new MobileError(503, "Mois d’activité incomplet.");
    }
    const extraKm = mileage.data == null ? {} : { [month]: Number(mileage.data.extra_km) };
    const yearExtraKm = Object.fromEntries((yearMileage.data ?? []).map(row => [row.month_date.slice(0, 7), Number(row.extra_km)]));
    const activity = {
      workDays: (work.data ?? []).map(row => row.work_date.slice(0, 10)),
      vacationDays: (vacation.data ?? []).map(row => row.vacation_date.slice(0, 10)),
      commuteDays: (commute.data ?? []).map(row => row.commute_date.slice(0, 10)),
      mileageExtraKmByMonth: extraKm,
      tjm: settings.data?.tjm_ht == null ? null : Number(settings.data.tjm_ht),
      rates: (rates.data ?? []).map(row => ({ clientName: row.client_name, startDate: row.start_date,
        endDate: row.end_date, tjmHt: Number(row.tjm_ht) }))
    };
    const personal = (ndfCount.data ?? []).map((row): DashboardTx => ({
      id: row.id, date: row.date.slice(0, 10), label: row.label ?? "", category: row.category ?? "",
      categoryManual: row.category_manual ?? undefined, amount: Number(row.amount),
      company: row.company ?? "", scope: "personal"
    }));
    const now = new Date();
    const expenses = mobileActivityExpenses(personal, {
      ...activity, annualTarget: null,
      commuteDays: (yearCommute.data ?? []).map(row => row.commute_date.slice(0, 10)),
      mileageExtraKmByMonth: yearExtraKm
    }, month, now)[month];
    return mobileJSON({ ...buildMobileActivityMonth(activity, month, now), expenses });
  } catch (error) { return mobileFailure(error); }
}
