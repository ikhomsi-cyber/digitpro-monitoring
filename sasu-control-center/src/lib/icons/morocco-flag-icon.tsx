import { forwardRef, type SVGProps } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Picto drapeau du Maroc (rouge + étoile verte simplifiée) pour les libellés de catégorie liés au Maroc.
 * Compatibilité API proche des icônes Lucide (`className`, `ref`).
 */
export const MoroccoFlagIcon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(function MoroccoFlagIcon(
  { className, width, height, ...rest },
  ref
) {
  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      className={className}
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...rest}
    >
      <rect x="2" y="5.5" width="20" height="13" rx="1.2" fill="#C1272D" />
      <path
        fill="#006233"
        d="M12 7.8l1.15 3.54h3.73l-3.01 2.19 1.15 3.54L12 15.08l-3.02 2.19 1.15-3.54-3.01-2.19h3.73z"
      />
    </svg>
  );
}) as LucideIcon;

MoroccoFlagIcon.displayName = "MoroccoFlag";
