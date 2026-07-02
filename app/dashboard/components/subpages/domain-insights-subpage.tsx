"use client";

import { useState, useMemo } from "react";

import useSWR from "swr";
import type { DomainApiPayload } from "../types";
import { MultiCategoryDropdown } from "../ui/multi-category-dropdown";
import { DOMAIN_PRIMARY_CATEGORIES } from "./domain-insights/config";
import { TotalDomainCard }    from "./domain-insights/total-domain-card";
import { DomainStatusCard }   from "./domain-insights/domain-status-card";
import { SocialMediaCard }    from "./domain-insights/social-media-card";
import { PaymentTreemapCard } from "./domain-insights/payment-treemap-card";
import { RegistrarSunburst }  from "./domain-insights/registrar-sunburst";
import { TrafficChart }       from "./domain-insights/traffic-chart";
import { HeatmapCard }        from "./domain-insights/heatmap-card";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to load domain data");
    return r.json() as Promise<DomainApiPayload>;
  });

export function DomainInsightsSubpage() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const { data, error, isLoading } = useSWR<DomainApiPayload>(
    "/api/domains",
    fetcher,
    { revalidateOnFocus: false },
  );

  const filteredDomains = useMemo(
    () =>
      selectedCategories.length === 0
        ? (data?.domains ?? [])
        : (data?.domains ?? []).filter((d) =>
            selectedCategories.includes(d.primaryCategory),
          ),
    [data?.domains, selectedCategories],
  );

  function handleToggle(id: string) {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  return (
    <section>
      {/* ── Header ── */}
      <div className="mb-6 flex flex-col justify-between items-start gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Domain Insights</h2>
          <p className="mt-1 text-sm text-slate-500">
            Monitoring and analysis of rogue pharmacy domains across registrars,
            platforms, and geographies.
          </p>
        </div>
        <div className="w-full sm:w-auto min-w-[200px]">
          <MultiCategoryDropdown
            categories={DOMAIN_PRIMARY_CATEGORIES}
            selectedIds={selectedCategories}
            onToggle={handleToggle}
            onClear={() => setSelectedCategories([])}
          />
        </div>
      </div>

      {/* ── Loading state ── */}
      {isLoading && (
        <div className="text-sm text-slate-400 text-center py-12">Loading domain data…</div>
      )}

      {/* ── Error state ── */}
      {error && (
        <div className="text-sm text-rose-500 text-center py-12">
          Failed to load domain data. Please try again.
        </div>
      )}

      {/* ── Dashboard grid — mirrors dashboardlayout.tsx ── */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 auto-rows-[300px]">

          {/* Row 1 — four equal cards */}
          <TotalDomainCard    domains={filteredDomains} />
          <DomainStatusCard   domains={filteredDomains} />
          <SocialMediaCard    domains={filteredDomains} />
          <PaymentTreemapCard domains={filteredDomains} />

          {/* Row 2 — two single + one double-wide */}
          <RegistrarSunburst domains={filteredDomains} />
          <TrafficChart      domains={filteredDomains} />
          <div className="col-span-1 md:col-span-2 xl:col-span-2 flex flex-col">
            <HeatmapCard domains={filteredDomains} />
          </div>

        </div>
      )}
    </section>
  );
}
