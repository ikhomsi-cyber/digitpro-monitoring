"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { ChevronDown, FileText, Mail, Plug, RefreshCw, Unplug } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";
import { useDashboardDisplayFormat } from "@/components/dashboard/DashboardDisplayFormatContext";
import { PremiumIconBadge } from "@/components/ui/PremiumIconBadge";
import {
  disconnectGmail,
  fetchHiwayInvoices,
  getGmailConnectUrl,
  getGmailConnectionStatus,
  type GmailConnectionStatus
} from "@/app/dashboard/gmail-actions";
import { GMAIL_RECONNECT_REQUIRED_MESSAGE } from "@/lib/gmail/oauth-grant";
import { gmailOAuthErrorMessage } from "@/lib/gmail/oauth-errors";
import { useHiwayInvoices } from "@/components/dashboard/HiwayInvoicesContext";

const HIWAY_INVOICES_PREVIEW_COUNT = 3;

function formatInvoiceDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export function HiwayInvoicesBlock() {
  const fmt = useDashboardDisplayFormat();
  const { invoices, setInvoices } = useHiwayInvoices();
  const [status, setStatus] = useState<GmailConnectionStatus | null>(null);
  const [invoicesExpanded, setInvoicesExpanded] = useState(false);
  const [reconnectSuggested, setReconnectSuggested] = useState(false);
  const [isPending, startTransition] = useTransition();

  const refreshStatus = useCallback(() => {
    startTransition(async () => {
      try {
        setStatus(await getGmailConnectionStatus());
      } catch {
        setStatus({ configured: false, connected: false, email: null });
      }
    });
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Retour du callback OAuth (/dashboard?gmail_connect=ok|error).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const result = params.get("gmail_connect");
    if (!result) return;
    if (result === "ok") {
      toast.success("Gmail connecté", { description: "Vous pouvez récupérer vos factures Hiway." });
      setReconnectSuggested(false);
    } else {
      toast.error("Connexion Gmail échouée", {
        description: gmailOAuthErrorMessage(params.get("gmail_error"))
      });
    }
    params.delete("gmail_connect");
    params.delete("gmail_error");
    const qs = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, []);

  function onConnect() {
    startTransition(async () => {
      try {
        const { url } = await getGmailConnectUrl();
        window.location.assign(url);
      } catch (e) {
        toast.error("Connexion Gmail impossible", {
          description: e instanceof Error ? e.message : undefined
        });
      }
    });
  }

  function onFetch() {
    startTransition(async () => {
      const toastId = toast.loading("Récupération des factures Hiway…");
      try {
        const { invoices: rows } = await fetchHiwayInvoices();
        setInvoices(rows);
        setInvoicesExpanded(false);
        toast.success(`${rows.length} facture${rows.length > 1 ? "s" : ""} trouvée${rows.length > 1 ? "s" : ""}`, {
          id: toastId
        });
      } catch (e) {
        const description = e instanceof Error ? e.message : undefined;
        const needsReconnect =
          description === GMAIL_RECONNECT_REQUIRED_MESSAGE ||
          /invalid_grant|expirée|révoquée/i.test(description ?? "");
        if (needsReconnect) {
          setReconnectSuggested(true);
          setStatus((prev) => (prev ? { ...prev, connected: false, email: null } : prev));
        }
        toast.error(needsReconnect ? "Reconnectez Gmail" : "Récupération impossible", {
          id: toastId,
          description: needsReconnect ? GMAIL_RECONNECT_REQUIRED_MESSAGE : description
        });
      }
    });
  }

  function onDisconnect() {
    startTransition(async () => {
      try {
        await disconnectGmail();
        setInvoices(null);
        setReconnectSuggested(false);
        setStatus((prev) => (prev ? { ...prev, connected: false, email: null } : prev));
        toast.success("Gmail déconnecté");
      } catch (e) {
        toast.error("Déconnexion impossible", {
          description: e instanceof Error ? e.message : undefined
        });
      }
    });
  }

  const eyebrow = (
    <div className="mb-3 flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
        <Mail className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
        Factures émises (Hiway)
      </span>
      {status?.connected ? (
        <button
          type="button"
          onClick={onDisconnect}
          disabled={isPending}
          className="inline-flex items-center gap-1 rounded-full border border-ink-200/70 px-2 py-1 text-[10px] font-semibold text-ink-500 transition hover:text-ink-800 disabled:opacity-50 dark:border-cyan-100/[0.14] dark:text-cyan-50/60 dark:hover:text-white"
        >
          <Unplug className="h-3 w-3" strokeWidth={2.2} aria-hidden />
          Déconnecter
        </button>
      ) : null}
    </div>
  );

  let content: React.ReactNode;
  if (status && !status.configured) {
    content = (
      <p className="text-[11px] font-medium text-amber-800 dark:text-amber-100">
        Gmail non configuré : définissez <code className="font-mono">GOOGLE_CLIENT_ID</code> et{" "}
        <code className="font-mono">GOOGLE_CLIENT_SECRET</code> dans les variables d&apos;environnement
        (Vercel en production, <code className="font-mono">.env.local</code> en local — voir{" "}
        <code className="font-mono">.env.example</code>). Le <code className="font-mono">redirect_uri</code>{" "}
        suit automatiquement le domaine ; déclarez{" "}
        <code className="font-mono">https://VOTRE-DOMAINE/api/gmail/callback</code> dans la console Google.
      </p>
    );
  } else if (status && !status.connected) {
    content = (
      <div className="space-y-3 text-center">
        <p className="text-[11px] font-medium text-ink-600 dark:text-cyan-50/70">
          {reconnectSuggested
            ? "Votre autorisation Gmail a expiré ou a été révoquée. Reconnectez votre compte pour récupérer factures Hiway et prélèvements Qonto."
            : "Connectez votre boîte Gmail pour lister vos factures "}
          {!reconnectSuggested ? (
            <>
              <span className="font-semibold">DigitPro Consulting - Facture F…</span> envoyées par{" "}
              <span className="font-mono">noreply@hiway.fr</span>.
            </>
          ) : null}
        </p>
        <button
          type="button"
          onClick={onConnect}
          disabled={isPending}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60 dark:shadow-[0_8px_24px_-14px_rgba(16,185,129,0.9)]"
        >
          <Plug className="h-4 w-4" strokeWidth={2.2} aria-hidden />
          {reconnectSuggested ? "Reconnecter Gmail" : "Connecter Gmail"}
        </button>
      </div>
    );
  } else if (status?.connected) {
    content = (
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="truncate text-[10px] font-medium text-ink-500 dark:text-cyan-50/55">
            {status.email ? `Connecté : ${status.email}` : "Compte Gmail connecté"}
          </span>
          <button
            type="button"
            onClick={onFetch}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-400/30 dark:bg-emerald-400/[0.12] dark:text-emerald-100 dark:hover:bg-emerald-400/[0.18]"
          >
            <RefreshCw className={clsx("h-3.5 w-3.5", isPending && "animate-spin")} strokeWidth={2.2} aria-hidden />
            {invoices == null ? "Récupérer mes factures" : "Actualiser"}
          </button>
        </div>

        {invoices == null ? (
          <p className="text-center text-[11px] font-medium text-ink-400 dark:text-cyan-50/45">
            Cliquez sur « Récupérer mes factures » pour interroger Gmail.
          </p>
        ) : invoices.length === 0 ? (
          <p className="text-center text-[11px] font-medium text-ink-400 dark:text-cyan-50/45">
            Aucune facture « DigitPro Consulting - Facture F… » trouvée dans cette boîte Gmail.
          </p>
        ) : (
          <>
            <ul
              className={clsx(
                "scrollbar-clean space-y-1 pr-0.5",
                invoicesExpanded && invoices.length > HIWAY_INVOICES_PREVIEW_COUNT
                  ? "max-h-64 overflow-y-auto overscroll-contain"
                  : ""
              )}
              data-private
            >
              {(invoicesExpanded ? invoices : invoices.slice(0, HIWAY_INVOICES_PREVIEW_COUNT)).map(
                (invoice) => (
                  <li
                    key={invoice.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 border-b border-ink-200/30 py-2 last:border-b-0 dark:border-white/[0.06]"
                  >
                    <PremiumIconBadge icon={FileText} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-semibold text-ink-900 dark:text-white">
                        {invoice.client ?? formatInvoiceDate(invoice.date)}
                      </span>
                      <span className="block truncate text-[9px] font-medium text-ink-400 dark:text-cyan-50/45">
                        {invoice.client ? `${formatInvoiceDate(invoice.date)} · ` : ""}
                        {invoice.billedDays != null && invoice.tjmHtEur != null
                          ? `${invoice.billedDays % 1 === 0 ? fmt.int(invoice.billedDays) : invoice.billedDays.toFixed(1).replace(".", ",")} j × ${fmt.euro(invoice.tjmHtEur)}`
                          : invoice.billedDays != null
                            ? `${fmt.int(invoice.billedDays)} j`
                            : invoice.tjmHtEur != null
                              ? `TJM ${fmt.euro(invoice.tjmHtEur)}`
                              : "jours ?"}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[12px] font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                        {invoice.amountEur != null ? fmt.euro(invoice.amountEur) : "—"}
                      </span>
                      {invoice.amountEur != null && invoice.amountKind !== "inconnu" ? (
                        <span className="block text-[9px] font-medium uppercase tracking-wide text-ink-400 dark:text-cyan-50/45">
                          {invoice.amountKind}
                        </span>
                      ) : null}
                    </span>
                  </li>
                )
              )}
            </ul>
            {invoices.length > HIWAY_INVOICES_PREVIEW_COUNT ? (
              <button
                type="button"
                onClick={() => setInvoicesExpanded((v) => !v)}
                aria-expanded={invoicesExpanded}
                className="mt-2 flex w-full items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold text-emerald-800 transition hover:opacity-80 dark:text-emerald-100"
              >
                <ChevronDown
                  className={clsx("h-3.5 w-3.5 transition-transform", invoicesExpanded && "rotate-180")}
                  strokeWidth={2.2}
                  aria-hidden
                />
                {invoicesExpanded
                  ? "Masquer les factures plus anciennes"
                  : `Afficher ${invoices.length - HIWAY_INVOICES_PREVIEW_COUNT} facture${invoices.length - HIWAY_INVOICES_PREVIEW_COUNT > 1 ? "s" : ""} de plus`}
              </button>
            ) : null}
          </>
        )}
      </div>
    );
  } else {
    content = (
      <p className="text-center text-[11px] font-medium text-ink-400 dark:text-cyan-50/45">
        Chargement…
      </p>
    );
  }

  return (
    <div className="mt-8 space-y-3">
      {eyebrow}
      {content}
    </div>
  );
}
