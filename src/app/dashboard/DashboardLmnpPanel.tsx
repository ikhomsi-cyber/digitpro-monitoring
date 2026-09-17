"use client";

import dynamic from "next/dynamic";
import { DashboardSkeleton } from "@/components/ui/Skeleton";

// Le découpage d'un composant client doit partir d'une frontière client pour
// éviter d'inclure LMNP et Recharts dans le chargement initial du dashboard.
export const DashboardLmnpPanel = dynamic(
  () => import("@/app/lmnp/LMNPClient").then((mod) => mod.LMNPClient),
  { loading: () => <DashboardSkeleton className="h-96 w-full rounded-3xl" /> }
);
