import { z } from "zod";
import { mobileAuth, mobileFailure, mobileJSON, MobileError } from "@/lib/mobile/auth";
import { buildMobileActivity } from "@/lib/mobile/activity";
import { loadAllUserTransactionsFromSupabase } from "@/lib/supabase/fetch-all-transactions";

export const dynamic = "force-dynamic";
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const dateSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/).refine(value => {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
});
const mutationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.enum(["work", "vacation", "commute"]), date: dateSchema, selected: z.boolean() }),
  z.object({ kind: z.literal("target"), value: z.number().positive().max(100_000_000).nullable() }),
  z.object({ kind: z.literal("mileage"), month: monthSchema, value: z.number().min(0).max(1_000_000) })
]);

async function readActivity(client: Awaited<ReturnType<typeof mobileAuth>>["client"], userId: string) {
  const [work, vacation, commute, mileage, settings, rates] = await Promise.all([
    client.from("billable_work_days").select("work_date", { count: "exact" }).eq("user_id", userId).order("work_date"),
    client.from("billable_vacation_days").select("vacation_date", { count: "exact" }).eq("user_id", userId).order("vacation_date"),
    client.from("billable_commute_days").select("commute_date", { count: "exact" }).eq("user_id", userId),
    client.from("billable_mileage_adjustments").select("month_date,extra_km", { count: "exact" }).eq("user_id", userId),
    client.from("user_billable_settings").select("tjm_ht,annual_revenue_target_ht").eq("user_id", userId).maybeSingle(),
    client.from("billable_rate_periods").select("client_name,start_date,end_date,tjm_ht", { count: "exact" }).eq("user_id", userId).order("start_date", { ascending: false })
  ]);
  const lists = [work, vacation, commute, mileage, rates];
  if (settings.error || lists.some(result => result.error || result.count !== result.data?.length)) {
    throw new MobileError(503, "Activité incomplète. Réessayez après synchronisation.");
  }
  const mileageByMonth: Record<string, number> = {};
  for (const row of mileage.data ?? []) mileageByMonth[row.month_date.slice(0, 7)] = Number(row.extra_km);
  return {
    workDays: (work.data ?? []).map(row => row.work_date.slice(0, 10)),
    vacationDays: (vacation.data ?? []).map(row => row.vacation_date.slice(0, 10)),
    commuteDays: (commute.data ?? []).map(row => row.commute_date.slice(0, 10)),
    mileageExtraKmByMonth: mileageByMonth,
    tjm: settings.data?.tjm_ht == null ? null : Number(settings.data.tjm_ht),
    annualTarget: settings.data?.annual_revenue_target_ht == null ? null : Number(settings.data.annual_revenue_target_ht),
    rates: (rates.data ?? []).map(row => ({ clientName: row.client_name, startDate: row.start_date,
      endDate: row.end_date, tjmHt: Number(row.tjm_ht) }))
  };
}

export async function GET(request: Request) {
  try {
    const { client, userId } = await mobileAuth(request);
    const now = new Date();
    const rawMonth = new URL(request.url).searchParams.get("month") ??
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const month = monthSchema.safeParse(rawMonth);
    if (!month.success) throw new MobileError(400, "Mois invalide.");
    const [loaded, count, activity] = await Promise.all([
      loadAllUserTransactionsFromSupabase(client),
      client.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", userId),
      readActivity(client, userId)
    ]);
    if (loaded.errorMessage || count.error || count.count !== loaded.transactions.length) {
      throw new MobileError(503, "Données financières incomplètes.");
    }
    return mobileJSON(buildMobileActivity(loaded.transactions, activity, month.data, now));
  } catch (error) { return mobileFailure(error); }
}

export async function PUT(request: Request) {
  try {
    const { client, userId } = await mobileAuth(request);
    const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new MobileError(400, "Modification d’activité invalide.");
    const body = parsed.data;
    if (body.kind === "target") {
      const current = await client.from("user_billable_settings").select("tjm_ht").eq("user_id", userId).maybeSingle();
      if (current.error) throw new MobileError(503, "Réglages indisponibles.");
      const result = await client.from("user_billable_settings").upsert({ user_id: userId,
        tjm_ht: Number(current.data?.tjm_ht) > 0 ? Number(current.data?.tjm_ht) : 820,
        annual_revenue_target_ht: body.value }, { onConflict: "user_id" });
      if (result.error) throw new MobileError(503, "Objectif non enregistré.");
    } else if (body.kind === "mileage") {
      const monthDate = `${body.month}-01`;
      const result = body.value === 0
        ? await client.from("billable_mileage_adjustments").delete().eq("user_id", userId).eq("month_date", monthDate)
        : await client.from("billable_mileage_adjustments").upsert({ user_id: userId, month_date: monthDate,
            extra_km: Math.round(body.value * 10) / 10 }, { onConflict: "user_id,month_date" });
      if (result.error) throw new MobileError(503, "Kilométrage non enregistré.");
    } else {
      const result = body.kind === "work"
        ? body.selected
          ? await client.from("billable_work_days").upsert({ user_id: userId, work_date: body.date }, { onConflict: "user_id,work_date" })
          : await client.from("billable_work_days").delete().eq("user_id", userId).eq("work_date", body.date)
        : body.kind === "vacation"
          ? body.selected
            ? await client.from("billable_vacation_days").upsert({ user_id: userId, vacation_date: body.date }, { onConflict: "user_id,vacation_date" })
            : await client.from("billable_vacation_days").delete().eq("user_id", userId).eq("vacation_date", body.date)
          : body.selected
            ? await client.from("billable_commute_days").upsert({ user_id: userId, commute_date: body.date }, { onConflict: "user_id,commute_date" })
            : await client.from("billable_commute_days").delete().eq("user_id", userId).eq("commute_date", body.date);
      if (result.error) throw new MobileError(503, "Calendrier non enregistré.");
    }
    return mobileJSON({ ok: true });
  } catch (error) { return mobileFailure(error); }
}
