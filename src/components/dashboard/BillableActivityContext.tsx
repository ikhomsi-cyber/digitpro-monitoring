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
import { replaceBillableCommuteDays, replaceBillableMileageAdjustments, replaceBillableWorkDays, replaceBillableVacationDays, updateAnnualRevenueTarget } from "@/app/dashboard/actions";
import { computeCurrentMonthOverview } from "@/lib/billable-calendar-metrics";
import type { BillableRatePeriod } from "@/lib/billable-client-days";
import type {
  ActivityOverviewKpis,
  ActivityWorkdayGauge
} from "@/components/dashboard/ActivityOverviewPremium";

const STORAGE_KEY = "digitpro:billable-work-days-iso";
const VACATION_STORAGE_KEY = "digitpro:billable-vacation-days-iso";
const ANNUAL_TARGET_STORAGE_KEY = "digitpro:annual-revenue-target-ht";
const COMMUTE_STORAGE_KEY = "digitpro:billable-commute-days-iso";
const MILEAGE_EXTRA_STORAGE_KEY = "digitpro:billable-mileage-extra-km";

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
function parseMonthlyKm(raw: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(value).filter(([month, km]) => /^\d{4}-\d{2}$/.test(month) && Number.isFinite(Number(km)) && Number(km) > 0).map(([month, km]) => [month, Number(km)]));
  } catch { return {}; }
}

type BillableActivityContextValue = {
  tjmHt: number;
  billableRatePeriods: readonly BillableRatePeriod[];
  persistToSupabase: boolean;
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  vacationDays: Set<string>;
  setVacationDays: React.Dispatch<React.SetStateAction<Set<string>>>;
  commuteDays: Set<string>;
  setCommuteDays: React.Dispatch<React.SetStateAction<Set<string>>>;
  mileageExtraKmByMonth: Record<string, number>;
  setMileageExtraKmByMonth: React.Dispatch<React.SetStateAction<Record<string, number>>>;
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
  initialCommuteDayIsos = [],
  initialMileageExtraKmByMonth = {},
  initialAnnualRevenueTargetHt = null
}: {
  children: ReactNode;
  tjmHt: number;
  billableRatePeriods?: readonly BillableRatePeriod[];
  persistToSupabase: boolean;
  initialWorkDayIsos: string[];
  initialVacationDayIsos?: string[];
  initialCommuteDayIsos?: string[];
  initialMileageExtraKmByMonth?: Record<string, number>;
  initialAnnualRevenueTargetHt?: number | null;
}) {
  const [selected, setSelected] = useState<Set<string>>(() =>
    persistToSupabase ? new Set(initialWorkDayIsos) : new Set()
  );
  const [vacationDays, setVacationDays] = useState<Set<string>>(() =>
    persistToSupabase ? new Set(initialVacationDayIsos) : new Set()
  );
  const [commuteDays, setCommuteDays] = useState<Set<string>>(() => persistToSupabase ? new Set(initialCommuteDayIsos) : new Set());
  const [mileageExtraKmByMonth, setMileageExtraKmByMonth] = useState<Record<string, number>>(() => persistToSupabase ? initialMileageExtraKmByMonth : {});
  const [hydrated, setHydrated] = useState(false);
  const [annualRevenueTargetHt, setAnnualRevenueTargetHt] = useState<number | null>(
    initialAnnualRevenueTargetHt
  );
  const [, startTransition] = useTransition();
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const vacationDaysRef = useRef(vacationDays);
  vacationDaysRef.current = vacationDays;
  const commuteDaysRef = useRef(commuteDays);
  commuteDaysRef.current = commuteDays;
  const mileageExtraRef = useRef(mileageExtraKmByMonth);
  mileageExtraRef.current = mileageExtraKmByMonth;
  const lastPersistedRef = useRef<string | null>(null);
  const lastVacationPersistedRef = useRef<string | null>(null);
  const lastCommutePersistedRef = useRef<string | null>(null);
  const lastMileageExtraPersistedRef = useRef<string | null>(null);
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
  const serverCommuteKey = useMemo(() => [...initialCommuteDayIsos].sort().join("|"), [initialCommuteDayIsos]);
  const serverMileageKey = useMemo(() => JSON.stringify(initialMileageExtraKmByMonth), [initialMileageExtraKmByMonth]);

  useEffect(() => {
    if (persistToSupabase) {
      setSelected(new Set(initialWorkDayIsos));
      setVacationDays(new Set(initialVacationDayIsos));
      setCommuteDays(new Set(initialCommuteDayIsos));
      setMileageExtraKmByMonth(initialMileageExtraKmByMonth);
      lastPersistedRef.current = persistSignature([...initialWorkDayIsos].sort(), tjmHt);
      lastVacationPersistedRef.current = [...initialVacationDayIsos].sort().join(",");
      lastCommutePersistedRef.current = [...initialCommuteDayIsos].sort().join(",");
      lastMileageExtraPersistedRef.current = JSON.stringify(initialMileageExtraKmByMonth);
    } else if (typeof window !== "undefined") {
      setSelected(parseStored(localStorage.getItem(STORAGE_KEY)));
      setVacationDays(parseStored(localStorage.getItem(VACATION_STORAGE_KEY)));
      setCommuteDays(parseStored(localStorage.getItem(COMMUTE_STORAGE_KEY)));
      setMileageExtraKmByMonth(parseMonthlyKm(localStorage.getItem(MILEAGE_EXTRA_STORAGE_KEY)));
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
  }, [persistToSupabase, serverDaysKey, serverVacationDaysKey, serverTargetKey, serverCommuteKey, serverMileageKey, tjmHt, initialAnnualRevenueTargetHt, initialCommuteDayIsos, initialMileageExtraKmByMonth]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined" || persistToSupabase) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected].sort()));
  }, [selected, hydrated, persistToSupabase]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined" || persistToSupabase) return;
    localStorage.setItem(VACATION_STORAGE_KEY, JSON.stringify([...vacationDays].sort()));
  }, [vacationDays, hydrated, persistToSupabase]);
  useEffect(() => { if (hydrated && typeof window !== "undefined" && !persistToSupabase) localStorage.setItem(COMMUTE_STORAGE_KEY, JSON.stringify([...commuteDays].sort())); }, [commuteDays, hydrated, persistToSupabase]);
  useEffect(() => { if (hydrated && typeof window !== "undefined" && !persistToSupabase) localStorage.setItem(MILEAGE_EXTRA_STORAGE_KEY, JSON.stringify(mileageExtraKmByMonth)); }, [mileageExtraKmByMonth, hydrated, persistToSupabase]);

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
  useEffect(() => {
    if (!hydrated || !persistToSupabase) return;
    const sig = [...commuteDaysRef.current].sort().join(",");
    if (sig === lastCommutePersistedRef.current) return;
    const t = setTimeout(() => startTransition(() => { void replaceBillableCommuteDays([...commuteDaysRef.current].sort()).then(() => { lastCommutePersistedRef.current = [...commuteDaysRef.current].sort().join(","); }).catch((e) => toast.error("Enregistrement des trajets voiture impossible", { description: e instanceof Error ? e.message : undefined })); }), 500);
    return () => clearTimeout(t);
  }, [commuteDays, hydrated, persistToSupabase]);
  useEffect(() => {
    if (!hydrated || !persistToSupabase) return;
    const sig = JSON.stringify(mileageExtraRef.current);
    if (sig === lastMileageExtraPersistedRef.current) return;
    const t = setTimeout(() => startTransition(() => { void replaceBillableMileageAdjustments(mileageExtraRef.current).then(() => { lastMileageExtraPersistedRef.current = JSON.stringify(mileageExtraRef.current); }).catch((e) => toast.error("Enregistrement des kilomètres supplémentaires impossible", { description: e instanceof Error ? e.message : undefined })); }), 500);
    return () => clearTimeout(t);
  }, [mileageExtraKmByMonth, hydrated, persistToSupabase]);

  const sortedIsos = useMemo(() => [...selected].sort(), [selected]);

  const overview = useMemo(
    () => computeCurrentMonthOverview(selected, billableRatePeriods, tjmHt),
    [billableRatePeriods, selected, tjmHt]
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
      commuteDays,
      setCommuteDays,
      mileageExtraKmByMonth,
      setMileageExtraKmByMonth,
      hydrated,
      sortedIsos,
      overviewMonthTitle: overview.monthTitle,
      overviewKpis: overview.kpis,
      overviewWorkdayGauge: overview.workdayGauge,
      overviewTjmEnVigueurHt: overview.tjmEnVigueurHt,
      annualRevenueTargetHt,
      setAnnualRevenueTargetHt
    }),
    [tjmHt, billableRatePeriods, persistToSupabase, selected, vacationDays, commuteDays, mileageExtraKmByMonth, hydrated, sortedIsos, overview, annualRevenueTargetHt]
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
