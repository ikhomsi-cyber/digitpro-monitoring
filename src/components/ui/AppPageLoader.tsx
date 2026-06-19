import Image from "next/image";

type AppPageLoaderProps = {
  /** Texte de chargement — accessibilité uniquement (non affiché). */
  message?: string;
};

/**
 * Écran de chargement plein viewport — logo centré, fond uni identique à html/body
 * (Dynamic Island + safe areas iPhone). Pas de dégradé : transition fluide jusqu’à l’app.
 */
export function AppPageLoader({ message = "Chargement…" }: AppPageLoaderProps) {
  return (
    <div
      className="app-launch-screen"
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
