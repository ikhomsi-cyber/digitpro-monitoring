"use client";

import { useTransition } from "react";
import { CreditCard, Sparkles, Tags } from "lucide-react";
import { toast } from "sonner";
import {
  markPowensTransactionAsNdfDigitPro,
  updatePowensTransactionCategory
} from "./actions";

export type CategorisationTx = {
  id: string;
  date: string;
  label: string;
  amount: number;
  company: string;
  bankName: string | null;
};

function formatEuro(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(amount);
}

export function CategorisationClient({
  transactions,
  categories
}: {
  transactions: CategorisationTx[];
  categories: string[];
}) {
  const [isPending, startTransition] = useTransition();

  function runAction(
    action: (formData: FormData) => Promise<void>,
    formData: FormData,
    successMessage: string
  ) {
    startTransition(async () => {
      try {
        await action(formData);
        toast.success(successMessage);
      } catch (error) {
        toast.error("Impossible d’enregistrer", {
          description: error instanceof Error ? error.message : undefined
        });
      }
    });
  }

  function onSubmit(formData: FormData) {
    runAction(updatePowensTransactionCategory, formData, "Catégorie enregistrée");
  }

  function onQuickNdf(formData: FormData) {
    runAction(markPowensTransactionAsNdfDigitPro, formData, "Classé en NDF DigitPro");
  }

  if (!transactions.length) {
    return (
      <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-sm text-emerald-900 dark:text-emerald-100">
        Toutes les transactions Powens importées sont catégorisées.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((tx) => (
        <article
          key={tx.id}
          className="group overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-[0_8px_32px_-14px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.02] transition hover:-translate-y-0.5 hover:shadow-[0_18px_60px_-24px_rgba(0,0,0,0.25)] dark:border-white/[0.08] dark:bg-white/[0.04] dark:ring-white/[0.05]"
        >
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_25rem]">
            <div className="min-w-0 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-sky-500/15 bg-sky-500/10 text-sky-700 dark:text-sky-300">
                  <CreditCard className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink-950 dark:text-white" title={tx.label}>
                        {tx.label}
                      </p>
                      <p className="mt-1 text-xs text-ink-500 dark:text-white/45">
                        {tx.date}
                        {tx.bankName ? ` · ${tx.bankName}` : ""}
                        {tx.company ? ` · ${tx.company}` : ""}
                      </p>
                    </div>
                    <p className="font-display text-xl font-bold tabular-nums text-rose-700 dark:text-rose-300">
                      {formatEuro(tx.amount)}
                    </p>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/15 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                    <Tags className="h-3.5 w-3.5" aria-hidden />
                    Carte Powens à classer
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-ink-100 bg-ink-50/70 p-4 dark:border-white/[0.06] dark:bg-black/20 lg:border-l lg:border-t-0">
              <form action={onQuickNdf}>
                <input type="hidden" name="transactionId" value={tx.id} />
                <button
                  type="submit"
                  className="mb-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 text-sm font-bold text-white shadow-[0_14px_36px_-18px_rgba(16,185,129,0.75)] transition hover:brightness-105 disabled:opacity-60"
                  disabled={isPending}
                >
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Classer en NDF DigitPro
                </button>
              </form>
              <form action={onSubmit} className="flex gap-2">
                <input type="hidden" name="transactionId" value={tx.id} />
              <select
                name="category"
                className="min-h-11 min-w-0 flex-1 rounded-2xl border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-black/30 dark:text-white"
                defaultValue=""
                required
                disabled={isPending}
              >
                <option value="" disabled>
                  Choisir une catégorie Bankin
                </option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-primary min-h-11 shrink-0" disabled={isPending}>
                Valider
              </button>
              </form>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
