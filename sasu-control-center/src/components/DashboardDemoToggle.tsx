"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { setDashboardDemoMode } from "@/app/dashboard/actions";

export function DashboardDemoToggle({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label
      className={clsx(
        "inline-flex cursor-pointer select-none items-center gap-3 rounded-full border border-ink-300 bg-white px-4 py-2 text-sm transition hover:border-ink-400",
        pending && "pointer-events-none opacity-70"
      )}
    >
      <span className="font-medium text-ink-900">Mode démo</span>
      <span className="relative inline-block h-6 w-11 shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={enabled}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            startTransition(async () => {
              await setDashboardDemoMode(next);
              router.refresh();
            });
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full bg-ink-200 transition-colors peer-checked:bg-brand-500"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"
        />
      </span>
      <span className="hidden max-w-[12rem] leading-snug text-ink-500 sm:inline">
        {enabled ? "Données fictives" : "Données Supabase"}
      </span>
    </label>
  );
}
