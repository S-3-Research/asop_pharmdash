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
  description,
}: {
  item: MetricCardData;
  prompt: string;
  description: string;
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
        description,
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
        label: "Total Product Listings",
        value: total.toLocaleString(),
        change: null,
        direction: null,
      },
      {
        id: "online-listings",
        label: "Online Listings",
        value: online.toLocaleString(),
        change: null,
        direction: null,
      },
      {
        id: "social-listings",
        label: "Social Listings",
        value: social.toLocaleString(),
        change: null,
        direction: null,
      },
    ];
  }, [filteredListings, selectedPrimaryName, currentPeriodLabel]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <SelectableMetric
        item={metrics[0]}
        prompt={
          "Single metric: total illegal pharmaceutical listings detected in the current reporting period" +
          (selectedPrimaryName ? ` for the '${selectedPrimaryName}' category` : "") +
          ". Data source: listing records in the published data release (online marketplaces + social platforms), after the page's category filter."
        }
        description="Total number of illegal pharmaceutical listings detected this reporting period, across both online marketplaces and social media."
      />
      <SelectableMetric
        item={metrics[1]}
        prompt={
          "Single metric: illegal pharmaceutical listings detected on online marketplaces/e-commerce sites in the current reporting period" +
          (selectedPrimaryName ? ` for the '${selectedPrimaryName}' category` : "") +
          ". Data source: listing records with source = 'online' in the published data release, after the page's category filter."
        }
        description="Number of illegal pharmaceutical listings detected on online marketplaces and e-commerce sites this reporting period."
      />
      <SelectableMetric
        item={metrics[2]}
        prompt={
          "Single metric: illegal pharmaceutical listings detected on social media platforms in the current reporting period" +
          (selectedPrimaryName ? ` for the '${selectedPrimaryName}' category` : "") +
          ". Data source: listing records with source = 'social' in the published data release, after the page's category filter."
        }
        description="Number of illegal pharmaceutical listings detected on social media platforms this reporting period."
      />
    </div>
  );
}
