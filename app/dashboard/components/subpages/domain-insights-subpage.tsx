"use client";

import { useState, useMemo, useEffect, useCallback } from "react";

import useSWR from "swr";
import type { DomainApiPayload, DomainWithMatch } from "../types";
import { MultiCategoryDropdown } from "../ui/multi-category-dropdown";
import { useCopilot } from "../copilot/copilot-context";
import type { FilterAction } from "../copilot/types";
import { buildDomainCategoryOptions } from "./domain-insights/config";
import { DomainSummaryStrip }  from "./domain-insights/domain-summary-strip";
import { TotalDomainCard }    from "./domain-insights/total-domain-card";
import { DomainStatusCard }   from "./domain-insights/domain-status-card";
import { SocialMediaCard }    from "./domain-insights/social-media-card";
import { PaymentTreemapCard } from "./domain-insights/payment-treemap-card";
import { RegistrarSunburst }  from "./domain-insights/registrar-sunburst";
import { TrafficChart }       from "./domain-insights/traffic-chart";
import { HeatmapCard }        from "./domain-insights/heatmap-card";
import { DomainExamplesCard } from "./domain-insights/domain-examples-card";
import { SelectableCard }     from "../ui/selectable-card";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to load domain data");
    return r.json() as Promise<DomainApiPayload>;
  });

export function DomainInsightsSubpage() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const { updatePageContext, registerFilterHandler } = useCopilot();
  const { data, error, isLoading } = useSWR<DomainApiPayload>(
    "/api/domains",
    fetcher,
    { revalidateOnFocus: false },
  );

  const filteredDomains = useMemo((): DomainWithMatch[] => {
    const domains = data?.domains ?? [];
    // Every card on this subpage shares the same rule: a domain counts if
    // ANY of its categories intersects the selected filter set (or always,
    // when no filter is selected). `matchCount` is exposed so cards that
    // want a weight (e.g. the geo heatmap) can use it instead of a plain
    // boolean include/exclude.
    if (selectedCategories.length === 0) {
      return domains.map((d) => ({ ...d, matchCount: d.categories.length || 1 }));
    }
    return domains
      .map((d) => ({
        ...d,
        matchCount: d.domainProductCategories.filter((c) =>
          selectedCategories.includes(c),
        ).length,
      }))
      .filter((d) => d.matchCount > 0);
  }, [data?.domains, selectedCategories]);

  // Dynamically derived from the full (unfiltered) dataset so the dropdown
  // always offers every category present in the current release, not a
  // hardcoded 4-value list.
  const categoryOptions = useMemo(
    () => data?.categoryOptions ?? buildDomainCategoryOptions(data?.domains ?? []),
    [data?.categoryOptions, data?.domains],
  );

  function handleToggle(id: string) {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  // ── Register filter handler for Copilot ──────────────────────────────────
  const applyFilter = useCallback((action: FilterAction) => {
    if (action.type === "SET_CATEGORIES") {
      // Copilot uses primaryCategory names; categories state stores the same
      setSelectedCategories(action.categories);
    } else if (action.type === "CLEAR_FILTERS") {
      setSelectedCategories([]);
    }
  }, []);

  useEffect(() => {
    registerFilterHandler(applyFilter);
  }, [registerFilterHandler, applyFilter]);

  // ── Sync page context ────────────────────────────────────────────────────
  useEffect(() => {
    const live = filteredDomains.filter((d) => d.isLive).length;
    updatePageContext({
      page: "domain-insights",
      pageTitle: "Domain Insights",
      // Reporting period straight from the release name (channel pointer).
      // Mock data carries no release — label it as such, no derivation.
      reportingPeriod: data?.reportingPeriodId || "mock-data",
      reportingPeriodDisplayName: data?.reportingPeriodDisplayName || undefined,
      filters: { categories: selectedCategories },
      availableFilters: {
        categories: categoryOptions.map((c) => c.name),
        categorySelectionMode: "multi",
        // Domain Insights has no platform filter — omit `platforms` entirely
        // so the Copilot never proposes a platform change on this page.
      },
      stats: [
        { label: "Total Domains", value: filteredDomains.length },
        { label: "Live", value: live },
        { label: "Inactive", value: filteredDomains.length - live },
      ],
    });
  }, [updatePageContext, selectedCategories, filteredDomains, data?.reportingPeriodId, data?.reportingPeriodDisplayName, categoryOptions]);

  return (
    <section>
      {/* ── Header ── */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-800">Domain Insights</h2>
        <p className="mt-1 text-sm text-slate-500">
          Monitoring and analysis of rogue pharmacy domains across registrars,
          platforms, and geographies.
        </p>
      </div>

      {/* Persistent, all-category snapshot — deliberately independent of the
          category filter below, so it always reflects the full dataset
          (mirrors OverallSummaryStrip on the Top Products page). */}
      <div className="mb-4">
        <DomainSummaryStrip allDomains={data?.domains ?? []} />
      </div>

      {/* Category filter is a chart-level control (scopes every card below),
          kept visually close to the grid it affects rather than up near the
          page title — same placement/style as the Top Products page. */}
      {categoryOptions.length > 0 && (
        <div className="mb-4 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Chart Filter
          </span>
          <div className="w-full sm:w-auto sm:min-w-xs">
            <MultiCategoryDropdown
              categories={categoryOptions}
              selectedIds={selectedCategories}
              onToggle={handleToggle}
              onClear={() => setSelectedCategories([])}
            />
          </div>
        </div>
      )}

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

      {/* ── Dashboard grid — left: 3+3+1 chart grid, right: Domain Examples ── */}
      {!isLoading && !error && (
        <div className="grid grid-cols-12 gap-4 items-stretch">
          {/* Left column — 7/12 width, charts in 3 rows (3, 3, 1) */}
          <div className="col-span-12 xl:col-span-7 grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[250px]">
            {/* Row 1 */}
            <SelectableCard
              widget={{
                widgetId: "domain-total",
                title: "Total Domain",
                type: "chart",
                description: "Bar chart comparing total rogue domains detected against how many are still live, one bar pair per reporting period. Use it to see whether rogue-domain activity is growing or shrinking period over period.",
              }}
            >
              <TotalDomainCard domains={filteredDomains} periodLabels={data?.reportingPeriodLabels ?? {}} />
            </SelectableCard>

            <SelectableCard
              widget={{
                widgetId: "domain-status",
                title: "Domain Status",
                type: "chart",
                description: "Shows how many detected rogue domains are still live versus already taken down, broken down by drug type. A quick read on how much of what's been found is still active.",
              }}
            >
              <DomainStatusCard domains={filteredDomains} />
            </SelectableCard>

            <SelectableCard
              widget={{
                widgetId: "domain-social-media",
                title: "Social Media Platforms",
                type: "distribution",
                description: "Shows which social media platforms the rogue domains themselves use to promote or sell — their own outreach/storefront profiles, not where selling posts were detected. Larger bubbles mean more domains maintain a presence on that platform.",
              }}
            >
              <SocialMediaCard domains={filteredDomains} />
            </SelectableCard>

            {/* Row 2 */}
            <SelectableCard
              widget={{
                widgetId: "domain-payment",
                title: "Payment Methods",
                type: "chart",
                description: "Breaks down the payment methods rogue domains claim to accept, such as credit card, crypto, or bank transfer. Larger blocks indicate payment types offered more frequently across domains.",
              }}
            >
              <PaymentTreemapCard domains={filteredDomains} />
            </SelectableCard>

            <SelectableCard
              widget={{
                widgetId: "domain-registrar",
                title: "Registrar Distribution",
                type: "distribution",
                description: "Shows which domain registrars host the most rogue pharmacy domains. Helps identify registrars that may warrant closer scrutiny or outreach.",
              }}
            >
              <RegistrarSunburst domains={filteredDomains} />
            </SelectableCard>

            <SelectableCard
              widget={{
                widgetId: "domain-traffic",
                title: "Traffic Chart",
                type: "chart",
                description: "Tracks average website traffic (organic plus paid search clicks) over time, based on the category-filtered set of domains that have historical traffic data available. Use the range toggle to see whether traffic is trending up or down.",
              }}
            >
              <TrafficChart domains={filteredDomains} />
            </SelectableCard>

            {/* Row 3 — map, full width of the left column */}
            <div className="col-span-1 md:col-span-3 flex flex-col">
              <SelectableCard
                className="h-full flex flex-col"
                widget={{
                  widgetId: "domain-heatmap",
                  title: "Geographic Map",
                  type: "map",
                  description: "Maps where rogue domains are physically located, based on business address, domain registration info, or other available signals. Each point represents a domain, colored by category.",
                }}
              >
                <HeatmapCard domains={filteredDomains} selectedCategories={selectedCategories} />
              </SelectableCard>
            </div>
          </div>

          {/* Right column — 5/12 width, Domain Samples spans the full height.
              max-h is pinned to the left column's intrinsic height (3 rows *
              250px + 2 * 16px gaps = 782px) — without an explicit cap here,
              this column has no height of its own, so when the grid computes
              this row's auto height it uses DomainExamplesCard's full,
              un-scrolled content height (all N sampled domains rendered),
              which stretches the *whole* row (including the left column via
              items-stretch) instead of being clipped to it. Keep this in
              sync with the left grid's `auto-rows-[250px]` above. */}
          <div className="col-span-12 xl:col-span-5 xl:max-h-[782px] overflow-hidden">
            <SelectableCard
              className="h-full"
              widget={{
                widgetId: "domain-samples",
                title: "Domain Samples",
                type: "table",
                description: "A sample list of individual rogue domains \u2014 expand any entry to see registrar, payment, ad spend, and social details. Use it to see concrete examples behind the aggregate charts on this page.",
              }}
            >
              <DomainExamplesCard domains={filteredDomains} periodLabels={data?.reportingPeriodLabels ?? {}} />
            </SelectableCard>
          </div>
        </div>
      )}
    </section>
  );
}
