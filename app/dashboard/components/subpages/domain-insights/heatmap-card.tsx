"use client";

import dynamic from "next/dynamic";
import { DashboardCard } from "../../ui/dashboard-card";
import { KeyTakeaway } from "../../ui/key-takeaway";
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
  /** Currently-selected primary-category filters (from the page's multi-
   *  select dropdown) — passed through so point coloring can reflect the
   *  selection when 2+ categories are active (see heatmap-map-client). */
  selectedCategories?: string[];
}

export function HeatmapCard({ domains, selectedCategories }: HeatmapCardProps) {
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
    "Geographic heatmap (Mapbox) of where the rogue domains are located; the underlying data format is one point per domain with a geoLocation object " +
      "(city, country, lat/lng), plus per-domain category/status/registrar/payment fields shown when hovering a point. " +
      "The data points above are aggregated by CITY for convenience — each value is the number of domains geolocated to that city (from geoLocation.city). " +
      "On hover, the tooltip's top-right corner shows the domain's CITY (geoLocation.city field) next to the live/offline status dot; the tooltip body also lists category, registrar, and purported payment info for that single domain. " +
      "Data source: each domain record's geoLocation (city, country, lat/lng) from the published data release, resolved using a fallback priority order: " +
      "(1) the domain's listed business address, if available; (2) otherwise the WHOIS registration address (registrant street/city/state/country); " +
      "(3) otherwise other proxy signals such as the phone number's area/country code. " +
      "Counts reflect the page's current category filter.",
  );

  return (
    <DashboardCard
      title="Domain Heatmap"
      className="h-full flex flex-col overflow-hidden"
      note={
        <KeyTakeaway>
          3 metro areas account for most geolocated domains. (example data)
        </KeyTakeaway>
      }
    >
      <div className="flex-1 min-h-0 relative -mx-4 -mb-4 rounded-b-xl overflow-hidden">
        <HeatmapMapClient domains={domains} selectedCategories={selectedCategories} />
      </div>
    </DashboardCard>
  );
}
