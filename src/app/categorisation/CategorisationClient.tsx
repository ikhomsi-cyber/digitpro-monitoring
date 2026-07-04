"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Ban,
  Check,
  CornerDownLeft,
  CreditCard,
  ReceiptText,
  RefreshCw,
  Search,
  Sparkles,
  X
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";
import { dashboardInsightCard } from "@/lib/dashboard-surfaces";
import { NDF_DIGITPRO_CATEGORY } from "@/lib/ndf-digitpro";
import { resolveNdfRejectionCategory } from "@/lib/categorisation-candidates";
import { requestCategorisationRefresh } from "@/lib/categorisation-refresh-bus";
import { PullToRefreshIndicator } from "@/components/categorisation/PullToRefreshIndicator";
import { useCategorisationRemoteRefresh } from "@/hooks/useCategorisationRemoteRefresh";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

export type CategorisationTx = {
  id: string;
  date: string;
  label: string;
  amount: number;
  company: string;
  bankName: string | null;
};

type Suggestion = {
  category: string;
  confidence: number;
  reason: string;
};

/** Catégories proposées en accès rapide sous l'action NDF principale. */
const QUICK_SECONDARY_CATEGORIES = ["Repas dirigeant", "Repas d'affaire", "Matériel", "Mobile et Internet"];

function formatEuro(amount: number, cents = true): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0
  }).format(amount);
}

function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1)
  );
}

function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(
    new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1)
  );
}

function fold(raw: string): string {
  return raw.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function cleanMerchantLabel(label: string): string {
  const cleaned = label
    .replace(/\b(cb|carte|card|cblm|paiement|payment)\b/gi, " ")
    .replace(/\b\d{2,}\/\d{2,}\/\d{2,4}\b/g, " ")
    .replace(/\b\d{3,}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || label;
}

function merchantInitial(label: string): string {
  return cleanMerchantLabel(label).slice(0, 1).toUpperCase() || "•";
}

/** Estime la catégorie probable d'un paiement carte Powens (NDF par défaut). */
function suggestCategory(tx: CategorisationTx): Suggestion {
  const source = fold(`${tx.label} ${tx.company}`);
  const has = (...needles: string[]) => needles.some((needle) => source.includes(fold(needle)));

  if (has("restaurant", "resto", "brasserie", "bistrot", "pizza", "sushi", "burger", "tacos")) {
    return { category: NDF_DIGITPRO_CATEGORY, confidence: 92, reason: "Restaurant — note de frais probable" };
  }
  if (has("cafe", "café", "boulangerie", "snack", "deli", "kebab")) {
    return { category: NDF_DIGITPRO_CATEGORY, confidence: 84, reason: "Repas / café — note de frais probable" };
  }
  if (has("monoprix", "franprix", "carrefour city", "casino")) {
    return { category: NDF_DIGITPRO_CATEGORY, confidence: 72, reason: "Achat de proximité — à vérifier" };
  }
  return { category: NDF_DIGITPRO_CATEGORY, confidence: 66, reason: "Paiement carte — note de frais estimée" };
}

function similarCount(target: CategorisationTx | null, transactions: readonly CategorisationTx[]): number {
  if (!target) return 0;
  const base = fold(cleanMerchantLabel(target.label)).split(" ")[0] ?? "";
  if (base.length < 3) return 0;
  return transactions.filter((tx) => tx.id !== target.id && fold(cleanMerchantLabel(tx.label)).includes(base)).length;
}

function resolveCategory(categories: readonly string[], preferred: string): string {
  return (
    categories.find((cat) => fold(cat) === fold(preferred)) ??
    categories.find((cat) => fold(cat).includes(fold(preferred))) ??
    preferred
  );
}

function MerchantAvatar({ label, size = "md" }: { label: string; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-14 w-14 text-2xl" : size === "sm" ? "h-10 w-10 text-base" : "h-12 w-12 text-lg";
  return (
    <div
      className={clsx(
        "grid shrink-0 place-items-center rounded-2xl bg-ink-100 font-display font-bold text-ink-700 ring-1 ring-ink-200/60 dark:bg-white/[0.08] dark:text-white/85 dark:ring-white/10",
        dim
      )}
      aria-hidden
    >
      {merchantInitial(label)}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full bg-ink-50 px-2 py-0.5 text-[10px] font-bold ring-1 ring-ink-200/70 dark:bg-white/[0.06] dark:ring-white/10",
        confidence >= 90
          ? "text-ink-800 dark:text-white/90"
          : confidence >= 75
            ? "text-ink-600 dark:text-white/70"
            : "text-ink-500 dark:text-white/50"
      )}
    >
      <Sparkles className="h-3 w-3 opacity-70" aria-hidden />
      {confidence}%
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: string;
  icon: typeof ReceiptText;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-ink-200/50 bg-white/70 px-3.5 py-3 dark:border-white/[0.08] dark:bg-white/[0.04]">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-600 dark:bg-white/[0.08] dark:text-white/70"
        aria-hidden
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500 dark:text-white/45">
          {label}
        </p>
        <p className="font-display text-lg font-bold tabular-nums text-ink-950 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function TransactionRow({
  tx,
  suggestion,
  active,
  saving,
  onSelect,
  onValidateNdf,
  onRejectNdf
}: {
  tx: CategorisationTx;
  suggestion: Suggestion;
  active: boolean;
  saving: boolean;
  onSelect: () => void;
  onValidateNdf: () => void;
  onRejectNdf: () => void;
}) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
      transition={{ duration: 0.18 }}
      onClick={onSelect}
      className={clsx(
        "group w-full min-w-0 cursor-pointer rounded-[1.35rem] border border-ink-200/50 bg-white/80 p-3 transition dark:border-white/[0.08] dark:bg-white/[0.04]",
        active
          ? "border-brand-400/50 ring-2 ring-brand-400/20 dark:border-brand-400/35 dark:ring-brand-400/15"
          : "border-ink-200/60 hover:border-ink-300/80 hover:shadow-sm dark:border-white/[0.08] dark:hover:border-white/[0.14]"
      )}
    >
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <MerchantAvatar label={tx.label} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink-950 dark:text-white">{cleanMerchantLabel(tx.label)}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-ink-500 dark:text-white/45">
            <span className="tabular-nums">{formatDateShort(tx.date)}</span>
            <span aria-hidden>·</span>
            <span className="truncate">{tx.bankName ?? tx.company ?? "Carte"}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <p className="font-display text-base font-bold tabular-nums text-ink-950 dark:text-white">
            {formatEuro(Math.abs(tx.amount))}
          </p>
          <ConfidenceBadge confidence={suggestion.confidence} />
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2 lg:hidden">
        <button
          type="button"
          disabled={saving}
          onClick={(e) => {
            e.stopPropagation();
            onValidateNdf();
          }}
          className="premium-cta inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-bold disabled:opacity-60"
        >
          <ReceiptText className="h-3.5 w-3.5" aria-hidden />
          NDF
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={(e) => {
            e.stopPropagation();
            onRejectNdf();
          }}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-ink-200 text-xs font-bold text-ink-600 transition hover:bg-ink-50 disabled:opacity-60 dark:border-white/12 dark:text-white/70 dark:hover:bg-white/[0.06]"
        >
          <Ban className="h-3.5 w-3.5" aria-hidden />
          Pas NDF
        </button>
      </div>
    </motion.article>
  );
}

function DetailPanel({
  tx,
  suggestion,
  similar,
  categories,
  saving,
  rejectCategoryLabel,
  onValidateNdf,
  onRejectNdf,
  onPick,
  onSkip
}: {
  tx: CategorisationTx | null;
  suggestion: Suggestion | null;
  similar: number;
  categories: string[];
  saving: boolean;
  rejectCategoryLabel: string;
  onValidateNdf: () => void;
  onRejectNdf: () => void;
  onPick: (category: string) => void;
  onSkip: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  if (!tx || !suggestion) {
    return (
      <aside className={clsx(dashboardInsightCard, "hidden h-fit p-6 text-center text-sm font-medium text-ink-500 dark:text-white/45 lg:block")}>
        <ReceiptText className="mx-auto mb-3 h-8 w-8 text-ink-300 dark:text-white/20" aria-hidden />
        Sélectionnez une transaction pour la traiter.
      </aside>
    );
  }
  const secondary = QUICK_SECONDARY_CATEGORIES.map((c) => resolveCategory(categories, c));
  const otherCategories = categories.filter(
    (c) => fold(c) !== fold(NDF_DIGITPRO_CATEGORY) && !secondary.some((s) => fold(s) === fold(c))
  );

  return (
    <aside className={clsx(dashboardInsightCard, "sticky top-[calc(env(safe-area-inset-top)+1.5rem)] hidden h-fit self-start p-5 lg:block")}>
      <div className="flex items-start gap-3">
        <MerchantAvatar label={tx.label} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold text-ink-950 dark:text-white">
            {cleanMerchantLabel(tx.label)}
          </p>
          <p className="mt-0.5 text-xs font-medium text-ink-500 dark:text-white/45">
            {formatDateLong(tx.date)}
          </p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-ink-950 dark:text-white">
            {formatEuro(Math.abs(tx.amount))}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-ink-200/50 bg-ink-50/50 p-3 dark:border-white/[0.08] dark:bg-white/[0.04]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-500 dark:text-white/45">
            Suggestion
          </p>
          <ConfidenceBadge confidence={suggestion.confidence} />
        </div>
        <p className="mt-1.5 text-sm font-semibold text-ink-800 dark:text-white/85">{suggestion.reason}</p>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={onValidateNdf}
        className="premium-cta mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold disabled:opacity-60"
      >
        <ReceiptText className="h-4 w-4" aria-hidden />
        Valider en NDF DigitPro
        <kbd className="ml-1 rounded border border-white/25 bg-white/15 px-1.5 py-0.5 text-[10px] font-bold text-white/90">
          N
        </kbd>
      </button>

      <button
        type="button"
        disabled={saving}
        onClick={onRejectNdf}
        className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-ink-200 bg-white text-sm font-bold text-ink-700 transition hover:border-ink-300 hover:bg-ink-50 disabled:opacity-60 dark:border-white/12 dark:bg-white/[0.03] dark:text-white/80 dark:hover:bg-white/[0.07]"
      >
        <Ban className="h-4 w-4" aria-hidden />
        Pas une NDF
        <kbd className="ml-1 rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-[10px] font-bold text-ink-500 dark:border-white/12 dark:bg-white/[0.06] dark:text-white/55">
          X
        </kbd>
      </button>
      <p className="mt-1.5 text-center text-[10px] font-medium text-ink-400 dark:text-white/40">
        Classé en {rejectCategoryLabel} — ne sera plus proposé ici.
      </p>

      {similar > 0 ? (
        <p className="mt-2 text-center text-[11px] font-medium text-ink-400 dark:text-white/40">
          {similar} transaction{similar > 1 ? "s" : ""} similaire{similar > 1 ? "s" : ""} dans la file.
        </p>
      ) : null}

      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-400 dark:text-white/40">
          Autre catégorie
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {secondary.map((category) => (
            <button
              key={category}
              type="button"
              disabled={saving}
              onClick={() => onPick(category)}
              className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 transition hover:border-ink-300 hover:bg-ink-50 disabled:opacity-60 dark:border-cyan-100/[0.12] dark:bg-white/[0.04] dark:text-white/75 dark:hover:bg-white/[0.08]"
            >
              {category}
            </button>
          ))}
          {otherCategories.length ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="rounded-full border border-dashed border-ink-300 px-3 py-1.5 text-xs font-semibold text-ink-500 transition hover:text-ink-800 dark:border-white/15 dark:text-white/55 dark:hover:text-white"
            >
              {showAll ? "Moins" : `+ ${otherCategories.length}`}
            </button>
          ) : null}
        </div>
        {showAll ? (
          <div className="scrollbar-clean mt-2 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto pr-1">
            {otherCategories.map((category) => (
              <button
                key={category}
                type="button"
                disabled={saving}
                onClick={() => onPick(category)}
                className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-600 transition hover:border-ink-300 hover:bg-ink-50 disabled:opacity-60 dark:border-cyan-100/[0.10] dark:bg-white/[0.03] dark:text-white/65 dark:hover:bg-white/[0.07]"
              >
                {category}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-ink-200 text-xs font-bold text-ink-500 transition hover:bg-ink-50 dark:border-white/10 dark:text-white/55 dark:hover:bg-white/[0.05]"
      >
        Passer
        <CornerDownLeft className="h-3.5 w-3.5" aria-hidden />
      </button>
    </aside>
  );
}

export function CategorisationClient({
  transactions: initialTransactions,
  categories,
  monthKey,
  monthLabel
}: {
  transactions: CategorisationTx[];
  categories: string[];
  monthKey: string;
  monthLabel: string;
}) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [categoryList, setCategoryList] = useState(categories);
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(initialTransactions[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [validatedCount, setValidatedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const initialTotalRef = useRef(initialTransactions.length);

  const { refreshFromApi } = useCategorisationRemoteRefresh({
    transactions,
    setTransactions,
    setCategories: setCategoryList
  });

  const { pullDistance, progress, isRefreshing, isPulling } = usePullToRefresh(
    async () => {
      await refreshFromApi({ source: "pull" });
    },
    { disabled: isPending }
  );

  const showPullIndicator = isPulling || isRefreshing;

  const suggestions = useMemo(
    () => new Map(transactions.map((tx) => [tx.id, suggestCategory(tx)])),
    [transactions]
  );

  const filtered = useMemo(() => {
    const q = fold(search.trim());
    if (!q) return transactions;
    return transactions.filter((tx) => fold(`${tx.label} ${tx.company}`).includes(q));
  }, [search, transactions]);

  const selected = filtered.find((tx) => tx.id === selectedId) ?? filtered[0] ?? null;
  const selectedSuggestion = selected ? suggestions.get(selected.id) ?? suggestCategory(selected) : null;
  const selectedIndex = selected ? filtered.findIndex((tx) => tx.id === selected.id) : -1;
  const remainingAmount = transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const selectedSimilarCount = similarCount(selected, transactions);
  const doneTotal = initialTotalRef.current;
  const processedCount = validatedCount + rejectedCount;
  const progressPct = doneTotal > 0 ? Math.round((processedCount / doneTotal) * 100) : 0;
  const selectedRejectCategory = selected
    ? resolveNdfRejectionCategory(selected, categoryList)
    : "Repas dirigeant";

  function removeTransaction(transactionId: string, onRemoved?: () => void) {
    setTransactions((prev) => {
      const idx = prev.findIndex((tx) => tx.id === transactionId);
      const next = prev.filter((tx) => tx.id !== transactionId);
      setSelectedId((current) =>
        current !== transactionId ? current : next[idx]?.id ?? next[idx - 1]?.id ?? next[0]?.id ?? ""
      );
      onRemoved?.();
      return next;
    });
  }

  function saveCategory(transactionId: string, category: string, successMessage: string, onSuccess?: () => void) {
    startTransition(async () => {
      try {
        const res = await fetch("/api/categorisation", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ transactionId, category })
        });
        const body = (await res.json().catch(() => null)) as null | { ok?: boolean; error?: string };
        if (!res.ok || !body?.ok) throw new Error(body?.error ?? "Impossible d’enregistrer");
        toast.success(successMessage);
        removeTransaction(transactionId, onSuccess);
        requestCategorisationRefresh({ source: "manual" });
      } catch (error) {
        toast.error("Impossible d’enregistrer", {
          description: error instanceof Error ? error.message : undefined
        });
      }
    });
  }

  function markNdf(tx: CategorisationTx | null) {
    if (!tx) return;
    saveCategory(tx.id, NDF_DIGITPRO_CATEGORY, "Validé en NDF DigitPro", () => setValidatedCount((c) => c + 1));
  }

  function rejectNdf(tx: CategorisationTx | null) {
    if (!tx) return;
    const category = resolveNdfRejectionCategory(tx, categoryList);
    saveCategory(tx.id, category, `Exclu de la file NDF — classé en ${category}`, () =>
      setRejectedCount((c) => c + 1)
    );
  }

  function pickCategory(tx: CategorisationTx | null, category: string) {
    if (!tx) return;
    saveCategory(tx.id, category, `Classé en ${category}`, () => setRejectedCount((c) => c + 1));
  }

  function selectNext(delta = 1) {
    if (!filtered.length) return;
    const nextIndex = selectedIndex < 0 ? 0 : Math.max(0, Math.min(filtered.length - 1, selectedIndex + delta));
    setSelectedId(filtered[nextIndex]?.id ?? "");
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      const key = event.key.toLowerCase();
      if (key === "n" || event.key === "Enter") {
        event.preventDefault();
        markNdf(selected);
      } else if (key === "x") {
        event.preventDefault();
        rejectNdf(selected);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        selectNext(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        selectNext(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!transactions.length) {
    return (
      <>
        <PullToRefreshIndicator
          visible={showPullIndicator}
          pullDistance={pullDistance}
          progress={progress}
          refreshing={isRefreshing}
        />
        <div className={clsx(dashboardInsightCard, "flex min-h-[60vh] flex-col items-center justify-center p-10 text-center")}>
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-ink-100 text-ink-600 dark:bg-white/[0.08] dark:text-white/75">
            {isRefreshing ? (
              <RefreshCw className="h-8 w-8 animate-spin" strokeWidth={2.2} aria-hidden />
            ) : (
              <Check className="h-8 w-8" strokeWidth={2.4} aria-hidden />
            )}
          </div>
          <h2 className="mt-5 font-display text-2xl font-bold text-ink-950 dark:text-white">Tout est à jour</h2>
          <p className="mt-2 max-w-sm text-sm font-medium text-ink-500 dark:text-white/50">
            {validatedCount > 0 || rejectedCount > 0
              ? `${validatedCount} NDF validée${validatedCount > 1 ? "s" : ""}${rejectedCount > 0 ? ` · ${rejectedCount} exclue${rejectedCount > 1 ? "s" : ""}` : ""}.`
              : `Aucun paiement carte en attente pour ${monthLabel.toLowerCase()}. Tirez vers le bas pour synchroniser Powens.`}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PullToRefreshIndicator
        visible={showPullIndicator}
        pullDistance={pullDistance}
        progress={progress}
        refreshing={isRefreshing}
      />
      <div className="min-h-[calc(100dvh-8rem)]">
      {/* En-tête */}
      <header className={clsx(dashboardInsightCard, "p-5 sm:p-6")}>
        <div className="flex items-start gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink-100 text-ink-600 dark:bg-white/[0.08] dark:text-white/75"
            aria-hidden
          >
            <CreditCard className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-500 dark:text-white/45">
              Notes de frais · Powens
            </p>
            <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-ink-950 dark:text-white">
              Paiements carte à valider
            </h1>
            <p className="mt-1 text-sm font-semibold capitalize text-ink-700 dark:text-white/75">
              {monthLabel}
            </p>
            <p className="mt-1 max-w-xl text-sm font-medium text-ink-500 dark:text-white/50">
              Validez en <span className="font-semibold text-ink-800 dark:text-white/85">NDF DigitPro</span> ou
              excluez avec <span className="font-semibold text-ink-700 dark:text-white/75">Pas une NDF</span> pour ne
              plus revoir le paiement ici.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-4">
          <StatCard label="À traiter" value={String(transactions.length)} icon={ReceiptText} />
          <StatCard label="Montant total" value={formatEuro(remainingAmount, false)} icon={CreditCard} />
          <StatCard label="Validées (session)" value={String(validatedCount)} icon={Check} />
          <StatCard label="Exclues (session)" value={String(rejectedCount)} icon={Ban} />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] font-semibold text-ink-500 dark:text-white/45">
            <span>{processedCount} traitées</span>
            <span>{transactions.length} restantes</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-200/60 dark:bg-white/[0.08]">
            <motion.div
              className="h-full rounded-full bg-brand-500 dark:bg-brand-400"
              initial={false}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </header>

      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* File */}
        <section className="min-w-0 space-y-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 dark:text-white/35" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un commerçant…"
              className="h-11 w-full rounded-2xl border border-ink-200/60 bg-white pl-10 pr-9 text-sm font-semibold text-ink-900 outline-none transition placeholder:font-medium placeholder:text-ink-400 focus:border-brand-400/50 focus:ring-2 focus:ring-brand-400/15 dark:border-white/[0.10] dark:bg-[#0b3038] dark:text-white dark:placeholder:text-white/30"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 transition hover:text-ink-700 dark:text-white/35 dark:hover:text-white"
                aria-label="Effacer la recherche"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-[1.35rem] border border-ink-200/50 bg-white/70 p-8 text-center text-sm font-medium text-ink-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/45">
              Aucune transaction ne correspond à « {search} ».
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filtered.map((tx) => {
                const suggestion = suggestions.get(tx.id) ?? suggestCategory(tx);
                return (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    suggestion={suggestion}
                    active={selected?.id === tx.id}
                    saving={isPending}
                    onSelect={() => setSelectedId(tx.id)}
                    onValidateNdf={() => markNdf(tx)}
                    onRejectNdf={() => rejectNdf(tx)}
                  />
                );
              })}
            </AnimatePresence>
          )}
        </section>

        <DetailPanel
          tx={selected}
          suggestion={selectedSuggestion}
          similar={selectedSimilarCount}
          categories={categoryList}
          saving={isPending}
          rejectCategoryLabel={selectedRejectCategory}
          onValidateNdf={() => markNdf(selected)}
          onRejectNdf={() => rejectNdf(selected)}
          onPick={(category) => pickCategory(selected, category)}
          onSkip={() => selectNext(1)}
        />
      </div>

      {/* Barre de raccourcis (desktop) */}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 hidden -translate-x-1/2 items-center gap-3 rounded-full border border-ink-200/60 bg-white/90 px-4 py-2 text-[11px] font-semibold text-ink-500 shadow-lg backdrop-blur-xl dark:border-white/[0.10] dark:bg-[#0b3038]/90 dark:text-white/55 lg:flex">
        <span className="inline-flex items-center gap-1">
          <ReceiptText className="h-3.5 w-3.5 opacity-70" aria-hidden />
          <kbd>N</kbd> NDF
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd>X</kbd> pas NDF
        </span>
        <span className="inline-flex items-center gap-1">
          <ArrowUp className="h-3 w-3" aria-hidden />
          <ArrowDown className="h-3 w-3" aria-hidden /> naviguer
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd>Entrée</kbd> valider
        </span>
      </div>
      </div>
    </>
  );
}
