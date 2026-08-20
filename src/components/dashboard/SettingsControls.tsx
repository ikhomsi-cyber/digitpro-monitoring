"use client";

import { LogOut, Moon, Palette, Database, ShieldCheck } from "lucide-react";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { DashboardDataActionsMenu } from "@/components/dashboard/DashboardDataActionsMenu";
import { DashboardDummyDataToggle } from "@/components/dashboard/DashboardDummyDataToggle";
import { useDashboardDummyData } from "@/components/dashboard/DashboardDisplayFormatContext";
import { DashboardHeaderProfile } from "@/components/dashboard/DashboardHeaderProfile";
import { MobilePasskeySettings } from "@/components/MobilePasskeySettings";
import { AppColorThemePicker } from "@/components/AppColorThemePicker";
import type { SupabaseRuntimeMode } from "@/lib/supabase/config";

type Props = {
  envMode: SupabaseRuntimeMode;
  dataMode: "DEMO" | "SUPABASE";
  demoPreferenceOn: boolean;
  showDummyDataToggle: boolean;
  showDarkModeToggle: boolean;
  showLogout: boolean;
  userEmail: string | null | undefined;
  canWrite: boolean;
  powensCloudEnabled?: boolean;
  powensPersonalSyncEnabled?: boolean;
  powensPrimaryImportAxis?: "pro" | "personal";
};

const cardClassName =
  "rounded-3xl border border-ink-200 bg-white p-5 shadow-[0_14px_54px_-28px_rgba(0,0,0,0.2)] dark:border-white/[0.08] dark:bg-white/[0.04]";

const rowClassName =
  "flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0 border-b border-ink-100 last:border-b-0 dark:border-white/[0.06]";

export function SettingsControls({
  envMode,
  dataMode,
  demoPreferenceOn,
  showDummyDataToggle,
  showDarkModeToggle,
  showLogout,
  userEmail,
  canWrite,
  powensCloudEnabled = false,
  powensPersonalSyncEnabled = false,
  powensPrimaryImportAxis = "pro"
}: Props) {
  const dummyDataActive = useDashboardDummyData();
  const statusLabel =
    envMode === "DEMO"
      ? "Mode démo"
      : dummyDataActive
        ? "Données fictives (affichage)"
        : demoPreferenceOn
          ? "Mode démo activé"
          : userEmail
            ? "Connecté"
            : "Connecté";
  const statusDotClass =
    dataMode === "DEMO" ? "bg-amber-400" : dummyDataActive ? "bg-sky-400" : "bg-emerald-400";

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Compte */}
      <section className={cardClassName}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500 dark:text-white/45">
          Compte
        </p>
        <div className="mt-4 flex items-center gap-4">
          <DashboardHeaderProfile variant="nav" />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold text-ink-950 dark:text-white">
              {userEmail ?? "Iliass KHOMSI"}
            </p>
            <span className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-500 dark:text-white/50">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass}`} aria-hidden />
              {statusLabel}
            </span>
          </div>
        </div>
        {showLogout ? (
          <form action="/logout" method="post" className="mt-5">
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-ink-200/90 bg-white px-4 text-sm font-semibold text-ink-800 transition hover:bg-ink-50 dark:border-cyan-100/[0.16] dark:bg-cyan-50/[0.08] dark:text-white dark:hover:bg-cyan-50/[0.16]"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
              Déconnexion
            </button>
          </form>
        ) : null}
      </section>

      {envMode === "SUPABASE" && userEmail ? <MobilePasskeySettings /> : null}

      {/* Préférences d’affichage */}
      <section className={cardClassName}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500 dark:text-white/45">
          Affichage
        </p>
        <div className="mt-2">
          {showDarkModeToggle ? (
            <div className={rowClassName}>
              <span className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-100 text-ink-600 dark:bg-white/[0.06] dark:text-white/70">
                  <Moon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink-900 dark:text-white">Thème sombre</span>
                  <span className="block text-xs text-ink-500 dark:text-white/45">Basculer clair / sombre</span>
                </span>
              </span>
              <DarkModeToggle className="h-11 w-11" />
            </div>
          ) : null}
          {showDummyDataToggle ? (
            <div className={rowClassName}>
              <span className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-100 text-ink-600 dark:bg-white/[0.06] dark:text-white/70">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink-900 dark:text-white">Données fictives</span>
                  <span className="block text-xs text-ink-500 dark:text-white/45">Masquer les montants réels à l’écran</span>
                </span>
              </span>
              <DashboardDummyDataToggle />
            </div>
          ) : null}
          <AppColorThemePicker />
        </div>
      </section>

      {/* Données & synchronisation */}
      <section className={cardClassName}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500 dark:text-white/45">
          Données &amp; synchronisation
        </p>
        <div className="mt-2">
          <div className={rowClassName}>
            <span className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-100 text-ink-600 dark:bg-white/[0.06] dark:text-white/70">
                <Database className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink-900 dark:text-white">Import &amp; synchronisation</span>
                <span className="block text-xs text-ink-500 dark:text-white/45">Powens, Qonto, Bankin…</span>
              </span>
            </span>
            <DashboardDataActionsMenu
              runtimeMode={dataMode}
              canWrite={canWrite}
              powensCloudEnabled={powensCloudEnabled}
              powensPersonalSyncEnabled={powensPersonalSyncEnabled}
              powensPrimaryImportAxis={powensPrimaryImportAxis}
            />
          </div>
        </div>
      </section>

      {/* Apparence / info */}
      <section className={cardClassName}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500 dark:text-white/45">
          Application
        </p>
        <div className="mt-4 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/15 dark:text-emerald-300">
            <Palette className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-display text-base font-bold text-ink-950 dark:text-white">DigitPro Monitoring</p>
            <p className="text-xs text-ink-500 dark:text-white/45">Conçu par Iliass KHOMSI</p>
          </div>
        </div>
      </section>
    </div>
  );
}
