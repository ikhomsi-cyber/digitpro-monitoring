import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase not configured (demo mode)." }, { status: 400 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as null | {
    transactionId?: unknown;
    category?: unknown;
  };
  const transactionId = typeof body?.transactionId === "string" ? body.transactionId : "";
  const category = typeof body?.category === "string" ? body.category : "";
  if (!transactionId || !category) {
    return NextResponse.json({ ok: false, error: "Transaction ou catégorie manquante." }, { status: 400 });
  }

  const { error } = await supabase
    .from("transactions")
    .update({ category: mapExpenseCategoryLabel(category) })
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  revalidatePath("/categorisation");
  revalidatePath("/dashboard");
  return NextResponse.json({ ok: true });
}
