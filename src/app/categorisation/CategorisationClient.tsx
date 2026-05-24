"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Clock3,
  Filter,
  History,
  Keyboard,
  Layers3,
  Search,
  Sparkles,
  Wand2
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";

export type CategorisationTx = {
  id: string;
  date: string;
  label: string;
  amount: number;
  company: string;
  bankName: string | null;
};

type SuggestionTone = "strong" | "medium" | "low";

type Suggestion = {
  category: string;
  confidence: number;
  reason: string;
  icon: string;
};

const FILTERS = ["Toutes", "Non traitées", "Suggestion forte", "SASU", "Perso", "NDF", "Repas", "Immobilier"] as const;
const DATE_FILTERS = ["Aujourd’hui", "7 jours", "30 jours"] as const;

function formatEuro(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(
    new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1)
  );
}

function fold(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
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

function suggestCategory(tx: CategorisationTx, categories: readonly string[]): Suggestion {
  const source = fold(`${tx.label} ${tx.company}`);
  const has = (...needles: string[]) => needles.some((needle) => source.includes(fold(needle)));
  const resolve = (preferred: string) =>
    categories.find((cat) => fold(cat) === fold(preferred)) ??
    categories.find((cat) => fold(cat).includes(fold(preferred))) ??
    preferred;
  const ndfDigitPro = resolve("NDF DigitPro");

  if (has("zara")) return { category: resolve("Vêtements"), confidence: 92, reason: "Vêtement probable", icon: "👕" };
  if (has("quick", "domino", "tacos")) {
    return { category: resolve("Repas dirigeant"), confidence: 96, reason: "Repas probable", icon: "🍔" };
  }
  if (has("boucherie", "boucheries", "auchan", "grand frais", "carrefour")) {
    return { category: resolve("Alimentation"), confidence: 88, reason: "Alimentation probable", icon: "🥩" };
  }
  if (has("bankin")) {
    return { category: resolve("Virement interne"), confidence: 96, reason: "Virement interne probable", icon: "🏦" };
  }
  if (has("decla")) return { category: resolve("Administratif"), confidence: 82, reason: "Administratif", icon: "🏦" };
  if (has("repas", "restaurant", "brasserie", "cafe")) {
    return { category: resolve("Repas dirigeant"), confidence: 82, reason: "Repas possible", icon: "🍽️" };
  }
  return {
    category: ndfDigitPro,
    confidence: 65,
    reason: "Suggestion prudente",
    icon: merchantInitial(tx.label)
  };
}

function confidenceTone(confidence: number): SuggestionTone {
  if (confidence >= 90) return "strong";
  if (confidence >= 75) return "medium";
  return "low";
}

function toneClasses(tone: SuggestionTone) {
  if (tone === "strong") {
    return "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-400/12 dark:text-emerald-200 dark:ring-emerald-300/18";
  }
  if (tone === "medium") {
    return "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:bg-amber-300/10 dark:text-amber-100 dark:ring-amber-200/15";
  }
  return "bg-zinc-500/10 text-zinc-600 ring-zinc-500/20 dark:bg-white/8 dark:text-zinc-200 dark:ring-white/10";
}

function similarCount(target: CategorisationTx | null, transactions: readonly CategorisationTx[]): number {
  if (!target) return 0;
  const base = fold(cleanMerchantLabel(target.label)).split(" ")[0] ?? "";
  if (base.length < 3) return 0;
  return transactions.filter((tx) => tx.id !== target.id && fold(cleanMerchantLabel(tx.label)).includes(base)).length;
}

function ProgressHeader({
  total,
  amount,
  selected,
  compact,
  onCompactChange
}: {
  total: number;
  amount: number;
  selected: CategorisationTx | null;
  compact: boolean;
  onCompactChange: () => void;
}) {
  const classifiedToday = 32;
  const remaining = total;
  const pct = total > 0 ? Math.min(100, Math.round((classifiedToday / (classifiedToday + total)) * 100)) : 100;
  return (
    <header className="sticky top-[calc(env(safe-area-inset-top)+4.75rem)] z-30 rounded-[1.75rem] border border-ink-200/80 bg-white/85 p-4 shadow-[0_18px_60px_-34px_rgba(0,0,0,0.35)] backdrop-blur-2xl dark:border-white/[0.08] dark:bg-[#171A22]/85 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700/80 dark:text-emerald-300/80">
            Inbox intelligent
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink-950 dark:text-white">
            Transactions à catégoriser
          </h1>
          <p className="mt-1 text-sm font-medium text-ink-500 dark:text-white/45">
            {total} opérations • {formatEuro(amount)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QuickAction icon={Wand2} label="Auto-classer" />
          <QuickAction icon={Filter} label="Filtres" />
          <QuickAction icon={History} label="Historique" />
          <QuickAction icon={Layers3} label="Vue compacte" active={compact} onClick={onCompactChange} />
          <QuickAction icon={Search} label="Recherche globale" />
        </div>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-semibold text-ink-500 dark:text-white/45">
          <span>{classifiedToday} classées aujourd’hui</span>
          <span>{remaining} restantes</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-white/8">
          <div className="h-full rounded-full bg-emerald-400 transition-all duration-200" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-ink-500 dark:text-white/45">
        <kbd>A</kbd><span>= accepter</span><kbd>N</kbd><span>= NDF</span><kbd>R</kbd><span>= repas</span><kbd>Entrée</kbd><span>= valider</span>
        {selected ? <span className="ml-auto hidden text-ink-400 sm:inline">Sélection : {cleanMerchantLabel(selected.label)}</span> : null}
      </div>
    </header>
  );
}

function QuickAction({
  icon: Icon,
  label,
  active,
  onClick
}: {
  icon: typeof Search;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "inline-flex h-10 items-center gap-2 rounded-full border px-3 text-xs font-bold transition",
        active
          ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
          : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/8"
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

function CategoryInbox({
  activeFilter,
  setActiveFilter,
  search,
  setSearch
}: {
  activeFilter: string;
  setActiveFilter: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
}) {
  return (
    <aside className="sticky top-[calc(env(safe-area-inset-top)+13rem)] hidden self-start rounded-[1.5rem] border border-white/10 bg-[#171A22]/75 p-3 shadow-[0_20px_70px_-34px_rgba(0,0,0,0.7)] backdrop-blur-2xl lg:block">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Recherche"
          className="h-10 w-full rounded-2xl border border-white/10 bg-black/20 pl-9 pr-3 text-sm font-semibold text-white outline-none placeholder:text-white/30 focus:border-emerald-400/40"
        />
      </div>
      <div className="mt-4 space-y-1">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={clsx(
              "flex h-10 w-full items-center justify-between rounded-2xl px-3 text-sm font-bold transition",
              activeFilter === filter
                ? "bg-white text-ink-950"
                : "text-white/55 hover:bg-white/7 hover:text-white"
            )}
          >
            {filter}
            {filter === "Suggestion forte" ? <Sparkles className="h-3.5 w-3.5" aria-hidden /> : null}
          </button>
        ))}
      </div>
      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Date</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DATE_FILTERS.map((filter) => (
            <button key={filter} type="button" className="rounded-full bg-white/7 px-3 py-1.5 text-xs font-bold text-white/60">
              {filter}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Montant</p>
        <input type="range" min="0" max="100" defaultValue="65" className="mt-3 w-full accent-emerald-400" />
      </div>
    </aside>
  );
}

function TransactionCard({
  tx,
  suggestion,
  active,
  compact,
  onSelect,
  onAccept,
  onNdf,
  onRepas,
  disabled
}: {
  tx: CategorisationTx;
  suggestion: Suggestion;
  active: boolean;
  compact: boolean;
  onSelect: () => void;
  onAccept: () => void;
  onNdf: () => void;
  onRepas: () => void;
  disabled: boolean;
}) {
  const tone = confidenceTone(suggestion.confidence);
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.16 }}
      onClick={onSelect}
      className={clsx(
        "group w-full min-w-0 cursor-pointer overflow-hidden rounded-[1.35rem] border bg-white p-3 shadow-[0_10px_36px_-28px_rgba(0,0,0,0.5)] transition dark:bg-[#141821] dark:shadow-[0_18px_60px_-34px_rgba(0,0,0,0.9)]",
        compact ? "p-2.5" : "p-3.5",
        active
          ? "border-emerald-400/45 bg-emerald-50/40 ring-2 ring-emerald-400/18 dark:border-emerald-300/35 dark:bg-emerald-400/[0.055] dark:ring-emerald-300/12"
          : "border-ink-200 hover:border-ink-300 hover:bg-ink-50 dark:border-white/[0.075] dark:hover:border-white/14 dark:hover:bg-[#1b202b]"
      )}
    >
      <div className="grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink-100 text-lg dark:bg-white/[0.08] dark:ring-1 dark:ring-white/10">
          {suggestion.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-base font-bold text-ink-950 dark:text-white/95">{cleanMerchantLabel(tx.label)}</p>
            <span className={clsx("max-w-[8.5rem] shrink truncate rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 sm:max-w-[14rem]", toneClasses(tone))}>
              {suggestion.category}
            </span>
          </div>
          {!compact ? (
            <p className="mt-0.5 truncate text-xs font-medium text-ink-500 dark:text-white/45">{suggestion.reason} • {formatDateShort(tx.date)}</p>
          ) : null}
        </div>
        <div className="min-w-[4.5rem] text-right">
          <p className="font-display text-base font-bold tabular-nums text-ink-950 dark:text-white/95 sm:text-lg">{formatEuro(tx.amount)}</p>
          <p className="text-[10px] font-bold text-ink-400 dark:text-white/42">{suggestion.confidence}% IA</p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_4.5rem_4.5rem] gap-1.5 lg:hidden">
        <button type="button" disabled={disabled} onClick={(e) => { e.stopPropagation(); onAccept(); }} className="min-w-0 rounded-full bg-emerald-500 px-3 py-2 text-xs font-bold text-white">
          Accepter
        </button>
        <button type="button" disabled={disabled} onClick={(e) => { e.stopPropagation(); onNdf(); }} className="min-w-0 rounded-full bg-ink-100 px-2 py-2 text-xs font-bold text-ink-700 transition hover:bg-ink-200 disabled:opacity-60 dark:bg-white/[0.12] dark:text-white/85 dark:hover:bg-white/[0.18]">
          NDF
        </button>
        <button type="button" disabled={disabled} onClick={(e) => { e.stopPropagation(); onRepas(); }} className="min-w-0 rounded-full bg-ink-100 px-2 py-2 text-xs font-bold text-ink-700 transition hover:bg-ink-200 disabled:opacity-60 dark:bg-white/[0.12] dark:text-white/85 dark:hover:bg-white/[0.18]">
          Repas
        </button>
      </div>
    </motion.article>
  );
}

function SmartSuggestion({ suggestion }: { suggestion: Suggestion }) {
  const tone = confidenceTone(suggestion.confidence);
  return (
    <div className="rounded-[1.35rem] border border-white/10 bg-black/18 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Suggestion IA</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">
            {tone === "strong" ? "Très forte confiance" : tone === "medium" ? "Confiance moyenne" : "Confiance faible"} ({suggestion.confidence}%)
          </p>
          <p className="mt-1 text-xs text-white/42">{suggestion.reason}</p>
        </div>
        <span className={clsx("rounded-full px-3 py-1.5 text-xs font-bold ring-1", toneClasses(tone))}>
          {suggestion.category}
        </span>
      </div>
    </div>
  );
}

function BatchActions({
  selected,
  similar,
  suggestion,
  onApply
}: {
  selected: CategorisationTx | null;
  similar: number;
  suggestion: Suggestion | null;
  onApply: () => void;
}) {
  if (!selected || !suggestion || similar <= 0) return null;
  return (
    <div className="rounded-[1.35rem] border border-sky-400/20 bg-sky-400/10 p-4 text-sm text-sky-950 dark:text-sky-100">
      <p className="font-bold">{similar} transactions similaires détectées</p>
      <p className="mt-1 text-xs opacity-75">Catégorie : {suggestion.category}</p>
      <button type="button" onClick={onApply} className="mt-3 rounded-full bg-sky-500 px-4 py-2 text-xs font-bold text-white">
        Appliquer à toutes
      </button>
    </div>
  );
}

function TransactionDetails({
  tx,
  suggestion,
  similar,
  onAccept,
  onNdf,
  onRepas,
  onNext,
  disabled
}: {
  tx: CategorisationTx | null;
  suggestion: Suggestion | null;
  similar: number;
  onAccept: () => void;
  onNdf: () => void;
  onRepas: () => void;
  onNext: () => void;
  disabled: boolean;
}) {
  if (!tx || !suggestion) {
    return (
      <aside className="hidden rounded-[1.5rem] border border-white/10 bg-[#171A22]/75 p-5 text-sm text-white/45 lg:block">
        Sélectionne une transaction.
      </aside>
    );
  }
  return (
    <aside className="sticky top-[calc(env(safe-area-inset-top)+13rem)] hidden self-start rounded-[1.5rem] border border-white/10 bg-[#171A22]/85 p-5 shadow-[0_20px_70px_-34px_rgba(0,0,0,0.7)] backdrop-blur-2xl lg:block">
      <div className="flex items-start gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-3xl bg-white/8 text-2xl">{suggestion.icon}</div>
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-bold text-white">{cleanMerchantLabel(tx.label)}</p>
          <p className="mt-1 text-xs font-medium text-white/42">{formatDateShort(tx.date)} • {tx.bankName ?? tx.company ?? "Compte source"}</p>
          <p className="mt-3 font-display text-3xl font-bold tabular-nums text-white">{formatEuro(tx.amount)}</p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        <SmartSuggestion suggestion={suggestion} />
        <button type="button" disabled={disabled} onClick={onAccept} className="h-12 w-full rounded-full bg-emerald-500 text-sm font-bold text-white transition hover:bg-emerald-400">
          Accepter suggestion
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={disabled} onClick={onNdf} className="h-11 rounded-full border border-white/10 bg-white/7 text-xs font-bold text-white/75">
            NDF DigitPro
          </button>
          <button type="button" disabled={disabled} onClick={onRepas} className="h-11 rounded-full border border-white/10 bg-white/7 text-xs font-bold text-white/75">
            Repas
          </button>
        </div>
        <button type="button" onClick={onNext} className="h-11 w-full rounded-full border border-white/10 text-xs font-bold text-white/65">
          Transaction suivante
        </button>
        <div className="rounded-2xl bg-white/5 p-3 text-xs text-white/45">
          {similar} transactions similaires classées en {suggestion.category}
        </div>
      </div>
    </aside>
  );
}

function KeyboardShortcuts() {
  return (
    <div className="fixed bottom-[5.6rem] left-1/2 z-40 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/55 px-3 py-2 text-[11px] font-semibold text-white/50 backdrop-blur-xl lg:flex">
      <Keyboard className="h-3.5 w-3.5" aria-hidden />
      <kbd>A</kbd> accepter
      <kbd>N</kbd> NDF
      <kbd>R</kbd> repas
      <ArrowUp className="h-3 w-3" />
      <ArrowDown className="h-3 w-3" />
      navigation
    </div>
  );
}

export function CategorisationClient({
  transactions,
  categories
}: {
  transactions: CategorisationTx[];
  categories: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(transactions[0]?.id ?? "");
  const [activeFilter, setActiveFilter] = useState<string>("Non traitées");
  const [search, setSearch] = useState("");
  const [compact, setCompact] = useState(false);

  const suggestions = useMemo(
    () => new Map(transactions.map((tx) => [tx.id, suggestCategory(tx, categories)])),
    [transactions, categories]
  );

  const filtered = useMemo(() => {
    const q = fold(search);
    return transactions.filter((tx) => {
      const suggestion = suggestions.get(tx.id) ?? suggestCategory(tx, categories);
      if (q && !fold(`${tx.label} ${tx.company} ${suggestion.category}`).includes(q)) return false;
      if (activeFilter === "Suggestion forte" && suggestion.confidence < 90) return false;
      if (activeFilter === "NDF" && !fold(suggestion.category).includes("ndf")) return false;
      if (activeFilter === "Repas" && !fold(suggestion.category).includes("repas")) return false;
      return true;
    });
  }, [activeFilter, categories, search, suggestions, transactions]);

  const selected = filtered.find((tx) => tx.id === selectedId) ?? filtered[0] ?? null;
  const selectedSuggestion = selected ? suggestions.get(selected.id) ?? suggestCategory(selected, categories) : null;
  const selectedIndex = selected ? filtered.findIndex((tx) => tx.id === selected.id) : -1;
  const totalAmount = filtered.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const selectedSimilarCount = similarCount(selected, transactions);

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
      } catch (error) {
        toast.error("Impossible d’enregistrer", {
          description: error instanceof Error ? error.message : undefined
        });
      }
    });
  }

  function accept(tx: CategorisationTx | null, category?: string) {
    if (!tx) return;
    const suggestion = suggestions.get(tx.id) ?? suggestCategory(tx, categories);
    saveCategory(tx.id, category ?? suggestion.category, "Catégorie enregistrée");
  }

  function markNdf(tx: CategorisationTx | null) {
    if (!tx) return;
    saveCategory(tx.id, "NDF DigitPro", "Classé en NDF DigitPro");
  }

  function markRepas(tx: CategorisationTx | null) {
    if (!tx) return;
    accept(tx, categories.find((cat) => fold(cat).includes("repas dirigeant")) ?? "Repas dirigeant");
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
      if (key === "a") {
        event.preventDefault();
        accept(selected);
      } else if (key === "n") {
        event.preventDefault();
        markNdf(selected);
      } else if (key === "r") {
        event.preventDefault();
        markRepas(selected);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        selectNext(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        selectNext(-1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        accept(selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!transactions.length) {
    return (
      <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-sm text-emerald-900 dark:text-emerald-100">
        Toutes les transactions Powens importées sont catégorisées.
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-8rem)] text-ink-950 dark:text-white">
      <ProgressHeader
        total={filtered.length}
        amount={totalAmount}
        selected={selected}
        compact={compact}
        onCompactChange={() => setCompact((v) => !v)}
      />

      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <CategoryInbox
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          search={search}
          setSearch={setSearch}
        />

        <section className="min-w-0 space-y-2.5">
          <div className="flex items-center justify-between rounded-[1.25rem] border border-ink-200 bg-white/80 px-3 py-2 text-xs font-bold text-ink-500 dark:border-white/10 dark:bg-[#171A22]/70 dark:text-white/45">
            <span className="inline-flex items-center gap-2"><Clock3 className="h-3.5 w-3.5" /> File active</span>
            <span>{filtered.length} opérations</span>
          </div>
          <AnimatePresence initial={false}>
            {filtered.map((tx) => {
              const suggestion = suggestions.get(tx.id) ?? suggestCategory(tx, categories);
              return (
                <TransactionCard
                  key={tx.id}
                  tx={tx}
                  suggestion={suggestion}
                  active={selected?.id === tx.id}
                  compact={compact}
                  disabled={isPending}
                  onSelect={() => setSelectedId(tx.id)}
                  onAccept={() => accept(tx)}
                  onNdf={() => markNdf(tx)}
                  onRepas={() => markRepas(tx)}
                />
              );
            })}
          </AnimatePresence>
        </section>

        <div className="space-y-3">
          <TransactionDetails
            tx={selected}
            suggestion={selectedSuggestion}
            similar={selectedSimilarCount}
            disabled={isPending}
            onAccept={() => accept(selected)}
            onNdf={() => markNdf(selected)}
            onRepas={() => markRepas(selected)}
            onNext={() => selectNext(1)}
          />
          <BatchActions
            selected={selected}
            similar={selectedSimilarCount}
            suggestion={selectedSuggestion}
            onApply={() => toast.message("Batch prêt", { description: "Application groupée à brancher après validation métier." })}
          />
        </div>
      </div>
      <KeyboardShortcuts />
    </div>
  );
}
