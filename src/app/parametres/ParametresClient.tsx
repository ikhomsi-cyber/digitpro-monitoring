"use client";

import { useTransition } from "react";
import { CalendarDays, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createBillableRatePeriod,
  deleteBillableRatePeriod
} from "./actions";

export type BillableRatePeriod = {
  id: string;
  clientName: string;
  startDate: string;
  endDate: string | null;
  tjmHt: number;
};

function formatEuro(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1));
}

export function ParametresClient({ periods }: { periods: BillableRatePeriod[] }) {
  const [isPending, startTransition] = useTransition();

  function onCreate(formData: FormData) {
    startTransition(async () => {
      try {
        await createBillableRatePeriod(formData);
        toast.success("Période TJM enregistrée");
      } catch (error) {
        toast.error("Enregistrement impossible", {
          description: error instanceof Error ? error.message : undefined
        });
      }
    });
  }

  function onDelete(formData: FormData) {
    startTransition(async () => {
      try {
        await deleteBillableRatePeriod(formData);
        toast.success("Période supprimée");
      } catch (error) {
        toast.error("Suppression impossible", {
          description: error instanceof Error ? error.message : undefined
        });
      }
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[24rem_minmax(0,1fr)]">
      <form
        action={onCreate}
        className="rounded-3xl border border-ink-200 bg-white p-5 shadow-[0_14px_54px_-28px_rgba(0,0,0,0.2)] dark:border-white/[0.08] dark:bg-white/[0.04]"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500 dark:text-white/45">
          Nouvelle période
        </p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-ink-600 dark:text-white/55">Client</span>
            <input
              name="clientName"
              required
              placeholder="Ex. Hiway, Qonto, Client final"
              className="mt-1 h-12 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-900 outline-none focus:border-emerald-500 dark:border-cyan-100/[0.12] dark:bg-white/[0.05] dark:text-white"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-ink-600 dark:text-white/55">Début</span>
              <input
                name="startDate"
                type="date"
                required
                className="mt-1 h-12 w-full rounded-2xl border border-ink-200 bg-white px-3 text-sm font-semibold text-ink-900 outline-none focus:border-emerald-500 dark:border-cyan-100/[0.12] dark:bg-white/[0.05] dark:text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink-600 dark:text-white/55">Fin</span>
              <input
                name="endDate"
                type="date"
                className="mt-1 h-12 w-full rounded-2xl border border-ink-200 bg-white px-3 text-sm font-semibold text-ink-900 outline-none focus:border-emerald-500 dark:border-cyan-100/[0.12] dark:bg-white/[0.05] dark:text-white"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-ink-600 dark:text-white/55">TJM HT</span>
            <input
              name="tjmHt"
              type="number"
              min="1"
              step="1"
              required
              placeholder="620"
              className="mt-1 h-12 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-900 outline-none focus:border-emerald-500 dark:border-cyan-100/[0.12] dark:bg-white/[0.05] dark:text-white"
            />
          </label>
          <button type="submit" className="btn-primary min-h-12 w-full" disabled={isPending}>
            Ajouter la période
          </button>
        </div>
      </form>

      <section className="overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-[0_14px_54px_-28px_rgba(0,0,0,0.2)] dark:border-white/[0.08] dark:bg-white/[0.04]">
        <div className="border-b border-ink-100 px-5 py-4 dark:border-white/[0.06]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500 dark:text-white/45">
            TJM par période
          </p>
        </div>
        {periods.length === 0 ? (
          <div className="p-5 text-sm text-ink-500 dark:text-white/45">
            Aucune période configurée pour le moment.
          </div>
        ) : (
          <div>
            {periods.map((period) => (
              <article
                key={period.id}
                className="grid gap-3 border-b border-ink-100 px-5 py-4 last:border-b-0 dark:border-white/[0.06] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-display text-lg font-bold text-ink-950 dark:text-white">
                      {period.clientName}
                    </p>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      {formatEuro(period.tjmHt)} HT / jour
                    </span>
                  </div>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-500 dark:text-white/45">
                    <CalendarDays className="h-4 w-4" aria-hidden />
                    {formatDate(period.startDate)}
                    {" -> "}
                    {period.endDate ? formatDate(period.endDate) : "en cours"}
                  </p>
                </div>
                <form action={onDelete}>
                  <input type="hidden" name="id" value={period.id} />
                  <button
                    type="submit"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/15 bg-rose-500/[0.06] text-rose-700 transition hover:bg-rose-500/[0.1] disabled:opacity-60 dark:text-rose-300"
                    disabled={isPending}
                    aria-label="Supprimer la période"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
