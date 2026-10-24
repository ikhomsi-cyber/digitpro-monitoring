import "server-only";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import type { BankinPiloteSnapshot } from "@/lib/pilote";
import { encodePiloteStorage, decodePiloteStorage, type StoredPiloteSnapshot } from "./pilote-storage";
import { mergeBankinPiloteSnapshots } from "./merge-pilote";
export class PiloteStoreError extends Error {
  constructor(message: string, readonly operation: string, readonly code?: string) { super(message); this.name = "PiloteStoreError"; }
}
function databaseFailure(operation: string, code?: string): PiloteStoreError {
  const reasons: Record<string, string> = {
    "23514": "La base refuse le format ou la taille du bilan Pilote.",
    "42703": "La structure de la table Pilote n’est pas à jour (colonne manquante).",
    "42P01": "La table de stockage Pilote n’est pas installée.",
    "42501": "Votre compte n’a pas l’autorisation d’enregistrer ce bilan Pilote.",
    "57014": "L’enregistrement du bilan Pilote a dépassé le délai de la base.",
    "PGRST116": "La base a renvoyé un résultat Pilote inattendu."
  };
  const reason = code && Object.hasOwn(reasons, code) ? reasons[code] : "La base n’a pas pu enregistrer le bilan Pilote.";
  return new PiloteStoreError(`${reason} Votre bilan précédent est conservé.`, operation, code);
}
type Client = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
export async function saveBankinPiloteSnapshot(client: Client, userId: string, snapshot: BankinPiloteSnapshot) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error: readError } = await client.from("bankin_pilote_snapshots").select("snapshot, updated_at").eq("user_id", userId).maybeSingle();
    if (readError) throw databaseFailure("read", readError.code);
    const previous = data ? decodePiloteStorage(data.snapshot as unknown as BankinPiloteSnapshot) : null;
    const merged = mergeBankinPiloteSnapshots(previous, snapshot);
    if (merged === previous) return merged;
    const updatedAt = new Date(Math.max(Date.now(), data ? Date.parse(data.updated_at) + 1 : 0)).toISOString();
    let encoded: StoredPiloteSnapshot;
    try { encoded = encodePiloteStorage(merged); }
    catch { throw new PiloteStoreError("Le bilan Pilote dépasse encore la capacité de stockage, même compressé. Votre bilan précédent est conservé.", "encode"); }
    const values = { snapshot: encoded as unknown as Json, updated_at: updatedAt };
    if (!data) {
      const { error } = await client.from("bankin_pilote_snapshots").insert({ user_id: userId, ...values });
      if (!error) return merged;
      if (error.code === "23505") continue;
      throw databaseFailure("write", error.code);
    }
    // Compare-and-swap prevents simultaneous Gmail/Excel imports overwriting one another.
    const { data: saved, error } = await client.from("bankin_pilote_snapshots").update(values).eq("user_id", userId).eq("updated_at", data.updated_at).select("user_id").maybeSingle();
    if (error) throw databaseFailure("write", error.code);
    if (saved) return merged;
  }
  throw new PiloteStoreError("La base n’a confirmé aucune mise à jour du bilan après trois tentatives. Votre bilan précédent est conservé.", "concurrent-update");
}
