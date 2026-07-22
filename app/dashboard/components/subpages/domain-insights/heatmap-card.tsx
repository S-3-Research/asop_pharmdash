"use client";

import dynamic from "next/dynamic";
import { DashboardCard } from "../../ui/dashboard-card";
import { useWidgetData } from "../../copilot/copilot-context";
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
  const cityCounts: Record<string, number> = {};
  for (const d of domains) {
    const city = d.geoLocation?.city;
    if (city) cityCounts[city] = (cityCounts[city] ?? 0) + 1;
  }
  useWidgetData(
    "domain-heatmap",
    Object.entries(cityCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value })),
    "Geographic heatmap (Mapbox) of where the rogue domains are hosted/located, aggregated by city; each value is the number of domains geolocated to that city. " +
      "Data source: each domain record's geoLocation (city, country, lat/lng) from the published data release, based on business address listed or other available location information such as whois registration details. " +
      "Counts reflect the page's current category filter.",
  );

  return (
    <DashboardCard title="Domain Heatmap" className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 relative -mx-4 -mb-4 rounded-b-xl overflow-hidden">
        <HeatmapMapClient domains={domains} />
      </div>
    </DashboardCard>
  );
}
