import { clsx } from "clsx";

type Variant = "solid" | "glass" | "ghost";

/**
 * Apple-style flat card. The `glass` variant is intentionally NOT translucent;
 * Apple's UI is flat. We keep the prop name for backwards-compatibility but
 * render a clean white card with a subtle shadow.
 */
export function Card({
  className,
  children,
  variant = "solid"
}: {
  className?: string;
  children: React.ReactNode;
  variant?: Variant;
}) {
  return (
    <div
      className={clsx(
        "animate-floatIn",
        variant === "glass" &&
          "rounded-2xl border border-ink-200 bg-white shadow-card dark:border-ink-800 dark:bg-ink-900/75 dark:shadow-none",
        variant === "solid" &&
          "rounded-2xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900/75",
        variant === "ghost" && "rounded-2xl bg-ink-100 dark:bg-ink-900/50",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={clsx("flex items-start justify-between gap-4 p-4 sm:p-6", className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={clsx("text-sm font-medium text-ink-600 dark:text-ink-400", className)}>
      {children}
    </div>
  );
}

export function CardValue({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        "mt-1 font-display text-3xl font-semibold tracking-apple-tight text-ink-900 dark:text-ink-50",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardBody({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={clsx("px-4 pb-5 sm:px-6 sm:pb-6", className)}>{children}</div>;
}
