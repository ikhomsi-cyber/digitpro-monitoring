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
      className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-white px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10 dark:bg-ink-950"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
    >
      <div className="flex flex-col items-center gap-8">
        <Logo size={40} className="opacity-90" />
        <div
          className="h-11 w-11 animate-spin rounded-full border-2 border-ink-200 border-t-brand-500 dark:border-ink-700 dark:border-t-brand-400"
          aria-hidden
        />
        <p className="max-w-sm text-center text-sm font-medium leading-relaxed text-ink-600 dark:text-ink-400">
          {message}
        </p>
      </div>
    </div>
  );
}
