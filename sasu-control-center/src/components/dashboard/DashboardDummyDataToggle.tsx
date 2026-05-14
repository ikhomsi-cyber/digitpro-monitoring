"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { clsx } from "clsx";
import { setDashboardDummyDataMode } from "@/app/dashboard/actions";

export function DashboardDummyDataToggle({ active }: { active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={active}
      aria-label={active ? "Désactiver les données fictives à l’affichage" : "Activer les données fictives à l’affichage"}
      title={
        active
          ? "Afficher les montants et chiffres réels"
          : "Remplacer montants et indicateurs par des valeurs fictives (données réelles inchangées)"
      }
      onClick={() =>
        start(async () => {
          await setDashboardDummyDataMode(!active);
          router.refresh();
        })
      }
      className={clsx(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-2 text-[11px] font-medium transition sm:gap-2 sm:px-2.5 sm:text-xs",
        active
          ? "border-amber-400/90 bg-amber-50 text-amber-950 shadow-sm dark:border-amber-500/45 dark:bg-amber-500/15 dark:text-amber-50"
          : "border-ink-200/90 bg-white/90 text-ink-700 dark:border-white/10 dark:bg-white/5 dark:text-white/85"
      )}
    >
      <FlaskConical className="h-3.5 w-3.5 shrink-0 opacity-85 sm:h-4 sm:w-4" aria-hidden />
      <span className="max-[360px]:sr-only">Fictif</span>
      <span
        className={clsx(
          "relative h-5 w-9 shrink-0 rounded-full border transition-colors",
          active
            ? "border-amber-500/60 bg-amber-300/80 dark:border-amber-400/50 dark:bg-amber-400/35"
            : "border-ink-300 bg-ink-100 dark:border-white/15 dark:bg-white/10"
        )}
        aria-hidden
      >
        <span
          className={clsx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow dark:bg-ink-950",
            active ? "translate-x-[18px]" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}
