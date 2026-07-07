import Image from "next/image";
import { clsx } from "clsx";

type AppPageLoaderProps = {
  /** Texte de chargement — accessibilité uniquement (non affiché). */
  message?: string;
  /** Transition de sortie (overlay global). */
  exiting?: boolean;
};

/**
 * Écran de chargement plein viewport — même fond que le dashboard dark (dégradé teal).
 */
export function AppPageLoader({ message = "Chargement…", exiting = false }: AppPageLoaderProps) {
  return (
    <div
      className={clsx("app-launch-screen", exiting && "app-launch-screen--exit")}
      role="status"
      aria-live="polite"
      aria-busy={!exiting}
      aria-label={message}
    >
      <div className="relative flex items-center justify-center">
        <div
          className="pointer-events-none absolute h-28 w-28 rounded-full bg-cyan-300/25 blur-2xl dark:bg-cyan-400/30 animate-launchGlow"
          aria-hidden
        />
        <Image
          src="/icons/digitpro-icon.svg"
          alt="DigitPro"
          width={76}
          height={76}
          priority
          className="relative drop-shadow-[0_12px_28px_rgba(0,0,0,0.35)] animate-launchLogo"
        />
      </div>
    </div>
  );
}
