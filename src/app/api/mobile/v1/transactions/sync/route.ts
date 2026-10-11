import { assertQontoOwner } from "@/lib/security/qonto-access";
import { withSyncJob } from "@/lib/security/sync-job";
import { recordBankSync } from "@/lib/mobile/bank-sync-status";
import { mobileAuth, mobileFailure, mobileJSON, MobileError } from "@/lib/mobile/auth";
import { fetchQontoTransactionsForImport } from "@/lib/qonto/sync";
import { importTransactionsWithClient } from "@/lib/import-transactions";
import { getSupabaseRuntimeMode } from "@/lib/supabase/config";
import { syncMobilePowens } from "@/lib/mobile/powens-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const { client, userId } = await mobileAuth(request);
    if (getSupabaseRuntimeMode() === "DEMO") throw new MobileError(403, "Synchronisation désactivée en mode démo.");
    const scope = new URL(request.url).searchParams.get("scope") ?? "pro";
    if (!["pro", "personal", "all"].includes(scope)) throw new MobileError(400, "Périmètre invalide.");
    if (scope === "personal") return mobileJSON(await syncMobilePowens(client, userId));
    assertQontoOwner(userId);
    const professional = await withSyncJob(client, userId, "qonto", async () => {
      const { rows } = await fetchQontoTransactionsForImport(userId);
      const result = await importTransactionsWithClient(client, rows, {
        sourceFilename: `Qonto API iOS · ${new Date().toISOString()}`,
        format: "qonto", fileHash: null
      });
      await recordBankSync(client, userId, "pro");
      return { inserted: result.inserted.length, merged: result.merged };
    });
    const personal = scope === "all" ? await syncMobilePowens(client, userId) : { inserted: 0, merged: 0 };
    return mobileJSON({ inserted: professional.inserted + personal.inserted, merged: professional.merged + personal.merged });
  } catch (error) { return mobileFailure(error); }
}
