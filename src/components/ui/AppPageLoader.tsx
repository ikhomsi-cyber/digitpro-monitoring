import Image from "next/image";

type AppPageLoaderProps = {
  /** Texte de chargement — accessibilité uniquement (non affiché). */
  message?: string;
};

/**
 * Écran de chargement plein viewport — logo centré, fond page habituel.
 * Image statique (pas de `useId`) pour éviter les erreurs d’hydratation.
 */
export function AppPageLoader({ message = "Chargement…" }: AppPageLoaderProps) {
  return (
    <div
      className="premium-dashboard-page flex min-h-dvh items-center justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
    >
      <Image
        src="/icons/digitpro-icon.svg"
        alt="DigitPro"
        width={52}
        height={52}
        priority
        className="animate-breathe"
      />
    </div>
  );
}
