"use client";

import { useCallback, useState } from "react";
import { clsx } from "clsx";
import { counterpartyInitials, counterpartyLogoHref } from "@/lib/counterparty-logo";

export function CounterpartyLogo({
  name,
  className,
  size = 22
}: {
  name: string;
  className?: string;
  /** Côté CSS px (favicon chargé en 64px puis affiché réduit). */
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const href = counterpartyLogoHref(name, 64);
  const initials = counterpartyInitials(name);

  const onError = useCallback(() => setFailed(true), []);

  if (href && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- favicon tiers, pas d’optimisation Image requise
      <img
        src={href}
        width={size}
        height={size}
        alt=""
        className={clsx(
          "shrink-0 rounded-md border border-ink-200/90 bg-white object-contain shadow-sm",
          className
        )}
        loading="lazy"
        decoding="async"
        onError={onError}
      />
    );
  }

  return (
    <span
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-md border border-ink-200/90 bg-emerald-50 text-[10px] font-semibold tabular-nums text-emerald-900 shadow-sm",
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
