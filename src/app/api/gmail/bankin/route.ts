import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseRuntimeMode } from "@/lib/supabase/config";
import { getDashboardEffectiveDataMode } from "@/lib/dashboard-demo-preference";
import { requireSameOrigin, privateResponseHeaders } from "@/lib/security/http";
import { withSyncJob, SyncBusyError } from "@/lib/security/sync-job";
import { withAuthorizedGmailClient } from "@/lib/gmail/tokens";
import { fetchLatestBankinExport, BankinExportError } from "@/lib/gmail/fetch-bankin-export";
import { parseBankinTransactionsWorkbook, parseBankinPiloteWorkbook } from "@/lib/bankin/parse-xlsx";
import { buildBankinPiloteSnapshot } from "@/lib/pilote";
import { saveBankinPiloteSnapshot } from "@/lib/bankin/pilote-store";
import { importTransactionsWithClient } from "@/lib/import-transactions";

export const maxDuration = 300;
export async function POST(request: Request) {
  const forbidden = requireSameOrigin(request);
  if (forbidden) return forbidden;
  const fail = (error: string, status: number) => Response.json({ error }, { status, headers: privateResponseHeaders });
  if (getDashboardEffectiveDataMode(getSupabaseRuntimeMode(), await cookies()) === "DEMO") return fail("Import désactivé en mode démo.", 403);
  const client = await createSupabaseServerClient();
  if (!client) return fail("Connexion requise.", 401);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return fail("Connexion requise.", 401);
  let stage = "gmail-authorization";
  try {
    const result = await withSyncJob(client, user.id, "gmail", () => withAuthorizedGmailClient(client, user.id, async auth => {
      stage = "gmail-export-download";
      const file = await fetchLatestBankinExport(auth);
      stage = "workbook-parse";
      let rows;
      try { rows = parseBankinTransactionsWorkbook(Uint8Array.from(file.buffer).buffer); }
      catch (error) {
        const reason = error instanceof Error ? error.message : "";
        const trusted = /^(Trop de lignes|Format d.export Bankin inattendu|Fichier trop volumineux|Archive Excel invalide|Fichier Excel vide|Aucune ligne)/.test(reason);
        throw new BankinExportError(trusted ? reason : "Le fichier Excel téléchargé est illisible ou ne correspond pas à l’export Bankin standard.");
      }
      if (!rows.length) throw new BankinExportError("Aucune transaction valide dans cet export.");
      stage = "transaction-import";
      const imported = await importTransactionsWithClient(client, rows, { sourceFilename: file.filename, format: "bankin", fileHash: createHash("sha256").update(file.buffer).digest("hex") });
      const original = parseBankinPiloteWorkbook(Uint8Array.from(file.buffer).buffer);
      const snapshot = buildBankinPiloteSnapshot(original, file.filename, createHash("sha256").update(file.buffer).digest("hex"));
      await saveBankinPiloteSnapshot(client, user.id, snapshot);
      return { file, imported };
    }));
    if (!result) return fail("Connectez Gmail avant de récupérer votre export.", 409);
    revalidatePath("/dashboard");
    return new Response(Uint8Array.from(result.file.buffer), { headers: {
      ...privateResponseHeaders,
      "Content-Type": "application/vnd.ms-excel",
      "Content-Disposition": `attachment; filename="${result.file.filename}"`,
      "X-Bankin-Filename": result.file.filename,
      "X-Bankin-Received": result.file.receivedAt,
      "X-Import-Inserted": String(result.imported.inserted.length),
      "X-Import-Merged": String(result.imported.merged),
      "X-Import-Already": String(Boolean(result.imported.fileAlreadyImported))
    } });
  } catch (e) {
    if (e instanceof SyncBusyError) return fail(e.message, 429);
    if (e instanceof BankinExportError) return fail(e.message, 422);
    const details = e as { name?: string; code?: unknown; response?: { status?: number }; cause?: { code?: unknown } };
    console.warn("[bankin] import failed", { stage, type: details?.name, status: details?.response?.status, code: typeof details?.code === "number" ? details.code : typeof details?.cause?.code === "string" ? details.cause.code : undefined });
    // Do not send provider errors, email content, tokens or database details to the browser.
    return fail("Import impossible. Vérifiez votre connexion Gmail et le format de l’export Bankin, puis réessayez.", 502);
  }
}
