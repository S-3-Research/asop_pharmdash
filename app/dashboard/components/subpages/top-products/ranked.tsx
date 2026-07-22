"use client";

import { useMemo } from "react";

import type { ApiListing, RankedItem } from "../../types";
import { RankedListCard } from "../../ranked-list-card";
import { useWidgetData } from "../../copilot/copilot-context";

interface TopProductsRankedProps {
  filteredListings: ApiListing[];
  selectedPrimaryName: string | null;
  /** Label for the most recent rpt. period present in the dataset */
  currentPeriodLabel: string;
}

export function TopProductsRanked({
  filteredListings,
  selectedPrimaryName,
  currentPeriodLabel,
}: TopProductsRankedProps) {
  const rankedItems = useMemo((): RankedItem[] => {
    const counts: Record<string, number> = {};
    for (const l of filteredListings) {
      counts[l.secondaryCategory] = (counts[l.secondaryCategory] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({
        id: name,
        name,
        value: `${count} listings`,
        change: null,
        direction: null,
      }));
  }, [filteredListings]);

  // Report the FULL product ranking (not just the top-5 shown on screen)
  const allCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of filteredListings)
      counts[l.secondaryCategory] = (counts[l.secondaryCategory] ?? 0) + 1;
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([label, value]) => ({ label, value }));
  }, [filteredListings]);
  useWidgetData(
    "top-products-ranked",
    allCounts,
    "Ranked list of products (secondary drug categories) by number of illegal listings in the current reporting period. " +
      "The on-screen card shows only the top 5, but the data points here contain the complete ranking. " +
      "Data source: listing records in the published data release, grouped by secondaryCategory, after the page's category filter.",
  );

  return (
    <RankedListCard
      title={
        selectedPrimaryName
          ? `${selectedPrimaryName} — Top Products`
          : "Top Ranked Products"
      }
      subtitle={`Listings by product · ${currentPeriodLabel}`}
      items={rankedItems}
    />
  );
}
