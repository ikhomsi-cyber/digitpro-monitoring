"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CornerDownLeft,
  CreditCard,
  ReceiptText,
  Search,
  Sparkles,
  Utensils,
  X
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";
import { NDF_DIGITPRO_CATEGORY } from "@/lib/ndf-digitpro";

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
        "grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-50 font-display font-bold text-emerald-700 ring-1 ring-emerald-200/70 dark:from-emerald-400/15 dark:to-teal-400/5 dark:text-emerald-200 dark:ring-emerald-300/15",
        dim
      )}
      aria-hidden
    >
      {merchantInitial(label)}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const tone =
    confidence >= 90
      ? "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:bg-emerald-400/12 dark:text-emerald-200 dark:ring-emerald-300/20"
      : confidence >= 75
        ? "bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:bg-amber-300/10 dark:text-amber-100 dark:ring-amber-200/20"
        : "bg-ink-500/10 text-ink-600 ring-ink-500/20 dark:bg-white/8 dark:text-white/70 dark:ring-white/12";
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1", tone)}>
      <Sparkles className="h-3 w-3" aria-hidden />
      {confidence}%
    </span>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
  icon: Icon
}: {
  label: string;
  value: string;
  tone?: "neutral" | "emerald" | "sky";
  icon: typeof ReceiptText;
}) {
  return (
    <div
      className={clsx(
        "flex items-center gap-3 rounded-2xl border px-3.5 py-3",
        tone === "emerald"
          ? "border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-400/15 dark:bg-emerald-400/[0.07]"
          : tone === "sky"
            ? "border-sky-200/80 bg-sky-50/70 dark:border-sky-400/15 dark:bg-sky-400/[0.07]"
            : "border-ink-200/80 bg-white/70 dark:border-cyan-100/[0.10] dark:bg-white/[0.04]"
      )}
    >
      <span
        className={clsx(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
          tone === "emerald"
            ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-200"
            : tone === "sky"
              ? "bg-sky-500/12 text-sky-700 dark:text-sky-200"
              : "bg-ink-500/10 text-ink-600 dark:bg-white/10 dark:text-white/70"
        )}
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
  onValidateNdf
}: {
  tx: CategorisationTx;
  suggestion: Suggestion;
  active: boolean;
  saving: boolean;
  onSelect: () => void;
  onValidateNdf: () => void;
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
        "group w-full min-w-0 cursor-pointer rounded-[1.35rem] border bg-white p-3 transition dark:bg-[#0b3038]",
        active
          ? "border-emerald-400/60 ring-2 ring-emerald-400/25 dark:border-emerald-300/40 dark:ring-emerald-300/15"
          : "border-ink-200/80 hover:border-ink-300 hover:shadow-sm dark:border-cyan-100/[0.10] dark:hover:border-cyan-100/[0.2]"
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
      <button
        type="button"
        disabled={saving}
        onClick={(e) => {
          e.stopPropagation();
          onValidateNdf();
        }}
        className="mt-2.5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-400 lg:hidden"
      >
        <ReceiptText className="h-4 w-4" aria-hidden />
        Valider NDF DigitPro
      </button>
    </motion.article>
  );
}

function DetailPanel({
  tx,
  suggestion,
  similar,
  categories,
  saving,
  onValidateNdf,
  onPick,
  onSkip
}: {
  tx: CategorisationTx | null;
  suggestion: Suggestion | null;
  similar: number;
  categories: string[];
  saving: boolean;
  onValidateNdf: () => void;
  onPick: (category: string) => void;
  onSkip: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  if (!tx || !suggestion) {
    return (
      <aside className="hidden h-fit rounded-[1.75rem] border border-ink-200/80 bg-white/70 p-6 text-center text-sm font-medium text-ink-500 dark:border-cyan-100/[0.10] dark:bg-[#0b3038] dark:text-white/45 lg:block">
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
    <aside className="sticky top-[calc(env(safe-area-inset-top)+1.5rem)] hidden h-fit self-start rounded-[1.75rem] border border-ink-200/80 bg-white p-5 shadow-sm dark:border-cyan-100/[0.12] dark:bg-[#0b3038] dark:shadow-[0_24px_80px_-28px_rgba(0,22,28,0.72),inset_0_1px_0_rgba(255,255,255,0.08)] lg:block">
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

      <div className="mt-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-3 dark:border-emerald-400/15 dark:bg-emerald-400/[0.07]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-800/80 dark:text-emerald-200/80">
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
        className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 text-sm font-bold text-white shadow-[0_12px_30px_-14px_rgba(16,185,129,0.8)] transition hover:bg-emerald-500 disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-400"
      >
        <ReceiptText className="h-4 w-4" aria-hidden />
        Valider en NDF DigitPro
        <kbd className="ml-1 border-white/30 bg-white/20 text-white">N</kbd>
      </button>

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
  categories
}: {
  transactions: CategorisationTx[];
  categories: string[];
}) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(initialTransactions[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [validatedCount, setValidatedCount] = useState(0);
  const initialTotalRef = useRef(initialTransactions.length);

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
  const progressPct = doneTotal > 0 ? Math.round((validatedCount / doneTotal) * 100) : 0;

  function saveCategory(transactionId: string, category: string, successMessage: string) {
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
        setValidatedCount((c) => c + 1);
        setTransactions((prev) => {
          const idx = prev.findIndex((tx) => tx.id === transactionId);
          const next = prev.filter((tx) => tx.id !== transactionId);
          setSelectedId((current) =>
            current !== transactionId ? current : next[idx]?.id ?? next[idx - 1]?.id ?? next[0]?.id ?? ""
          );
          return next;
        });
      } catch (error) {
        toast.error("Impossible d’enregistrer", {
          description: error instanceof Error ? error.message : undefined
        });
      }
    });
  }

  function markNdf(tx: CategorisationTx | null) {
    if (!tx) return;
    saveCategory(tx.id, NDF_DIGITPRO_CATEGORY, "Validé en NDF DigitPro");
  }

  function pickCategory(tx: CategorisationTx | null, category: string) {
    if (!tx) return;
    saveCategory(tx.id, category, `Classé en ${category}`);
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
      <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-[2rem] border border-emerald-200/70 bg-gradient-to-b from-emerald-50/70 to-white p-10 text-center dark:border-emerald-400/15 dark:from-emerald-400/[0.06] dark:to-[#0b3038]">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
          <Check className="h-8 w-8" strokeWidth={2.4} aria-hidden />
        </div>
        <h2 className="mt-5 font-display text-2xl font-bold text-ink-950 dark:text-white">Tout est à jour</h2>
        <p className="mt-2 max-w-sm text-sm font-medium text-ink-500 dark:text-white/50">
          {validatedCount > 0
            ? `${validatedCount} note${validatedCount > 1 ? "s" : ""} de frais validée${validatedCount > 1 ? "s" : ""}. Elles apparaissent maintenant dans Repas & NDF du mois concerné.`
            : "Aucun paiement carte Powens en attente de catégorisation."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-8rem)]">
      {/* En-tête */}
      <header className="rounded-[2rem] border border-ink-200/80 bg-gradient-to-br from-white via-white to-emerald-50/40 p-5 shadow-sm dark:border-cyan-100/[0.12] dark:bg-[#0b3038] dark:bg-none dark:shadow-[0_24px_80px_-28px_rgba(0,22,28,0.72),inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-6">
        <div className="flex items-start gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-200"
            aria-hidden
          >
            <CreditCard className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700/80 dark:text-emerald-300/80">
              Notes de frais · Powens
            </p>
            <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-ink-950 dark:text-white">
              Paiements carte à valider
            </h1>
            <p className="mt-1 max-w-xl text-sm font-medium text-ink-500 dark:text-white/50">
              Ces paiements carte importés depuis Powens sont estimés comme des notes de frais. Validez-les en{" "}
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">NDF DigitPro</span> pour les
              retrouver dans « Repas &amp; NDF ».
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          <StatCard label="À traiter" value={String(transactions.length)} icon={ReceiptText} tone="emerald" />
          <StatCard label="Montant total" value={formatEuro(remainingAmount, false)} icon={CreditCard} />
          <StatCard label="Validées (session)" value={String(validatedCount)} icon={Check} tone="sky" />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] font-semibold text-ink-500 dark:text-white/45">
            <span>{validatedCount} validées</span>
            <span>{transactions.length} restantes</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-white/[0.06]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
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
              className="h-11 w-full rounded-2xl border border-ink-200/80 bg-white pl-10 pr-9 text-sm font-semibold text-ink-900 outline-none transition placeholder:font-medium placeholder:text-ink-400 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/15 dark:border-cyan-100/[0.10] dark:bg-[#0b3038] dark:text-white dark:placeholder:text-white/30"
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
            <div className="rounded-[1.35rem] border border-ink-200/80 bg-white/70 p-8 text-center text-sm font-medium text-ink-500 dark:border-cyan-100/[0.10] dark:bg-[#0b3038] dark:text-white/45">
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
          categories={categories}
          saving={isPending}
          onValidateNdf={() => markNdf(selected)}
          onPick={(category) => pickCategory(selected, category)}
          onSkip={() => selectNext(1)}
        />
      </div>

      {/* Barre de raccourcis (desktop) */}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 hidden -translate-x-1/2 items-center gap-3 rounded-full border border-ink-200/80 bg-white/90 px-4 py-2 text-[11px] font-semibold text-ink-500 shadow-lg backdrop-blur-xl dark:border-cyan-100/[0.12] dark:bg-[#0b3038]/90 dark:text-white/55 lg:flex">
        <span className="inline-flex items-center gap-1">
          <Utensils className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" aria-hidden />
          <kbd>N</kbd> NDF
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
  );
}
