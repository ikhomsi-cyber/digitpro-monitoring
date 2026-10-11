import "server-only";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import type { BankinPiloteSnapshot } from "@/lib/pilote";
type Client = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
export async function saveBankinPiloteSnapshot(client: Client, userId: string, snapshot: BankinPiloteSnapshot) {
  const { error } = await client.from("bankin_pilote_snapshots").upsert({ user_id: userId, snapshot: snapshot as unknown as Json, updated_at: snapshot.importedAt }, { onConflict: "user_id" });
  if (error) throw new Error("Le bilan Bankin ne peut pas être enregistré. Vérifiez la migration Pilote.");
}
