import { Minus } from "lucide-react";

/** Valeur vide : pictogramme explicite, sans tiret ni points de suspension. */
export function EmptyValue({ label = "Non renseigné" }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center justify-center text-ink-400"
      title={label}
      aria-label={label}
    >
      <Minus className="h-3.5 w-3.5 shrink-0 stroke-[2.5]" aria-hidden />
    </span>
  );
}
