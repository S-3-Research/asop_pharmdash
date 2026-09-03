"use client";

import dynamic from "next/dynamic";
import { DashboardCard } from "../../ui/dashboard-card";
import { KeyTakeaway, KEY_TAKEAWAY_SUPPRESSED } from "../../ui/key-takeaway";
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
    "Geographic map (Mapbox) of where the rogue domains are located; the underlying data format is one point per domain with a geoLocation object " +
      "(city, country, lat/lng), plus per-domain category/status/registrar/payment fields shown when hovering a point. " +
      "The data points above are aggregated by CITY for convenience — each value is the number of domains geolocated to that city (from geoLocation.city). " +
      "On hover, the tooltip's top-right corner shows the domain's CITY (geoLocation.city field) next to the live/offline status dot; the tooltip body also lists category, registrar, and purported payment info for that single domain. " +
      "Data source: each domain record's geoLocation (city, country, lat/lng) from the published data release, resolved using a fallback priority order: " +
      "(1) the domain's listed business address, if available; (2) otherwise the WHOIS registration address (registrant street/city/state/country); " +
      "(3) otherwise other proxy signals such as the phone number's area/country code. " +
      "Counts reflect the page's current category filter. " +
      "Point SIZE encodes product count, not domain count: when no category filter is active, a domain's point size is proportional to its total number of products (categories[].length); when one or more categories are selected, point size instead reflects only the count of that domain's products matching the selected categories (so a domain selling 5 GLP-1 products but only 1 Cancer Med product will render larger when 'GLP-1' is selected than when 'Cancer Med' is selected). " +
      "Point COLOR reflects the domain's primary category (from primaryCategories, sourced from the domain-level product_label field) \u2014 when multiple categories are selected and a domain matches more than one of them, the color highlights whichever of its own categories is first among the selected set. " +
      "Nearby points that are very close together (often domains sharing a city-level fallback coordinate) are grouped into a single numbered cluster circle at lower zoom levels; zooming in (or clicking a cluster) expands it into individual domain points. " +
      "The tooltip's city value is shown as 'Approximate Location' instead of the raw WHOIS city string when that string looks like a privacy-redaction placeholder (e.g. 'REDACTED FOR PRIVACY', 'N/a', 'Not Disclosed') rather than an actual place name \u2014 this is common since much WHOIS contact data is privacy-shielded.",
  );

  return (
    <DashboardCard
      title="Domain Map"
      className="h-full flex flex-col overflow-hidden"
      note={
        KEY_TAKEAWAY_SUPPRESSED ? undefined : (
          <KeyTakeaway>
            3 metro areas account for most geolocated domains. (example data)
          </KeyTakeaway>
        )
      }
    >
      <div className="flex-1 min-h-0 relative -mx-4 rounded-xl overflow-hidden">
        <HeatmapMapClient domains={domains} selectedCategories={selectedCategories} />
      </div>
    </DashboardCard>
  );
}
