import "server-only";
import { MobileError } from "@/lib/mobile/auth";
import { isPowensCloudConfigured, powensCloudFetchTransactions } from "@/lib/powens/cloud-api";
import { powensAccountFilterForAxis, powensDefaultCompanyLabel } from "@/lib/powens/config";
import { mapPowensRowsToImportTx, loadBankinReferenceData, applyBankinReferenceToPowensRows } from "@/lib/powens/import-reference";
import { importTransactionsWithClient } from "@/lib/import-transactions";

export async function syncMobilePowens(client: Parameters<typeof importTransactionsWithClient>[0], userId: string) {
  if (!isPowensCloudConfigured()) throw new MobileError(503, "Powens n’est pas configuré.");
  const { data, error } = await client.from("powens_users").select("auth_token,powens_user_id")
    .eq("user_id", userId).maybeSingle();
  if (error) throw new MobileError(503, "Connexion Powens indisponible.");
  const token = data?.auth_token?.trim();
  if (!token) throw new MobileError(409, "Connectez votre compte Powens depuis l’app web avant de synchroniser.");
  const rows = await powensCloudFetchTransactions(token, {
    scope: "personal", company: powensDefaultCompanyLabel("personal"),
    powensUserId: data?.powens_user_id == null ? null : String(data.powens_user_id),
    filterAccountIds: powensAccountFilterForAxis("personal")
  });
  const reference = await loadBankinReferenceData(client);
  const transactions = applyBankinReferenceToPowensRows(mapPowensRowsToImportTx(rows), reference, "personal");
  const result = await importTransactionsWithClient(client, transactions, {
    sourceFilename: `Powens API iOS (perso) · ${new Date().toISOString()}`, format: "powens", fileHash: null
  });
  return { inserted: result.inserted.length, merged: result.merged };
}
