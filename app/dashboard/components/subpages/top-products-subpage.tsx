"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";

import type { ApiListing, CategoryOption, PieChartNodeData } from "../types";
import { CategoryDropdown } from "../ui/category-dropdown";
import { MetricsRow } from "./top-products/metrics-row";
import { TopProductsRanked } from "./top-products/ranked";
import { ListingTrendChart } from "./top-products/trend-chart";
import { ProductDistribution } from "./top-products/distribution";
import { parseCbuKey } from "./top-products/config";

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
  const allCbuKeys = useMemo((): string[] => {
    const keys = [...new Set((data?.listings ?? []).map((l) => l.cbuId))];
    return keys.sort((a, b) => parseCbuKey(a).getTime() - parseCbuKey(b).getTime());
  }, [data?.listings]);

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
          />
          <div className="flex-1 grid">
            <TopProductsRanked
              filteredListings={filteredListings}
              selectedPrimaryName={selectedPrimaryName}
            />
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-12 flex flex-col gap-6 lg:col-span-6">
          <ListingTrendChart
            filteredListings={filteredListings}
            allCbuKeys={allCbuKeys}
            selectedPrimaryName={selectedPrimaryName}
          />
          <ProductDistribution
            drillablePieData={data.drillablePieData}
            categories={data.categories}
            selectedCategoryId={selectedCategoryId}
            onCategorySelect={setSelectedCategoryId}
          />
        </div>
      </div>
    </section>
  );
}

