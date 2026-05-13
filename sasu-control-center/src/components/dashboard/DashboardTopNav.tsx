"use client";

import { Bell, LogOut, Settings2 } from "lucide-react";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { DashboardHeaderProfile } from "@/components/dashboard/DashboardHeaderProfile";
import { Logo } from "@/components/ui/Logo";
import type { SupabaseRuntimeMode } from "@/lib/supabase/config";

type Props = {
  envMode: SupabaseRuntimeMode;
  dataMode: "DEMO" | "SUPABASE";
  demoPreferenceOn: boolean;
  userEmail: string | null | undefined;
  showDarkModeToggle: boolean;
  showLogout: boolean;
};

export function DashboardTopNav({
  envMode,
  dataMode,
  demoPreferenceOn,
  userEmail,
  showDarkModeToggle,
  showLogout
}: Props) {
  const statusLabel =
    envMode === "DEMO"
      ? "Mode démo"
      : demoPreferenceOn
        ? "Mode démo activé"
        : userEmail
          ? `Connecté · ${userEmail}`
          : "Connecté";

  return (
    <nav
      className="sticky top-[env(safe-area-inset-top)] z-40 mx-auto mt-2 max-w-6xl rounded-2xl border border-ink-200/80 bg-white/80 px-3 py-2.5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-black/45 dark:shadow-[0_12px_48px_-8px_rgba(0,0,0,0.65)] sm:px-4 sm:py-3"
      aria-label="DigitPro — navigation principale"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Logo withWordmark={false} size={36} className="shrink-0" />
          <div className="min-w-0">
            <div className="truncate font-display text-[15px] font-semibold leading-none tracking-tight text-ink-900 dark:text-white sm:text-[17px]">
              DigitPro
            </div>
            <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.18em] text-ink-500 dark:text-white/45 sm:text-[11px]">
              Monitoring
            </div>
          </div>
          <span className="ml-1 hidden min-w-0 items-center gap-1.5 rounded-full border border-ink-200/90 bg-ink-50/90 px-2.5 py-1 text-[11px] font-medium text-ink-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70 lg:inline-flex">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                dataMode === "DEMO" ? "bg-amber-400" : "bg-emerald-400"
              }`}
            />
            <span className="max-w-[14rem] truncate">{statusLabel}</span>
          </span>
        </div>

        <div className="flex justify-center">
          <div className="relative">
            <span
              className="pointer-events-none absolute -inset-1 rounded-full bg-emerald-400/25 blur-lg dark:bg-emerald-400/35"
              aria-hidden
            />
            <DashboardHeaderProfile
              variant="nav"
              className="relative border-emerald-500/25 ring-emerald-500/20 dark:border-emerald-400/30 dark:ring-emerald-400/25"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-1 sm:gap-1.5">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-ink-200/90 bg-white/90 text-ink-700 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
            aria-label="Notifications (bientôt)"
            title="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
          </button>
          {showDarkModeToggle ? (
            <DarkModeToggle className="h-10 w-10 rounded-xl border-ink-200/90 bg-white/90 dark:border-white/10 dark:bg-white/5 dark:text-white" />
          ) : null}
          <button
            type="button"
            className="hidden h-10 w-10 items-center justify-center rounded-xl border border-ink-200/90 bg-white/90 text-ink-700 transition hover:bg-white sm:inline-flex dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
            aria-label="Réglages (bientôt)"
            title="Réglages"
          >
            <Settings2 className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
          </button>
          {showLogout ? (
            <form action="/logout" method="post" className="contents">
              <button
                type="submit"
                title="Déconnexion"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-ink-200/90 bg-white/90 text-ink-800 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 sm:h-10 sm:min-w-0"
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
