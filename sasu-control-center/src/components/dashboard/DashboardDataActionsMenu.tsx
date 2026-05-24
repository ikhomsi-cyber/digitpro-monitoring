"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { CloudDownload, Landmark, Settings2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  importBankinPersonalXlsx,
  preparePowensConnectSession,
  resetPowensConnectSession,
  safeGetPowensWebviewConnectUrl,
  safeSyncPowensCloudTransactions,
  safeSyncPowensCloudTransactionsPersonal,
  syncQontoTransactionsFromApi
} from "@/app/dashboard/actions";
import { openPowensConnectWidget } from "@/lib/powens/connect-widget";
import type { SupabaseRuntimeMode } from "@/lib/supabase/config";

type Props = {
  runtimeMode: SupabaseRuntimeMode;
  canWrite: boolean;
  powensCloudEnabled?: boolean;
  powensPersonalSyncEnabled?: boolean;
  powensPrimaryImportAxis?: "pro" | "personal";
};

export function DashboardDataActionsMenu({
  runtimeMode,
  canWrite,
  powensCloudEnabled = false,
  powensPersonalSyncEnabled = false,
  powensPrimaryImportAxis = "pro"
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const bankinFileInputRef = useRef<HTMLInputElement>(null);

  const powensPrimarySyncLabel =
    powensPrimaryImportAxis === "personal" ? "Synchroniser Powens perso" : "Synchroniser Powens SASU";
  const powensPrimarySyncTitle =
    powensPrimaryImportAxis === "personal"
      ? "Import principal en perso."
      : "Import principal en SASU.";

  function ensureActionAllowed(kind: "Powens" | "Bankin" | "Qonto") {
    if (runtimeMode === "DEMO") {
      toast.warning(`${kind} indisponible en mode démo.`);
      return false;
    }
    if (!canWrite) {
      toast.warning("Action désactivée", { description: "Aucune base n’est connectée." });
      return false;
    }
    return true;
  }

  function onClickPowensConnect(opts?: { reset?: boolean }) {
    if (!ensureActionAllowed("Powens")) return;
    const toastId = toast.loading("Préparation Powens…");
    setOpen(false);
    startTransition(async () => {
      try {
        const session = opts?.reset
          ? await resetPowensConnectSession()
          : await preparePowensConnectSession();
        const webviewResult = await safeGetPowensWebviewConnectUrl();
        if (webviewResult.ok) {
          const tabPref = process.env.NEXT_PUBLIC_POWENS_WEBVIEW_NEW_TAB?.trim().toLowerCase();
          const preferNewTab = tabPref === "true" || tabPref === "1";

          if (preferNewTab) {
            const w = window.open(webviewResult.url, "_blank", "noopener,noreferrer");
            toast.dismiss(toastId);
            if (w) {
              toast.success("Connexion bancaire Powens", {
                description: "Un nouvel onglet s’est ouvert. Revenez ici après la liaison."
              });
            } else {
              toast.message("Pop-up bloquée", {
                description: "Autorisez les fenêtres pour ce site ou ouvrez Powens dans cet onglet."
              });
            }
          } else {
            toast.dismiss(toastId);
            window.location.assign(webviewResult.url);
          }
        } else {
          const opened = await openPowensConnectWidget({
            userId: session.userId,
            token: session.token
          });
          if (opened.ok) {
            toast.success("Widget Powens", {
              id: toastId,
              description: "Si la fenêtre ne s’affiche pas, vérifiez le bloqueur de pop-ups."
            });
          } else {
            toast.message("Compte Powens prêt", {
              id: toastId,
              description: `${webviewResult.error} · ${opened.message}`
            });
          }
        }
      } catch (e) {
        toast.error("Powens — préparation échouée", {
          id: toastId,
          description: e instanceof Error ? e.message : undefined
        });
      }
    });
  }

  function onClickSyncQontoApi() {
    if (!ensureActionAllowed("Qonto")) return;
    const toastId = toast.loading("Synchronisation Qonto (API) en cours...");
    setOpen(false);
    startTransition(async () => {
      try {
        const result = await syncQontoTransactionsFromApi();
        toast.success("Qonto synchronisé", {
          id: toastId,
          description: `${result.inserted} nouvelle(s) · ${result.merged} fusion(s) · ${result.totalFromApi} ligne(s) API`
        });
        router.refresh();
      } catch (e) {
        toast.error("Synchronisation Qonto échouée", {
          id: toastId,
          description: e instanceof Error ? e.message : undefined
        });
      }
    });
  }

  function onClickSyncPowensApi() {
    if (!ensureActionAllowed("Powens")) return;
    const toastId = toast.loading("Synchronisation Powens en cours…");
    setOpen(false);
    startTransition(async () => {
      const result = await safeSyncPowensCloudTransactions();
      if (!result.ok) {
        toast.error("Synchronisation Powens échouée", {
          id: toastId,
          description: result.error,
          action: result.noAccount
            ? {
                label: "Nouvelle connexion",
                onClick: () => onClickPowensConnect({ reset: true })
              }
            : undefined
        });
        return;
      }
      toast.success("Powens synchronisé", {
        id: toastId,
        description: `${result.inserted} nouvelle(s) · ${result.merged} fusion(s) · ${result.totalFromApi} ligne(s) API`
      });
      router.refresh();
    });
  }

  function onClickSyncPowensPersonalApi() {
    if (!ensureActionAllowed("Powens")) return;
    const toastId = toast.loading("Synchronisation Powens perso…");
    setOpen(false);
    startTransition(async () => {
      const result = await safeSyncPowensCloudTransactionsPersonal();
      if (!result.ok) {
        toast.error("Synchronisation Powens perso échouée", {
          id: toastId,
          description: result.error,
          action: result.noAccount
            ? {
                label: "Nouvelle connexion",
                onClick: () => onClickPowensConnect({ reset: true })
              }
            : undefined
        });
        return;
      }
      toast.success("Powens perso synchronisé", {
        id: toastId,
        description: `${result.inserted} nouvelle(s) · ${result.merged} fusion(s) · ${result.totalFromApi} ligne(s) API`
      });
      router.refresh();
    });
  }

  function onBankinFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !ensureActionAllowed("Bankin")) return;
    const toastId = toast.loading("Import Bankin en cours…");
    setOpen(false);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const result = await importBankinPersonalXlsx(fd);
        if (result.fileAlreadyImported) {
          toast.info("Ce fichier a déjà été importé", { id: toastId });
          router.refresh();
          return;
        }
        toast.success("Import Bankin terminé", {
          id: toastId,
          description: `${result.inserted.length} nouvelle(s) · ${result.merged} mise(s) à jour · ${result.skippedInFile} doublon(s)`
        });
        router.refresh();
      } catch (err) {
        toast.error("Import Bankin échoué", {
          id: toastId,
          description: err instanceof Error ? err.message : undefined
        });
      }
    });
  }

  return (
    <div className="relative">
      <input
        ref={bankinFileInputRef}
        type="file"
        accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={onBankinFileSelected}
      />
      <button
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-ink-200/90 bg-white/90 text-ink-700 transition hover:bg-white dark:border-cyan-100/[0.16] dark:bg-cyan-50/[0.10] dark:text-white dark:hover:bg-cyan-50/[0.16]"
        aria-label="Réglages et imports"
        aria-expanded={open}
        title="Réglages et imports"
        onClick={() => setOpen((v) => !v)}
      >
        <Settings2 className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-ink-200/90 bg-white/95 p-2 text-sm shadow-[0_24px_80px_-24px_rgba(0,0,0,0.35)] backdrop-blur-xl dark:border-cyan-100/[0.10] dark:bg-[#0b3038]/95">
          <Link
            href="/parametres"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium text-ink-800 transition hover:bg-ink-50 dark:text-white/85 dark:hover:bg-cyan-50/[0.08]"
            onClick={() => setOpen(false)}
          >
            <Settings2 className="h-4 w-4 text-ink-500 dark:text-white/45" aria-hidden />
            Paramètres
          </Link>
          <div className="my-1 h-px bg-ink-200/80 dark:bg-white/10" />
          <MenuButton
            icon={CloudDownload}
            label="Synchroniser Qonto (API)"
            disabled={isPending}
            onClick={onClickSyncQontoApi}
          />
          {powensCloudEnabled ? (
            <>
              <MenuButton
                icon={Landmark}
                label="Connecter Powens"
                disabled={isPending}
                onClick={() => onClickPowensConnect()}
              />
              <MenuButton
                icon={CloudDownload}
                label={powensPrimarySyncLabel}
                title={powensPrimarySyncTitle}
                disabled={isPending}
                onClick={onClickSyncPowensApi}
              />
              {powensPersonalSyncEnabled ? (
                <MenuButton
                  icon={CloudDownload}
                  label="Import Powens perso"
                  disabled={isPending}
                  onClick={onClickSyncPowensPersonalApi}
                />
              ) : null}
            </>
          ) : (
            <p className="px-3 py-2 text-xs leading-relaxed text-ink-500 dark:text-white/45">
              Powens n’est pas configuré sur cet environnement.
            </p>
          )}
          <MenuButton
            icon={Upload}
            label="Importer Bankin (.xls)"
            disabled={isPending}
            onClick={() => bankinFileInputRef.current?.click()}
          />
        </div>
      ) : null}
    </div>
  );
}

function MenuButton({
  icon: Icon,
  label,
  title,
  disabled,
  onClick
}: {
  icon: typeof Settings2;
  label: string;
  title?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-medium text-ink-800 transition hover:bg-ink-50 disabled:opacity-50 dark:text-white/85 dark:hover:bg-cyan-50/[0.08]"
      onClick={onClick}
    >
      <Icon className="h-4 w-4 text-ink-500 dark:text-white/45" aria-hidden />
      <span>{label}</span>
    </button>
  );
}
