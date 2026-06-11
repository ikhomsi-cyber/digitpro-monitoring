import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";

export type IconBadgeTone =
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
  emerald:
    "border-emerald-200/90 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 text-emerald-600 shadow-[0_2px_10px_-4px_rgba(16,185,129,0.45)] dark:border-emerald-300/28 dark:from-emerald-400/22 dark:via-emerald-500/10 dark:to-emerald-600/6 dark:text-emerald-100 dark:shadow-[0_0_22px_-6px_rgba(52,211,153,0.5),inset_0_1px_0_rgba(255,255,255,0.14)]",
  sky:
    "border-sky-200/90 bg-gradient-to-br from-sky-50 via-white to-sky-50/40 text-sky-600 shadow-[0_2px_10px_-4px_rgba(14,165,233,0.4)] dark:border-sky-300/28 dark:from-sky-400/22 dark:via-sky-500/10 dark:to-sky-600/6 dark:text-sky-100 dark:shadow-[0_0_22px_-6px_rgba(56,189,248,0.48),inset_0_1px_0_rgba(255,255,255,0.14)]",
  teal:
    "border-teal-200/90 bg-gradient-to-br from-teal-50 via-white to-teal-50/40 text-teal-600 shadow-[0_2px_10px_-4px_rgba(20,184,166,0.4)] dark:border-teal-300/28 dark:from-teal-400/22 dark:via-teal-500/10 dark:to-teal-600/6 dark:text-teal-100 dark:shadow-[0_0_22px_-6px_rgba(45,212,191,0.48),inset_0_1px_0_rgba(255,255,255,0.14)]",
  violet:
    "border-violet-200/90 bg-gradient-to-br from-violet-50 via-white to-violet-50/40 text-violet-600 shadow-[0_2px_10px_-4px_rgba(139,92,246,0.4)] dark:border-violet-300/28 dark:from-violet-400/22 dark:via-violet-500/10 dark:to-violet-600/6 dark:text-violet-100 dark:shadow-[0_0_22px_-6px_rgba(167,139,250,0.48),inset_0_1px_0_rgba(255,255,255,0.14)]",
  indigo:
    "border-indigo-200/90 bg-gradient-to-br from-indigo-50 via-white to-indigo-50/40 text-indigo-600 shadow-[0_2px_10px_-4px_rgba(99,102,241,0.4)] dark:border-indigo-300/28 dark:from-indigo-400/22 dark:via-indigo-500/10 dark:to-indigo-600/6 dark:text-indigo-100 dark:shadow-[0_0_22px_-6px_rgba(129,140,248,0.48),inset_0_1px_0_rgba(255,255,255,0.14)]",
  amber:
    "border-amber-200/90 bg-gradient-to-br from-amber-50 via-white to-amber-50/40 text-amber-600 shadow-[0_2px_10px_-4px_rgba(245,158,11,0.4)] dark:border-amber-300/28 dark:from-amber-400/22 dark:via-amber-500/10 dark:to-amber-600/6 dark:text-amber-100 dark:shadow-[0_0_22px_-6px_rgba(251,191,36,0.45),inset_0_1px_0_rgba(255,255,255,0.14)]",
  rose:
    "border-rose-200/90 bg-gradient-to-br from-rose-50 via-white to-rose-50/40 text-rose-600 shadow-[0_2px_10px_-4px_rgba(244,63,94,0.4)] dark:border-rose-300/28 dark:from-rose-400/22 dark:via-rose-500/10 dark:to-rose-600/6 dark:text-rose-100 dark:shadow-[0_0_22px_-6px_rgba(251,113,133,0.48),inset_0_1px_0_rgba(255,255,255,0.14)]",
  orange:
    "border-orange-200/90 bg-gradient-to-br from-orange-50 via-white to-orange-50/40 text-orange-600 shadow-[0_2px_10px_-4px_rgba(249,115,22,0.4)] dark:border-orange-300/28 dark:from-orange-400/22 dark:via-orange-500/10 dark:to-orange-600/6 dark:text-orange-100 dark:shadow-[0_0_22px_-6px_rgba(251,146,60,0.48),inset_0_1px_0_rgba(255,255,255,0.14)]",
  cyan:
    "border-cyan-200/90 bg-gradient-to-br from-cyan-50 via-white to-cyan-50/40 text-cyan-600 shadow-[0_2px_10px_-4px_rgba(6,182,212,0.4)] dark:border-cyan-300/28 dark:from-cyan-400/22 dark:via-cyan-500/10 dark:to-cyan-600/6 dark:text-cyan-100 dark:shadow-[0_0_22px_-6px_rgba(103,232,249,0.48),inset_0_1px_0_rgba(255,255,255,0.14)]",
  brand:
    "border-brand-200/90 bg-gradient-to-br from-brand-50 via-white to-brand-50/40 text-brand-600 shadow-[0_2px_10px_-4px_rgba(0,113,227,0.35)] dark:border-brand-300/28 dark:from-brand-400/22 dark:via-brand-500/10 dark:to-brand-600/6 dark:text-brand-100 dark:shadow-[0_0_22px_-6px_rgba(51,149,251,0.48),inset_0_1px_0_rgba(255,255,255,0.14)]"
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
 * Pictogramme premium — dégradé, bordure nette, glow en dark mode.
 * Utiliser partout à la place des spans `bg-*-50 text-*-600` ad hoc.
 */
export function PremiumIconBadge({
  icon: Icon,
  tone = "brand",
  size = "md",
  className,
  strokeWidth = 2.25
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
