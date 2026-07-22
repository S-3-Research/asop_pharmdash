"use client";

import { useMemo } from "react";

import type { ApiListing, MetricCardData } from "../../types";
import { MetricCard } from "../../ui/metric-card";
import { SelectableCard } from "../../ui/selectable-card";
import { useWidgetData } from "../../copilot/copilot-context";

interface MetricsRowProps {
  filteredListings: ApiListing[];
  selectedPrimaryName: string | null;
  /** Label for the most recent rpt. period present in the dataset */
  currentPeriodLabel: string;
}

/** Wraps a single metric card so each one can publish its own live data. */
function SelectableMetric({
  item,
  prompt,
}: {
  item: MetricCardData;
  prompt: string;
}) {
  useWidgetData(
    `top-products-${item.id}`,
    [{ label: item.label, value: item.value }],
    prompt,
  );
  return (
    <SelectableCard
      className="h-full"
      widget={{
        widgetId: `top-products-${item.id}`,
        title: item.label,
        type: "metric-card",
        description: `Listing count metric for the current rpt. period`,
      }}
    >
      <MetricCard item={item} />
    </SelectableCard>
  );
}

export function MetricsRow({ filteredListings, selectedPrimaryName, currentPeriodLabel }: MetricsRowProps) {
  const metrics = useMemo((): MetricCardData[] => {
    const total = filteredListings.length;
    const online = filteredListings.filter((l) => l.source === "online").length;
    const social = filteredListings.filter((l) => l.source === "social").length;

    return [
      {
        id: "total-listings",
        label: selectedPrimaryName
          ? `${selectedPrimaryName} Listings`
          : `${currentPeriodLabel} Total Listings`,
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
  }, [filteredListings, selectedPrimaryName, currentPeriodLabel]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <SelectableMetric
        item={metrics[0]}
        prompt={
          "Single metric: total illegal pharmaceutical listings detected in the current reporting period" +
          (selectedPrimaryName ? ` for the '${selectedPrimaryName}' category` : "") +
          ". Data source: listing records in the published data release (online marketplaces + social platforms), after the page's category filter."
        }
      />
      <SelectableMetric
        item={metrics[1]}
        prompt={
          "Single metric: split of listings by source — 'online' (e-commerce/marketplace sites) vs 'social' (social media platforms), shown as online / social. " +
          "Data source: the source field of each listing record in the published data release, after the page's category filter."
        }
      />
    </div>
  );
}
