"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import useSWR from "swr";

import type { ApiListing, CategoryOption, PieChartNodeData } from "../types";
import { CategoryDropdown } from "../ui/category-dropdown";
import { useCopilot } from "../copilot/copilot-context";
import type { FilterAction } from "../copilot/types";
import { SelectableCard } from "../ui/selectable-card";
import { MetricsRow } from "./top-products/metrics-row";
import { TopProductsRanked } from "./top-products/ranked";
import { ListingTrendChart } from "./top-products/trend-chart";
import { ProductDistribution } from "./top-products/distribution";
import { formatRptPeriodLabel, parseRptPeriodKey } from "./top-products/config";

// ── API response shape ────────────────────────────────────────────────────────
interface TopProductsPayload {
  title: string;
  summary: string;
  categories: CategoryOption[];
  drillablePieData: PieChartNodeData[];
  listings: ApiListing[];
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch listings");
    return r.json() as Promise<TopProductsPayload>;
  });

// ── Component ─────────────────────────────────────────────────────────────────
export function TopProductsSubpage() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const { updatePageContext, registerFilterHandler } = useCopilot();

  const { data, error, isLoading } = useSWR<TopProductsPayload>(
    "/api/listings/top-products",
    fetcher,
    { revalidateOnFocus: false },
  );

  // Resolve category option id (e.g. "glp-1") → primaryCategory name (e.g. "GLP-1")
  const selectedPrimaryName = useMemo(() => {
    if (selectedCategoryId === "all" || !data) return null;
    return data.categories.find((c) => c.id === selectedCategoryId)?.name ?? null;
  }, [selectedCategoryId, data]);

  // Filter listings by selected category
  const filteredListings = useMemo((): ApiListing[] => {
    if (!data?.listings) return [];
    if (!selectedPrimaryName) return data.listings;
    return data.listings.filter((l) => l.primaryCategory === selectedPrimaryName);
  }, [data?.listings, selectedPrimaryName]);

  // Derived from full dataset so x-axis stays stable across filter changes
  const allRptPeriodKeys = useMemo((): string[] => {
    const keys = [...new Set((data?.listings ?? []).map((l) => l.reportingPeriodId))];
    return keys.sort((a, b) => parseRptPeriodKey(a).getTime() - parseRptPeriodKey(b).getTime());
  }, [data?.listings]);

  // The most recent rpt. period actually present in the data — derived from
  // the release name itself rather than a hardcoded constant, so card labels
  // automatically track whatever release is published.
  const currentPeriodLabel = useMemo(() => {
    const latest = allRptPeriodKeys[allRptPeriodKeys.length - 1];
    return latest ? formatRptPeriodLabel(latest) : "";
  }, [allRptPeriodKeys]);

  // Real, dynamically-derived category list (excludes the "all" pseudo-option
  // used only by the dropdown filter).
  const realCategories = useMemo(
    () => (data?.categories ?? []).filter((c) => c.id !== "all"),
    [data?.categories],
  );

  // ── Register filter handler for Copilot ──────────────────────────────────
  const applyFilter = useCallback(
    (action: FilterAction) => {
      if (action.type === "SET_CATEGORIES" && data) {
        const matched = data.categories.find((c) =>
          action.categories.includes(c.name),
        );
        setSelectedCategoryId(matched?.id ?? "all");
      } else if (action.type === "CLEAR_FILTERS") {
        setSelectedCategoryId("all");
      }
    },
    [data],
  );

  useEffect(() => {
    registerFilterHandler(applyFilter);
  }, [registerFilterHandler, applyFilter]);

  // ── Sync page context ────────────────────────────────────────────────────
  useEffect(() => {
    updatePageContext({
      filters: {
        categories: selectedPrimaryName ? [selectedPrimaryName] : [],
      },
      stats: [
        {
          label: "Total Listings",
          value: filteredListings.length,
        },
        {
          label: "Online",
          value: filteredListings.filter((l) => l.source === "online").length,
        },
        {
          label: "Social",
          value: filteredListings.filter((l) => l.source === "social").length,
        },
      ],
    });
  }, [updatePageContext, selectedPrimaryName, filteredListings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Loading…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 text-sm">
        Failed to load data. Please try again.
      </div>
    );
  }

  return (
    <section>
      <div className="mb-6">
        <div className="flex flex-col justify-between items-start gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{data.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{data.summary}</p>
          </div>
          {data.categories.length > 0 && (
            <div className="w-full sm:w-auto min-w-xs">
              <CategoryDropdown
                categories={data.categories}
                selectedId={selectedCategoryId}
                onSelect={setSelectedCategoryId}
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 items-stretch">
        {/* Left column */}
        <div className="col-span-12 flex flex-col gap-6 lg:col-span-6">
          <MetricsRow
            filteredListings={filteredListings}
            selectedPrimaryName={selectedPrimaryName}
            currentPeriodLabel={currentPeriodLabel}
          />
          <div className="flex-1 grid">
            <SelectableCard
              className="h-full"
              widget={{
                widgetId: "top-products-ranked",
                title: selectedPrimaryName ? `${selectedPrimaryName} — Top Products` : "Top Ranked Products",
                type: "ranked-list",
                description: "Products ranked by listing count in the current rpt. period",
                dataPoints: filteredListings
                  .reduce<Record<string, number>>((acc, l) => {
                    acc[l.secondaryCategory] = (acc[l.secondaryCategory] ?? 0) + 1;
                    return acc;
                  }, {})
                  ? Object.entries(
                      filteredListings.reduce<Record<string, number>>((acc, l) => {
                        acc[l.secondaryCategory] = (acc[l.secondaryCategory] ?? 0) + 1;
                        return acc;
                      }, {})
                    )
                    .sort(([,a],[,b]) => b - a)
                    .slice(0, 5)
                    .map(([name, count]) => ({ label: name, value: count }))
                  : [],
              }}
            >
              <TopProductsRanked
                filteredListings={filteredListings}
                selectedPrimaryName={selectedPrimaryName}
                currentPeriodLabel={currentPeriodLabel}
              />
            </SelectableCard>
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-12 flex flex-col gap-6 lg:col-span-6">
          <SelectableCard
            widget={{
              widgetId: "top-products-trend",
              title: selectedPrimaryName ? `${selectedPrimaryName} — Listing Trend` : "Listing Trend",
              type: "chart",
              description: "Listing volume trend across rpt. periods by category",
            }}
          >
            <ListingTrendChart
              filteredListings={filteredListings}
              allRptPeriodKeys={allRptPeriodKeys}
              selectedPrimaryName={selectedPrimaryName}
              categories={realCategories}
              currentPeriodLabel={currentPeriodLabel}
            />
          </SelectableCard>
          <SelectableCard
            widget={{
              widgetId: "top-products-distribution",
              title: "Product Distribution",
              type: "distribution",
              description: "Sunburst chart showing category and product breakdown",
            }}
          >
            <ProductDistribution
              drillablePieData={data.drillablePieData}
              categories={data.categories}
              selectedCategoryId={selectedCategoryId}
              onCategorySelect={setSelectedCategoryId}
              periodLabel={currentPeriodLabel}
            />
          </SelectableCard>
        </div>
      </div>
    </section>
  );
}

