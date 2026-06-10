import { Logo } from "@/components/ui/Logo";

type AppPageLoaderProps = {
  /** Texte de chargement — utilisé uniquement pour l’accessibilité (non affiché). */
  message?: string;
};

/**
 * Écran de chargement plein viewport (Next.js `loading.tsx`, splash initial).
 * Minimaliste : uniquement le logo DigitPro centré, avec une fine barre de
 * progression pour signaler le chargement en cours.
 */
export function AppPageLoader({ message = "Chargement…" }: AppPageLoaderProps) {
  return (
    <div
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-white px-6 dark:bg-[#06242b] dark:bg-[radial-gradient(900px_620px_at_50%_-10%,rgba(24,160,176,0.42),transparent_62%),radial-gradient(760px_520px_at_10%_6%,rgba(45,212,191,0.16),transparent_54%),radial-gradient(700px_520px_at_90%_0%,rgba(14,116,144,0.22),transparent_52%),linear-gradient(180deg,#0c5361_0%,#06343d_42%,#03191f_100%)]"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
    >
      <div className="flex flex-col items-center gap-7">
        <Logo size={52} className="animate-breathe dark:brightness-125" />
        <div
          className="h-[3px] w-28 overflow-hidden rounded-full bg-ink-200/70 dark:bg-white/10"
          aria-hidden
        >
          <div className="h-full w-1/3 animate-loaderBar rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-cyan-400 dark:from-cyan-300 dark:via-emerald-300 dark:to-cyan-200" />
        </div>
      </div>
    </div>
  );
}
