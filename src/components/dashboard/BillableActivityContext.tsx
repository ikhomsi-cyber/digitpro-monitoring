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
import { replaceBillableWorkDays, replaceBillableVacationDays, updateAnnualRevenueTarget } from "@/app/dashboard/actions";
import { computeCurrentMonthOverview } from "@/lib/billable-calendar-metrics";
import type { BillableRatePeriod } from "@/lib/billable-client-days";
import type {
  ActivityOverviewKpis,
  ActivityWorkdayGauge
} from "@/components/dashboard/ActivityOverviewPremium";

const STORAGE_KEY = "digitpro:billable-work-days-iso";
const VACATION_STORAGE_KEY = "digitpro:billable-vacation-days-iso";
const ANNUAL_TARGET_STORAGE_KEY = "digitpro:annual-revenue-target-ht";

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
  billableRatePeriods: readonly BillableRatePeriod[];
  persistToSupabase: boolean;
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  vacationDays: Set<string>;
  setVacationDays: React.Dispatch<React.SetStateAction<Set<string>>>;
  hydrated: boolean;
  sortedIsos: readonly string[];
  overviewMonthTitle: string;
  overviewKpis: ActivityOverviewKpis;
  overviewWorkdayGauge: ActivityWorkdayGauge;
  overviewTjmEnVigueurHt: number;
  annualRevenueTargetHt: number | null;
  setAnnualRevenueTargetHt: React.Dispatch<React.SetStateAction<number | null>>;
};

const BillableActivityContext = createContext<BillableActivityContextValue | null>(null);

export function BillableActivityProvider({
  children,
  tjmHt,
  billableRatePeriods = [],
  persistToSupabase,
  initialWorkDayIsos,
  initialVacationDayIsos = [],
  initialAnnualRevenueTargetHt = null
}: {
  children: ReactNode;
  tjmHt: number;
  billableRatePeriods?: readonly BillableRatePeriod[];
  persistToSupabase: boolean;
  initialWorkDayIsos: string[];
  initialVacationDayIsos?: string[];
  initialAnnualRevenueTargetHt?: number | null;
}) {
  const [selected, setSelected] = useState<Set<string>>(() =>
    persistToSupabase ? new Set(initialWorkDayIsos) : new Set()
  );
  const [vacationDays, setVacationDays] = useState<Set<string>>(() =>
    persistToSupabase ? new Set(initialVacationDayIsos) : new Set()
  );
  const [hydrated, setHydrated] = useState(false);
  const [annualRevenueTargetHt, setAnnualRevenueTargetHt] = useState<number | null>(
    initialAnnualRevenueTargetHt
  );
  const [, startTransition] = useTransition();
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const vacationDaysRef = useRef(vacationDays);
  vacationDaysRef.current = vacationDays;
  const lastPersistedRef = useRef<string | null>(null);
  const lastVacationPersistedRef = useRef<string | null>(null);
  const lastTargetPersistedRef = useRef<number | null | undefined>(undefined);

  const serverDaysKey = useMemo(
    () => [...initialWorkDayIsos].sort().join("|"),
    [initialWorkDayIsos]
  );
  const serverVacationDaysKey = useMemo(
    () => [...initialVacationDayIsos].sort().join("|"),
    [initialVacationDayIsos]
  );
  const serverTargetKey = useMemo(
    () => (initialAnnualRevenueTargetHt == null ? "" : String(initialAnnualRevenueTargetHt)),
    [initialAnnualRevenueTargetHt]
  );

  useEffect(() => {
    if (persistToSupabase) {
      setSelected(new Set(initialWorkDayIsos));
      setVacationDays(new Set(initialVacationDayIsos));
      lastPersistedRef.current = persistSignature([...initialWorkDayIsos].sort(), tjmHt);
      lastVacationPersistedRef.current = [...initialVacationDayIsos].sort().join(",");
    } else if (typeof window !== "undefined") {
      setSelected(parseStored(localStorage.getItem(STORAGE_KEY)));
      setVacationDays(parseStored(localStorage.getItem(VACATION_STORAGE_KEY)));
      lastPersistedRef.current = null;
      lastVacationPersistedRef.current = null;
    }
    if (persistToSupabase) {
      setAnnualRevenueTargetHt(initialAnnualRevenueTargetHt);
    } else if (typeof window !== "undefined") {
      const raw = localStorage.getItem(ANNUAL_TARGET_STORAGE_KEY);
      const parsed = raw != null ? Number(raw) : NaN;
      setAnnualRevenueTargetHt(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clés serveur résument les props initiales.
  }, [persistToSupabase, serverDaysKey, serverVacationDaysKey, serverTargetKey, tjmHt, initialAnnualRevenueTargetHt]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined" || persistToSupabase) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected].sort()));
  }, [selected, hydrated, persistToSupabase]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined" || persistToSupabase) return;
    localStorage.setItem(VACATION_STORAGE_KEY, JSON.stringify([...vacationDays].sort()));
  }, [vacationDays, hydrated, persistToSupabase]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined" || persistToSupabase) return;
    if (annualRevenueTargetHt == null) {
      localStorage.removeItem(ANNUAL_TARGET_STORAGE_KEY);
    } else {
      localStorage.setItem(ANNUAL_TARGET_STORAGE_KEY, String(annualRevenueTargetHt));
    }
  }, [annualRevenueTargetHt, hydrated, persistToSupabase]);

  useEffect(() => {
    if (!hydrated || !persistToSupabase) return;
    if (lastTargetPersistedRef.current === undefined) {
      lastTargetPersistedRef.current = annualRevenueTargetHt;
      return;
    }
    if (lastTargetPersistedRef.current === annualRevenueTargetHt) return;
    const t = setTimeout(() => {
      startTransition(() => {
        void updateAnnualRevenueTarget(annualRevenueTargetHt)
          .then(() => {
            lastTargetPersistedRef.current = annualRevenueTargetHt;
          })
          .catch((e) => {
            toast.error("Enregistrement de l'objectif annuel impossible", {
              description: e instanceof Error ? e.message : undefined
            });
          });
      });
    }, 600);
    return () => clearTimeout(t);
  }, [annualRevenueTargetHt, hydrated, persistToSupabase]);

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

  useEffect(() => {
    if (!hydrated || !persistToSupabase) return;
    const sortedDates = [...vacationDaysRef.current].sort();
    const sig = sortedDates.join(",");
    if (sig === lastVacationPersistedRef.current) return;
    const t = setTimeout(() => {
      const toSave = [...vacationDaysRef.current].sort();
      const sigNow = toSave.join(",");
      startTransition(() => {
        void replaceBillableVacationDays(toSave)
          .then(() => {
            lastVacationPersistedRef.current = sigNow;
          })
          .catch((e) => {
            toast.error("Enregistrement des vacances impossible", {
              description: e instanceof Error ? e.message : undefined
            });
          });
      });
    }, 500);
    return () => clearTimeout(t);
  }, [vacationDays, hydrated, persistToSupabase]);

  const sortedIsos = useMemo(() => [...selected].sort(), [selected]);

  const overview = useMemo(
    () => computeCurrentMonthOverview(selected, billableRatePeriods, tjmHt, new Date(), vacationDays),
    [billableRatePeriods, selected, tjmHt, vacationDays]
  );

  const value = useMemo<BillableActivityContextValue>(
    () => ({
      tjmHt,
      billableRatePeriods,
      persistToSupabase,
      selected,
      setSelected,
      vacationDays,
      setVacationDays,
      hydrated,
      sortedIsos,
      overviewMonthTitle: overview.monthTitle,
      overviewKpis: overview.kpis,
      overviewWorkdayGauge: overview.workdayGauge,
      overviewTjmEnVigueurHt: overview.tjmEnVigueurHt,
      annualRevenueTargetHt,
      setAnnualRevenueTargetHt
    }),
    [tjmHt, billableRatePeriods, persistToSupabase, selected, vacationDays, hydrated, sortedIsos, overview, annualRevenueTargetHt]
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
