"use client";

import { useMemo } from "react";

import type { ApiListing, RankedItem } from "../../types";
import { RankedListCard } from "../../ranked-list-card";
import { CURRENT_PERIOD } from "./config";

interface TopProductsRankedProps {
  filteredListings: ApiListing[];
  selectedPrimaryName: string | null;
}

export function TopProductsRanked({
  filteredListings,
  selectedPrimaryName,
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

  return (
    <RankedListCard
      title={
        selectedPrimaryName
          ? `${selectedPrimaryName} — Top Products`
          : "Top Ranked Products"
      }
      subtitle={`Listings by product · ${CURRENT_PERIOD}`}
      items={rankedItems}
    />
  );
}
