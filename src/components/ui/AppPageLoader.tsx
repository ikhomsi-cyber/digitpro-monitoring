import { clsx } from "clsx";

type AppPageLoaderProps = {
  /** Texte de chargement — accessibilité uniquement (non affiché). */
  message?: string;
  /** Transition de sortie (overlay global). */
  exiting?: boolean;
};

/**
 * Écran de chargement autonome : aucun média externe ne doit pouvoir laisser
 * un écran vide pendant l'hydratation ou sur une connexion mobile lente.
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
      <div className="app-launch-aurora" aria-hidden />
      <div className="app-launch-loader">
        <div className="app-launch-mark" aria-hidden>
          <span className="app-launch-mark__core">D</span>
          <span className="app-launch-mark__orbit" />
          <span className="app-launch-mark__spark app-launch-mark__spark--one" />
          <span className="app-launch-mark__spark app-launch-mark__spark--two" />
        </div>
        <p className="app-launch-brand">DIGITPRO</p>
        <p className="app-launch-caption">Pilotage financier</p>
        <div className="app-launch-progress" aria-hidden>
          <span />
        </div>
        <p className="app-launch-message">{message}</p>
      </div>
    </div>
  );
}
