import Link from "next/link";
import { cookies } from "next/headers";
import {
  getSupabaseRuntimeMode,
  reportSupabaseEnvDiagnostics
} from "@/lib/supabase/config";
import {
  getDashboardEffectiveDataMode,
} from "@/lib/dashboard-demo-preference";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMockTransactions } from "@/lib/mock-data";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { Logo } from "@/components/ui/Logo";
import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";
import { AnalyseClient } from "@/components/analyse/AnalyseClient";

export const dynamic = "force-dynamic";

export default async function AnalysePage() {
  reportSupabaseEnvDiagnostics("app/analyse/page");

  const envMode = getSupabaseRuntimeMode();
  const cookieStore = await cookies();
  const dataMode = getDashboardEffectiveDataMode(envMode, cookieStore);

  const supabase = envMode === "SUPABASE" ? await createSupabaseServerClient() : null;
  const user = !supabase ? null : (await supabase.auth.getUser()).data.user;

  if (envMode === "SUPABASE" && !user) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <Logo className="mx-auto mb-6" />
        <p className="text-slate-600">Connectez-vous pour voir l’analyse.</p>
        <Link href="/login" className="btn-primary mt-6 inline-flex">
          Connexion
        </Link>
      </div>
    );
  }

  const demoTransactions: DashboardTx[] = getMockTransactions().map((t) => ({
    id: t.id,
    date: t.date,
    label: t.label,
    category: mapExpenseCategoryLabel(t.category),
    amount: t.amount,
    company: (t.company ?? "").trim(),
    scope: t.scope ?? "pro"
  }));

  type SupabaseTxRow = {
    id: string;
    date: string;
    label: string | null;
    category: string | null;
    amount: number | string;
    balance?: number | string | null;
    company: string | null;
    scope?: "pro" | "personal" | null;
  };

  let rawRows: SupabaseTxRow[] = [];
  if (envMode === "SUPABASE" && dataMode === "SUPABASE" && supabase) {
    const withBalance = await supabase
      .from("transactions")
      .select("id,date,label,category,amount,balance,company,scope")
      .order("date", { ascending: false })
      .limit(5000);

    const errMsg =
      withBalance.error && typeof withBalance.error.message === "string"
        ? withBalance.error.message
        : "";
    const missingColumn = (col: string) =>
      errMsg &&
      new RegExp(col, "i").test(errMsg) &&
      /(could not find|schema cache|does not exist)/i.test(errMsg);
    const balanceColumnMissing = missingColumn("balance");
    const scopeColumnMissing = missingColumn("scope");

    if (balanceColumnMissing || scopeColumnMissing) {
      const withoutBalance = await supabase
        .from("transactions")
        .select(
          scopeColumnMissing
            ? "id,date,label,category,amount,company"
            : "id,date,label,category,amount,company,scope"
        )
        .order("date", { ascending: false })
        .limit(5000);
      if (!withoutBalance.error) {
        rawRows = (withoutBalance.data ?? []) as unknown as SupabaseTxRow[];
      }
    } else if (!withBalance.error) {
      rawRows = (withBalance.data ?? []) as unknown as SupabaseTxRow[];
    }
  }

  const transactions: DashboardTx[] =
    dataMode === "DEMO"
      ? demoTransactions
      : rawRows.map((row) => ({
          id: String(row.id),
          date: String(row.date).slice(0, 10),
          label: String(row.label ?? ""),
          category: mapExpenseCategoryLabel(String(row.category ?? "")),
          amount: Number(row.amount),
          balance: row.balance == null ? null : Number(row.balance),
          company: String(row.company ?? "").trim(),
          scope: row.scope === "personal" ? "personal" : "pro"
        }));

  const syncKey = `${transactions.length}:${transactions[0]?.id ?? ""}:${transactions.at(-1)?.id ?? ""}`;

  return <AnalyseClient key={syncKey} initialTransactions={transactions} />;
}
