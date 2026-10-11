import { createHash, randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const response = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "private, no-store", Vary: "Authorization" }
});

/** The only agent tool: bounded aggregates of professional transactions, never credentials or raw labels. */
export async function GET(request: Request) {
  if (process.env.AGENT_ACCESS_ENABLED !== "true") return response({ error: "Accès agent désactivé." }, 403);
  const token = /^Bearer (dp_agent_[A-Za-z0-9_-]{43})$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return response({ error: "Identité agent requise." }, 401);
  const query = new URL(request.url).searchParams;
  const from = query.get("from") ?? "", to = query.get("to") ?? "";
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!validDate(from) || !validDate(to) || to < from ||
    Date.parse(to) - Date.parse(from) > 92 * 86400_000 || [...query.keys()].some(k => !["from", "to"].includes(k))) {
    return response({ error: "Période invalide (93 jours maximum)." }, 400);
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return response({ error: "Service agent indisponible." }, 503);
  const requestId = randomUUID();
  const authorized = await admin.rpc("agent_authorize", {
    p_hash: createHash("sha256").update(token).digest("hex"), p_request_id: requestId
  });
  if (authorized.error) return response({ error: "Service agent indisponible." }, 503);
  if (!authorized.data) return response({ error: "Accès agent refusé ou quota atteint." }, 403);
  const grant = authorized.data as { id: string; user_id: string };
  let outcome = "failure";
  try {
    let credits = 0, debits = 0, count = 0;
    // Explicit tenant + pro filters are mandatory: this client bypasses RLS.
    for (let offset = 0; offset < 10_000; offset += 1000) {
      const result = await admin.from("transactions").select("id,amount", { count: "exact" })
        .eq("user_id", grant.user_id).eq("scope", "pro").gte("date", from).lte("date", to)
        .order("id").range(offset, offset + 999);
      if (result.error || result.count == null || result.count > 10_000) throw new Error("Query unavailable");
      for (const row of result.data ?? []) {
        const amount = Number(row.amount);
        if (!Number.isFinite(amount)) throw new Error("Invalid amount");
        if (amount >= 0) credits += amount; else debits += -amount;
        count++;
      }
      if (count >= result.count) break;
      if (!result.data?.length) throw new Error("Incomplete result");
    }
    outcome = "success";
    // Revocation is checked again before returning any data.
    const completed = await admin.rpc("agent_complete", { p_grant_id: grant.id, p_request_id: requestId, p_outcome: outcome });
    if (completed.error || !completed.data || process.env.AGENT_ACCESS_ENABLED !== "true") {
      return response({ error: "Accès agent révoqué." }, 403);
    }
    const round = (n: number) => Math.round(n * 100) / 100;
    return response({ from, to, scope: "pro", currency: "EUR", transactionCount: count,
      cashCredits: round(credits), cashDebits: round(debits), cashNet: round(credits - debits) });
  } catch {
    await admin.rpc("agent_complete", { p_grant_id: grant.id, p_request_id: requestId, p_outcome: "failure" });
    return response({ error: "Synthèse indisponible." }, 503);
  }
}
