"use client";
import { Mail, Plus, RefreshCw } from "lucide-react";
import type { GmailConnectionStatus } from "@/app/dashboard/gmail-actions";
import type { GmailAccount } from "@/lib/gmail/accounts";
export function GmailAccountPicker({ status, value, onChange, onConnect, disabled, compact = false }: {
  status: GmailConnectionStatus | null; value: GmailAccount; onChange: (account: GmailAccount) => void;
  onConnect: (account: GmailAccount) => void; disabled: boolean; compact?: boolean;
}) {
  const accounts = status?.accounts ?? [{ id: "primary" as const, email: status?.email ?? null, connected: status?.connected ?? false }, { id: "secondary" as const, email: null, connected: false }];
  const selected = accounts.find(account => account.id === value);
  const empty = accounts.find(account => !account.connected);
  return <div className={compact ? "flex min-w-0 items-center gap-2" : "mt-3 flex flex-wrap items-center gap-2"} data-private>
    <label className="flex min-w-0 items-center gap-2 text-xs text-ink-500 dark:text-white/60">
      {compact ? <Mail size={14} className="shrink-0 text-ink-400 dark:text-white/40" aria-hidden="true" /> : null}<span className={compact ? "sr-only" : undefined}>Compte Gmail</span>
      <select value={value} onChange={event => onChange(event.target.value as GmailAccount)} disabled={disabled || !status} className={compact ? "min-h-8 min-w-0 max-w-[min(65vw,280px)] cursor-pointer rounded-lg border border-ink-200/50 bg-transparent px-2 text-[11px] text-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50 dark:border-white/10 dark:text-white/65 [&>option]:bg-white dark:[&>option]:bg-slate-950" : "min-h-9 max-w-[250px] rounded-xl border border-ink-200/60 bg-white px-2 text-xs text-ink-800 dark:border-white/10 dark:bg-slate-950 dark:text-white"}>
        {accounts.map((account, index) => <option key={account.id} value={account.id}>{`${index === 0 ? "Principal" : "Courses"} · ${account.email ?? "à connecter"}`}</option>)}
      </select>
    </label>
    {status?.configured ? <button type="button" disabled={disabled} aria-label={selected?.connected ? empty ? "Ajouter un compte Gmail" : "Reconnecter ce compte Gmail" : "Connecter ce compte Gmail"} title={selected?.connected ? empty ? "Ajouter un compte Gmail" : "Reconnecter ce compte Gmail" : "Connecter ce compte Gmail"} onClick={() => onConnect(selected?.connected && empty ? empty.id : value)} className={compact ? "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-400 transition hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50 dark:text-white/45 dark:hover:bg-white/5" : "min-h-9 rounded-xl border border-ink-200/60 px-3 text-xs font-medium text-ink-600 disabled:opacity-50 dark:border-white/10 dark:text-white/70"}>{compact ? (empty ? <Plus size={15} /> : <RefreshCw size={14} />) : selected?.connected ? empty ? "Ajouter un compte" : "Reconnecter ce compte" : "Connecter ce compte"}</button> : null}
  </div>;
}
