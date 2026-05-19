"use client";

import { useTransition } from "react";
import { Check, CreditCard, Sparkles, Tags } from "lucide-react";
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

function cleanMerchantLabel(label: string): string {
  return label
    .replace(/^\s*(carte|card|cb)\s*(\d{2,}|[*x•]+\d*)?\s*/i, "")
    .replace(/^\s*(paiement|payment)\s+(carte|card|cb)\s*/i, "")
    .replace(/\s+(carte|card|cb)\s*(\d{2,}|[*x•]+\d*)?\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim() || label;
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
    <div className="overflow-hidden rounded-[1.75rem] border border-ink-200 bg-white shadow-[0_14px_54px_-28px_rgba(0,0,0,0.22)] dark:border-white/[0.08] dark:bg-white/[0.035]">
      {transactions.map((tx) => (
        <article
          key={tx.id}
          className="group border-b border-ink-100 transition-colors last:border-b-0 hover:bg-ink-50/70 dark:border-white/[0.06] dark:hover:bg-white/[0.035]"
        >
          <div className="grid gap-4 px-4 py-4 sm:px-5 sm:py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-ink-200 bg-white text-ink-600 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/70">
                <CreditCard className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="min-w-0 flex-1 truncate text-lg font-semibold text-ink-950 dark:text-white sm:text-xl" title={tx.label}>
                    {cleanMerchantLabel(tx.label)}
                  </p>
                  <p className="font-display text-2xl font-bold tabular-nums text-ink-950 dark:text-white sm:text-3xl">
                    {formatEuro(tx.amount)}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-500 dark:text-white/45">
                  <span>{tx.date}</span>
                  {tx.bankName ? <span>· {tx.bankName}</span> : null}
                  {tx.company ? <span>· {tx.company}</span> : null}
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-800 dark:text-amber-200">
                    <Tags className="h-3 w-3" aria-hidden />
                    Carte à classer
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center lg:w-[34rem]">
              <form action={onQuickNdf} className="shrink-0">
                <input type="hidden" name="transactionId" value={tx.id} />
                <button
                  type="submit"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-5 text-base font-bold text-emerald-800 transition hover:border-emerald-500/30 hover:bg-emerald-500/[0.13] disabled:opacity-60 dark:text-emerald-200 sm:w-auto"
                  disabled={isPending}
                  title="Classer directement en NDF DigitPro"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  NDF DigitPro
                </button>
              </form>

              <form action={onSubmit} className="flex min-w-0 flex-1 items-center gap-1.5">
                <input type="hidden" name="transactionId" value={tx.id} />
                <div className="relative min-w-0 flex-1">
                  <select
                    name="category"
                    className="h-12 w-full appearance-none rounded-full border border-ink-200 bg-white pl-5 pr-10 text-base font-semibold text-ink-800 outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-black/25 dark:text-white/80"
                    defaultValue=""
                    required
                    disabled={isPending}
                  >
                    <option value="" disabled>
                      Autre catégorie
                    </option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-ink-400">
                    ▾
                  </span>
                </div>
                <button
                  type="submit"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink-950 text-white transition hover:bg-ink-800 disabled:opacity-60 dark:bg-white dark:text-ink-950 dark:hover:bg-white/90"
                  disabled={isPending}
                  aria-label="Valider la catégorie"
                  title="Valider"
                >
                  <Check className="h-4 w-4" aria-hidden />
                </button>
              </form>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
