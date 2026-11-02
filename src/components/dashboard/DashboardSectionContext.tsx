"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  type Dispatch, type SetStateAction, type ReactNode
} from "react";
import {createInvestReportLoader} from "@/lib/invest-report-loader";
import type { PiloteExpenseView } from "@/lib/pilote";
import { useSearchParams } from "next/navigation";

export type DashboardSection =
  | "full"
  | "activite"
  | "valeur"
  | "sasu"
  | "private"
  | "impots"
  | "pilote"
  | "courses"
  | "invest"
  | "chat";

export function parseDashboardSection(search: string): DashboardSection {
  const sp = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (sp.get("panel") === "valeur-reelle") return "valeur";
  const s = sp.get("section");
  if (s === "activite") return "activite";
  if (s === "sasu") return "sasu";
  if (s === "private") return "private";
  if (s === "categorisation") return "activite";
  if (s === "courses" || s === "cours") return "courses";
  if (s === "chat") return "chat";
  if (s === "rp") return "invest";
  if (s === "invest") return "invest";
  if (s === "pilote") return "pilote";
  if (s === "impots") return "impots";
  return "full";
}

type DashboardSectionContextValue = {
  piloteExpenseViews: PiloteExpenseView[];
  setPiloteExpenseViews: Dispatch<SetStateAction<PiloteExpenseView[]>>;
  section: DashboardSection;
  investReport:ReturnType<typeof createInvestReportLoader>;
  preloadInvest:()=>void;
  searchParams: URLSearchParams;
  navigateWithinDashboard: (href: string) => void;
};

const DashboardSectionContext = createContext<DashboardSectionContextValue | null>(null);

export function DashboardSectionProvider({ children,demoMode=false }: { children: ReactNode;demoMode?:boolean }) {
  const reportRef=useRef<ReturnType<typeof createInvestReportLoader>|null>(null);
  if(!reportRef.current)reportRef.current=createInvestReportLoader();
  const investReport=reportRef.current;
  const preloadInvest=useCallback(()=>{if(!demoMode)void investReport.load().catch(()=>{});},[demoMode,investReport]);
  useEffect(()=>()=>investReport.clear(),[investReport]);
  const [piloteExpenseViews,setPiloteExpenseViews]=useState<PiloteExpenseView[]>(["essential"]);
  const nextSearchParams = useSearchParams();
  const nextSearch = nextSearchParams.toString();
  const [urlSearch, setUrlSearch] = useState(() => (nextSearch ? `?${nextSearch}` : ""));

  useEffect(() => {
    const sync = () => setUrlSearch(window.location.search);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const target = nextSearch ? `?${nextSearch}` : "";
    // Sync when Next.js router and the URL bar agree (Link / soft navigation).
    // pushState updates are handled directly by navigateWithinDashboard.
    if (window.location.search === target) {
      setUrlSearch(target);
    }
  }, [nextSearch]);

  const searchParams = useMemo(
    () => new URLSearchParams(urlSearch.startsWith("?") ? urlSearch.slice(1) : urlSearch),
    [urlSearch]
  );
  const section = useMemo(() => parseDashboardSection(urlSearch), [urlSearch]);

  const navigateWithinDashboard = useCallback((href: string) => {
    const url = new URL(href, window.location.origin);
    const nextSearch = url.search;
    window.history.pushState(null, "", `${url.pathname}${nextSearch}`);
    setUrlSearch(nextSearch);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  const value = useMemo(
    () => ({ section, searchParams, navigateWithinDashboard, piloteExpenseViews, setPiloteExpenseViews,investReport,preloadInvest }),
    [section, searchParams, navigateWithinDashboard, piloteExpenseViews,investReport,preloadInvest]
  );

  return <DashboardSectionContext.Provider value={value}>{children}</DashboardSectionContext.Provider>;
}

export function useDashboardSection() {
  const ctx = useContext(DashboardSectionContext);
  if (!ctx) {
    throw new Error("useDashboardSection must be used within DashboardSectionProvider");
  }
  return ctx;
}

export function useOptionalDashboardSection() {
  return useContext(DashboardSectionContext);
}
