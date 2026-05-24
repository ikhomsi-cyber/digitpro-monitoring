import { clsx } from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} aria-hidden="true" />;
}

export function SkeletonText({
  lines = 3,
  className
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={clsx("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-3"
          style={{ width: `${85 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonKpi() {
  return (
    <div className="surface-card p-5">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton mt-3 h-7 w-32" />
      <div className="skeleton mt-2 h-3 w-40" />
    </div>
  );
}

export function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  return (
    <div className="grid items-center gap-4 border-t border-ink-100 px-4 py-3"
         style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="skeleton h-3" style={{ width: `${50 + (i % 3) * 15}%` }} />
      ))}
    </div>
  );
}
