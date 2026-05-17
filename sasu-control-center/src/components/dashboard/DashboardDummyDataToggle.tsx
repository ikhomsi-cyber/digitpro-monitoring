"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { clsx } from "clsx";
import { setDashboardDummyDataMode } from "@/app/dashboard/actions";

export function DashboardDummyDataToggle({ active }: { active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const Icon = active ? EyeOff : Eye;

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
        "group relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black",
        active
          ? "border-amber-300/70 bg-gradient-to-br from-amber-200 to-orange-100 text-amber-950 shadow-[0_10px_28px_-16px_rgba(245,158,11,0.8)] dark:border-amber-300/35 dark:from-amber-300/25 dark:to-orange-500/10 dark:text-amber-50"
          : "border-white/10 bg-gradient-to-br from-white/[0.12] to-white/[0.035] text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:from-white/[0.16] hover:to-white/[0.06]"
      )}
    >
      <span className={clsx("absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100", active ? "bg-amber-300/20" : "bg-emerald-400/10")} aria-hidden />
      <Icon className="relative h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden />
      <span
        className={clsx(
          "absolute bottom-1 right-1 h-2 w-2 rounded-full ring-2 ring-white/80 dark:ring-black",
          active ? "bg-amber-400" : "bg-emerald-400"
        )}
        aria-hidden
      />
      <span className="sr-only">{active ? "Réel masqué" : "Fictif"}</span>
    </button>
  );
}
