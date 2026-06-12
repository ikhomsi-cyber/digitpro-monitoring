import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";

export type IconBadgeTone =
  | "neutral"
  | "emerald"
  | "sky"
  | "teal"
  | "violet"
  | "indigo"
  | "amber"
  | "rose"
  | "orange"
  | "cyan"
  | "brand";

const TONE_CLASSES: Record<IconBadgeTone, string> = {
  neutral:
    "border-ink-200/80 bg-ink-50/80 text-ink-500 dark:border-white/[0.10] dark:bg-white/[0.05] dark:text-white/55",
  emerald:
    "border-emerald-200/70 bg-emerald-50/60 text-emerald-600 dark:border-emerald-300/18 dark:bg-emerald-400/10 dark:text-emerald-200/90",
  sky:
    "border-sky-200/70 bg-sky-50/60 text-sky-600 dark:border-sky-300/18 dark:bg-sky-400/10 dark:text-sky-200/90",
  teal:
    "border-teal-200/70 bg-teal-50/60 text-teal-600 dark:border-teal-300/18 dark:bg-teal-400/10 dark:text-teal-200/90",
  violet:
    "border-violet-200/70 bg-violet-50/60 text-violet-600 dark:border-violet-300/18 dark:bg-violet-400/10 dark:text-violet-200/90",
  indigo:
    "border-indigo-200/70 bg-indigo-50/60 text-indigo-600 dark:border-indigo-300/18 dark:bg-indigo-400/10 dark:text-indigo-200/90",
  amber:
    "border-amber-200/70 bg-amber-50/60 text-amber-600 dark:border-amber-300/18 dark:bg-amber-400/10 dark:text-amber-200/90",
  rose:
    "border-rose-200/70 bg-rose-50/60 text-rose-600 dark:border-rose-300/18 dark:bg-rose-400/10 dark:text-rose-200/90",
  orange:
    "border-orange-200/70 bg-orange-50/60 text-orange-600 dark:border-orange-300/18 dark:bg-orange-400/10 dark:text-orange-200/90",
  cyan:
    "border-cyan-200/70 bg-cyan-50/60 text-cyan-600 dark:border-cyan-300/18 dark:bg-cyan-400/10 dark:text-cyan-200/90",
  brand:
    "border-brand-200/70 bg-brand-50/60 text-brand-600 dark:border-brand-300/18 dark:bg-brand-400/10 dark:text-brand-200/90"
};

type PremiumIconBadgeProps = {
  icon: LucideIcon;
  tone?: IconBadgeTone;
  /** sm = 32px (cartes compactes), md = 36px (KPI hero), lg = 40px */
  size?: "sm" | "md" | "lg";
  className?: string;
  strokeWidth?: number;
};

const SIZE_CLASSES = {
  sm: { box: "h-8 w-8 rounded-[10px]", icon: "h-4 w-4" },
  md: { box: "h-9 w-9 rounded-xl", icon: "h-[18px] w-[18px]" },
  lg: { box: "h-10 w-10 rounded-xl", icon: "h-5 w-5" }
} as const;

/**
 * Pictogramme discret — fond plat, bordure légère. Préférer `neutral` sauf signal sémantique.
 */
export function PremiumIconBadge({
  icon: Icon,
  tone = "neutral",
  size = "md",
  className,
  strokeWidth = 2
}: PremiumIconBadgeProps) {
  const s = SIZE_CLASSES[size];
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center justify-center border",
        s.box,
        TONE_CLASSES[tone],
        className
      )}
      aria-hidden
    >
      <Icon className={s.icon} strokeWidth={strokeWidth} />
    </span>
  );
}
