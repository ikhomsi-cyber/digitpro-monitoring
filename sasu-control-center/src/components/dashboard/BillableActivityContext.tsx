"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode
} from "react";
import { toast } from "sonner";
import { replaceBillableWorkDays } from "@/app/dashboard/actions";
import { computeCurrentMonthOverview } from "@/lib/billable-calendar-metrics";
import type {
  ActivityOverviewKpis,
  ActivityWorkdayGauge
} from "@/components/dashboard/ActivityOverviewPremium";

const STORAGE_KEY = "digitpro:billable-work-days-iso";

function parseStored(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const a = JSON.parse(raw) as unknown;
    if (!Array.isArray(a)) return new Set();
    return new Set(
      a.filter((x): x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x))
    );
  } catch {
    return new Set();
  }
}

function persistSignature(sortedDates: string[], tjm: number): string {
  return sortedDates.join(",") + "|" + tjm;
}

type BillableActivityContextValue = {
  tjmHt: number;
  persistToSupabase: boolean;
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  hydrated: boolean;
  sortedIsos: readonly string[];
  overviewMonthTitle: string;
  overviewKpis: ActivityOverviewKpis;
  overviewWorkdayGauge: ActivityWorkdayGauge;
};

const BillableActivityContext = createContext<BillableActivityContextValue | null>(null);

export function BillableActivityProvider({
  children,
  tjmHt,
  persistToSupabase,
  initialWorkDayIsos
}: {
  children: ReactNode;
  tjmHt: number;
  persistToSupabase: boolean;
  initialWorkDayIsos: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);
  const [, startTransition] = useTransition();
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const lastPersistedRef = useRef<string | null>(null);

  const serverDaysKey = useMemo(
    () => [...initialWorkDayIsos].sort().join("|"),
    [initialWorkDayIsos]
  );

  useEffect(() => {
    if (persistToSupabase) {
      setSelected(new Set(initialWorkDayIsos));
      lastPersistedRef.current = persistSignature([...initialWorkDayIsos].sort(), tjmHt);
    } else if (typeof window !== "undefined") {
      setSelected(parseStored(localStorage.getItem(STORAGE_KEY)));
      lastPersistedRef.current = null;
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `serverDaysKey` résume `initialWorkDayIsos`.
  }, [persistToSupabase, serverDaysKey, tjmHt]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined" || persistToSupabase) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected].sort()));
  }, [selected, hydrated, persistToSupabase]);

  useEffect(() => {
    if (!hydrated || !persistToSupabase) return;
    const sortedDates = [...selectedRef.current].sort();
    const sig = persistSignature(sortedDates, tjmHt);
    if (sig === lastPersistedRef.current) return;
    const t = setTimeout(() => {
      const toSave = [...selectedRef.current].sort();
      const sigNow = persistSignature(toSave, tjmHt);
      startTransition(() => {
        void replaceBillableWorkDays(toSave, tjmHt)
          .then(() => {
            lastPersistedRef.current = sigNow;
          })
          .catch((e) => {
            toast.error("Enregistrement des jours travaillés impossible", {
              description: e instanceof Error ? e.message : undefined
            });
          });
      });
    }, 500);
    return () => clearTimeout(t);
  }, [selected, hydrated, persistToSupabase, tjmHt]);

  const sortedIsos = useMemo(() => [...selected].sort(), [selected]);

  const overview = useMemo(
    () => computeCurrentMonthOverview(selected, tjmHt),
    [selected, tjmHt]
  );

  const value = useMemo<BillableActivityContextValue>(
    () => ({
      tjmHt,
      persistToSupabase,
      selected,
      setSelected,
      hydrated,
      sortedIsos,
      overviewMonthTitle: overview.monthTitle,
      overviewKpis: overview.kpis,
      overviewWorkdayGauge: overview.workdayGauge
    }),
    [tjmHt, persistToSupabase, selected, hydrated, sortedIsos, overview]
  );

  return (
    <BillableActivityContext.Provider value={value}>{children}</BillableActivityContext.Provider>
  );
}

export function useBillableActivity(): BillableActivityContextValue {
  const ctx = useContext(BillableActivityContext);
  if (!ctx) {
    throw new Error("useBillableActivity must be used within BillableActivityProvider");
  }
  return ctx;
}

export function useBillableActivityOptional(): BillableActivityContextValue | null {
  return useContext(BillableActivityContext);
}
