import type { importTransactionsWithClient } from "@/lib/import-transactions";
import { MobileError } from "@/lib/mobile/auth";
type Client = Parameters<typeof importTransactionsWithClient>[0];
const marker = (scope: "pro" | "personal") => `DigitPro bank sync completed:${scope}`;

/** Audit entry written only after the provider request and import have succeeded. */
export async function recordBankSync(client: Client, userId: string, scope: "pro" | "personal") {
  const { error } = await client.from("import_sessions").insert({ user_id: userId,
    source_filename: marker(scope), format: scope === "pro" ? "qonto" : "powens", row_count: 0,
    inserted_count: 0, skipped_duplicate_count: 0 });
  if (error) throw new MobileError(503, "Transactions synchronisées, mais date de synchronisation non enregistrée.");
}
export async function readBankSyncStatus(client: Client, userId: string) {
  const dates = await Promise.all((["pro", "personal"] as const).map(async scope => {
    const { data, error } = await client.from("import_sessions").select("created_at")
      .eq("user_id", userId).eq("source_filename", marker(scope))
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    return error ? null : data?.created_at ?? null;
  }));
  return { pro: dates[0], personal: dates[1] };
}
