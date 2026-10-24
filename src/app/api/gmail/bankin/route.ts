import { gmailAccount } from "@/lib/gmail/accounts";
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
import { PiloteHistoryError } from "@/lib/bankin/merge-pilote";
import { saveBankinPiloteSnapshot, PiloteStoreError } from "@/lib/bankin/pilote-store";
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
  let account;
  try { account = gmailAccount(new URL(request.url).searchParams.get("account")); }
  catch { return fail("Compte Gmail invalide.", 400); }
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
      stage = "pilote-workbook-parse";
      const original = parseBankinPiloteWorkbook(Uint8Array.from(file.buffer).buffer);
      const snapshot = buildBankinPiloteSnapshot(original, file.filename, createHash("sha256").update(file.buffer).digest("hex"));
      stage = "pilote-save";
      await saveBankinPiloteSnapshot(client, user.id, snapshot);
      console.info("[bankin] pilote saved");
      // Pilote is the primary result. A separate transaction sync must not discard it.
      stage = "transaction-import";
      let imported: Awaited<ReturnType<typeof importTransactionsWithClient>> | null = null;
      let warning: string | undefined;
      try {
        imported = await importTransactionsWithClient(client, rows, { sourceFilename: file.filename, format: "bankin", fileHash: createHash("sha256").update(file.buffer).digest("hex") });
      } catch (error) {
        const failure = error as { code?: unknown; status?: number; response?: { status?: number } };
        if ([401, 403].includes(failure?.status ?? failure?.response?.status ?? 0) || ["42501", "PGRST301", "PGRST302", 401, 403].includes(failure?.code as string | number)) throw error;
        warning = "Les transactions générales n’ont pas pu être entièrement actualisées. Vous pouvez relancer l’import sans supprimer le bilan Pilote.";
        console.warn("[bankin] general transaction sync failed after Pilote was saved");
      }
      return { imported, warning };
    }, account));
    if (!result) return fail("Connectez Gmail avant de récupérer votre export.", 409);
    revalidatePath("/dashboard");
    return Response.json({
      inserted: result.imported?.inserted.length ?? 0,
      merged: result.imported?.merged ?? 0,
      alreadyImported: Boolean(result.imported?.fileAlreadyImported),
      ...(result.warning ? { warning: result.warning } : {})
    }, { headers: privateResponseHeaders });
  } catch (e) {
    if (e instanceof PiloteStoreError) {
      console.warn("[bankin] pilote storage failed", { operation: e.operation, code: e.code });
      return fail(e.message, e.code === "42501" ? 403 : 503);
    }
    if (e instanceof SyncBusyError) return fail(e.message, 429);
    if (e instanceof PiloteHistoryError) return fail(e.message, 409);
    if (e instanceof BankinExportError) return fail(e.message, 422);
    const details = e as { name?: string; code?: unknown; response?: { status?: number }; cause?: { code?: unknown } };
    console.warn("[bankin] import failed", { stage, type: details?.name, status: details?.response?.status, code: typeof details?.code === "number" || (typeof details?.code === "string" && /^[A-Z0-9_]{3,20}$/.test(details.code)) ? details.code : undefined });
    if ([401, 403].includes(details?.response?.status ?? 0) || [401, 403, "42501", "PGRST301", "PGRST302"].includes(details?.code as string | number)) return fail("Accès refusé pendant l’import. Reconnectez-vous avant de réessayer.", details?.code === "42501" || details?.code === 403 || details?.response?.status === 403 ? 403 : 401);
    // Do not send provider errors, email content, tokens or database details to the browser.
    const message = stage === "pilote-save"
      ? "L’export a été récupéré, mais le bilan Pilote n’a pas pu être enregistré. Votre bilan précédent est conservé. Réessayez dans quelques instants."
      : stage === "pilote-workbook-parse"
        ? "L’export a été récupéré, mais son détail Pilote est illisible. Essayez un nouvel export Bankin."
        : "La récupération Gmail a échoué. Vérifiez votre connexion Gmail, puis réessayez.";
    return fail(message, 502);
  }
}
