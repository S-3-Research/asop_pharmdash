"use client";

import { useMemo } from "react";

import type { ApiListing, MetricCardData } from "../../types";
import { MetricCard } from "../../ui/metric-card";
import { SelectableCard } from "../../ui/selectable-card";
import { CURRENT_PERIOD } from "./config";

interface MetricsRowProps {
  filteredListings: ApiListing[];
  selectedPrimaryName: string | null;
}

export function MetricsRow({ filteredListings, selectedPrimaryName }: MetricsRowProps) {
  const metrics = useMemo((): MetricCardData[] => {
    const total = filteredListings.length;
    const online = filteredListings.filter((l) => l.source === "online").length;
    const social = filteredListings.filter((l) => l.source === "social").length;

    return [
      {
        id: "total-listings",
        label: selectedPrimaryName
          ? `${selectedPrimaryName} Listings`
          : `${CURRENT_PERIOD} Total Listings`,
        value: total.toLocaleString(),
        change: null,
        direction: null,
      },
      {
        id: "online-vs-social",
        label: "Online vs Social",
        value: `${online} / ${social}`,
        change: null,
        direction: null,
      },
    ];
  }, [filteredListings, selectedPrimaryName]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {metrics.map((item) => (
        <SelectableCard
          key={item.id}
          className="h-full"
          widget={{
            widgetId: `top-products-${item.id}`,
            title: item.label,
            type: "metric-card",
            description: `Listing count metric for the current CBU window`,
            dataPoints: [{ label: item.label, value: item.value }],
          }}
        >
          <MetricCard item={item} />
        </SelectableCard>
      ))}
    </div>
  );
}
