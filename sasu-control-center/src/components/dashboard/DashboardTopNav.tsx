"use client";

import { LogOut } from "lucide-react";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { DashboardDataActionsMenu } from "@/components/dashboard/DashboardDataActionsMenu";
import { DashboardDummyDataToggle } from "@/components/dashboard/DashboardDummyDataToggle";
import { useDashboardDummyData } from "@/components/dashboard/DashboardDisplayFormatContext";
import { DashboardHeaderProfile } from "@/components/dashboard/DashboardHeaderProfile";
import { Logo } from "@/components/ui/Logo";
import type { SupabaseRuntimeMode } from "@/lib/supabase/config";

type Props = {
  envMode: SupabaseRuntimeMode;
  dataMode: "DEMO" | "SUPABASE";
  demoPreferenceOn: boolean;
  /** Affiche le toggle (session Supabase réelle). L'état vient du contexte (instantané). */
  showDummyDataToggle: boolean;
  userEmail: string | null | undefined;
  showDarkModeToggle: boolean;
  showLogout: boolean;
  canWrite?: boolean;
  powensCloudEnabled?: boolean;
  powensPersonalSyncEnabled?: boolean;
  powensPrimaryImportAxis?: "pro" | "personal";
};

export function DashboardTopNav({
  envMode,
  dataMode,
  demoPreferenceOn,
  showDummyDataToggle,
  userEmail,
  showDarkModeToggle,
  showLogout,
  canWrite = false,
  powensCloudEnabled = false,
  powensPersonalSyncEnabled = false,
  powensPrimaryImportAxis = "pro"
}: Props) {
  // Valeur live du contexte : le label / l'indicateur basculent instantanément avec le toggle.
  const dummyDataActive = useDashboardDummyData();
  const statusLabel =
    envMode === "DEMO"
      ? "Mode démo"
      : dummyDataActive
        ? "Données fictives (affichage)"
        : demoPreferenceOn
          ? "Mode démo activé"
          : userEmail
            ? `Connecté · ${userEmail}`
            : "Connecté";

  return (
    <nav
      className="sticky top-[env(safe-area-inset-top)] relative z-40 mx-auto mt-2 max-w-6xl overflow-visible rounded-[1.75rem] border border-ink-200/80 bg-white/80 px-3 py-3 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:border-cyan-100/[0.18] dark:bg-[#06242b] dark:shadow-[0_18px_70px_-24px_rgba(0,22,28,0.92),inset_0_1px_0_rgba(255,255,255,0.10)] sm:px-4 sm:py-3.5"
      aria-label="DigitPro — navigation principale"
    >
      <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(circle_at_50%_-50%,rgba(45,212,191,0.20),transparent_52%)] dark:block" aria-hidden />
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Logo withWordmark={false} size={40} className="relative shrink-0 rounded-2xl shadow-[0_14px_32px_-18px_rgba(255,255,255,0.7)]" />
          <div className="min-w-0">
            <div className="truncate font-display text-[16px] font-bold leading-none tracking-tight text-ink-900 dark:text-white sm:text-[18px]">
              DigitPro
            </div>
            <div className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.24em] text-ink-500 dark:text-cyan-50/62 sm:text-[11px]">
              Monitoring
            </div>
          </div>
          <span className="ml-1 hidden min-w-0 items-center gap-1.5 rounded-full border border-ink-200/90 bg-ink-50/90 px-2.5 py-1 text-[11px] font-medium text-ink-700 dark:border-cyan-100/[0.16] dark:bg-cyan-50/[0.10] dark:text-white/78 lg:inline-flex">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                dataMode === "DEMO" ? "bg-amber-400" : dummyDataActive ? "bg-sky-400" : "bg-emerald-400"
              }`}
            />
            <span className="max-w-[14rem] truncate">{statusLabel}</span>
          </span>
        </div>

        <div className="flex justify-center">
          <div className="relative">
            <span
              className="pointer-events-none absolute -inset-1 rounded-full bg-emerald-400/25 blur-lg dark:bg-teal-300/45"
              aria-hidden
            />
            <DashboardHeaderProfile
              variant="nav"
              className="relative border-cyan-100/[0.22] ring-teal-300/25 dark:border-cyan-100/[0.22] dark:ring-teal-300/35"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-1 sm:gap-1.5">
          {showDummyDataToggle ? <DashboardDummyDataToggle /> : null}
          {showDarkModeToggle ? (
            <DarkModeToggle className="h-11 w-11 rounded-2xl border-ink-200/90 bg-white/90 dark:border-cyan-100/[0.16] dark:bg-cyan-50/[0.10] dark:text-white dark:hover:bg-cyan-50/[0.16]" />
          ) : null}
          <DashboardDataActionsMenu
            runtimeMode={dataMode}
            canWrite={canWrite}
            powensCloudEnabled={powensCloudEnabled}
            powensPersonalSyncEnabled={powensPersonalSyncEnabled}
            powensPrimaryImportAxis={powensPrimaryImportAxis}
          />
          {showLogout ? (
            <form action="/logout" method="post" className="contents">
              <button
                type="submit"
                title="Déconnexion"
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-ink-200/90 bg-white/90 text-ink-800 transition hover:bg-white dark:border-cyan-100/[0.16] dark:bg-cyan-50/[0.10] dark:text-white dark:hover:bg-cyan-50/[0.16] sm:min-w-0"
              >
                <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                <span className="sr-only">Déconnexion</span>
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
