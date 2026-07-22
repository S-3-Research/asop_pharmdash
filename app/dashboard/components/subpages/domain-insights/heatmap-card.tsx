"use client";

import dynamic from "next/dynamic";
import { DashboardCard } from "../../ui/dashboard-card";
import type { Domain, DomainWithMatch } from "../../types";

// Load the mapbox component client-side only — avoids SSR issues and
// eliminates the async-import-in-useEffect race condition in Strict Mode.
const HeatmapMapClient = dynamic(
  () => import("./heatmap-map-client").then((m) => ({ default: m.HeatmapMapClient })),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 bg-slate-100 animate-pulse rounded-b-xl" />
    ),
  },
);

interface HeatmapCardProps {
  domains: (Domain | DomainWithMatch)[];
}

export function HeatmapCard({ domains }: HeatmapCardProps) {
  return (
    <DashboardCard title="Domain Heatmap" className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 relative -mx-4 -mb-4 rounded-b-xl overflow-hidden">
        <HeatmapMapClient domains={domains} />
      </div>
    </DashboardCard>
  );
}
