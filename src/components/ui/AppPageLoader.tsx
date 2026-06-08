import { Logo } from "@/components/ui/Logo";

type AppPageLoaderProps = {
  /** Texte sous le logo (défaut : chargement générique). */
  message?: string;
};

/**
 * Écran de chargement plein viewport (Next.js `loading.tsx`, splash initial).
 */
export function AppPageLoader({ message = "Chargement…" }: AppPageLoaderProps) {
  return (
    <div
      className="relative flex min-h-dvh flex-col items-center justify-center gap-8 overflow-hidden bg-gradient-to-b from-white via-white to-ink-50 px-6 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))] dark:bg-[#06242b] dark:bg-[radial-gradient(900px_620px_at_50%_-10%,rgba(24,160,176,0.45),transparent_62%),radial-gradient(760px_520px_at_10%_6%,rgba(45,212,191,0.18),transparent_54%),radial-gradient(700px_520px_at_90%_0%,rgba(14,116,144,0.24),transparent_52%),linear-gradient(180deg,#0c5361_0%,#06343d_42%,#03191f_100%)]"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
    >
      <div className="pointer-events-none absolute inset-x-6 top-[16%] h-44 rounded-full bg-cyan-300/10 blur-3xl dark:bg-cyan-300/24" aria-hidden />
      <div className="pointer-events-none absolute bottom-[18%] h-36 w-72 rounded-full bg-emerald-300/10 blur-3xl dark:bg-emerald-300/16" aria-hidden />
      <div className="relative flex flex-col items-center gap-8 rounded-[2rem] border border-ink-200/70 bg-white/78 px-10 py-9 shadow-[0_24px_80px_-30px_rgba(0,0,0,0.22)] backdrop-blur-xl dark:border-cyan-100/[0.18] dark:bg-[#0b3038]/92 dark:shadow-[0_36px_110px_-30px_rgba(0,22,28,0.9),inset_0_1px_0_rgba(255,255,255,0.11),inset_0_0_0_1px_rgba(103,232,249,0.04)]">
        <div className="rounded-2xl border border-ink-200/70 bg-white/70 p-3 shadow-sm dark:border-cyan-100/[0.14] dark:bg-cyan-50/[0.07] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <Logo size={40} className="opacity-95 dark:brightness-125" />
        </div>
        <div
          className="h-11 w-11 animate-spin rounded-full border-2 border-ink-200 border-t-emerald-500 shadow-[0_0_30px_-18px_rgba(16,185,129,0.9)] dark:border-cyan-100/[0.18] dark:border-t-cyan-200 dark:shadow-[0_0_34px_-12px_rgba(103,232,249,0.8)]"
          aria-hidden
        />
        <p className="max-w-sm text-center text-sm font-bold leading-relaxed text-ink-600 dark:text-cyan-50/82">
          {message}
        </p>
      </div>
    </div>
  );
}
