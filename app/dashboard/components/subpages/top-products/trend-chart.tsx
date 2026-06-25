"use client";

import { useMemo } from "react";
import type Highcharts from "highcharts";

import type { ApiListing } from "../../types";
import { HighchartsCard } from "../../charts/highcharts-card";
import { ALL_PRIMARY, CATEGORY_COLORS, CURRENT_PERIOD, formatMonthLabel } from "./config";

const CHART_STYLE = { fontFamily: "var(--font-geist-sans)" };

interface ListingTrendChartProps {
  filteredListings: ApiListing[];
  /** Derived from the full dataset so x-axis stays stable across filter changes */
  allMonthKeys: string[];
  selectedPrimaryName: string | null;
}

export function ListingTrendChart({
  filteredListings,
  allMonthKeys,
  selectedPrimaryName,
}: ListingTrendChartProps) {
  const options = useMemo((): Highcharts.Options => {
    const series: Highcharts.SeriesLineOptions[] = selectedPrimaryName
      ? // Specific category → one line per secondary product
        [...new Set(filteredListings.map((l) => l.secondaryCategory))].map((prod) => ({
          type: "line" as const,
          name: prod,
          color: CATEGORY_COLORS[selectedPrimaryName],
          data: allMonthKeys.map(
            (m) =>
              filteredListings.filter(
                (l) => l.month === m && l.secondaryCategory === prod,
              ).length,
          ),
        }))
      : // All categories → one line per primary
        ALL_PRIMARY.map((cat) => ({
          type: "line" as const,
          name: cat,
          color: CATEGORY_COLORS[cat],
          data: allMonthKeys.map(
            (m) =>
              filteredListings.filter(
                (l) => l.month === m && l.primaryCategory === cat,
              ).length,
          ),
        }));

    return {
      chart: {
        type: "line",
        height: 230,
        backgroundColor: "transparent",
        style: CHART_STYLE,
      },
      title: { text: undefined },
      xAxis: {
        categories: allMonthKeys.map(formatMonthLabel),
        tickLength: 0,
        lineColor: "#e2e8f0",
        labels: { rotation: 0, style: { color: "#6b7280", fontSize: "11px" } },
      },
      yAxis: {
        title: { text: undefined },
        gridLineColor: "#e5e7eb",
        gridLineDashStyle: "Dash",
        labels: { style: { color: "#6b7280", fontSize: "11px" } },
      },
      legend: {
        align: "center",
        verticalAlign: "bottom",
        itemStyle: { fontSize: "11px", fontWeight: "500" },
      },
      credits: { enabled: false },
      accessibility: { enabled: false },
      plotOptions: {
        line: { marker: { enabled: true, radius: 3 }, lineWidth: 2.2 },
      },
      tooltip: { shared: true },
      series,
    };
  }, [filteredListings, allMonthKeys, selectedPrimaryName]);

  return (
    <HighchartsCard
      chart={{
        id: "product-trend",
        title: selectedPrimaryName
          ? `${selectedPrimaryName} — Monthly Trend`
          : "Listing Trend by Category",
        subtitle: `Monthly listing count · ${CURRENT_PERIOD}`,
        options,
      }}
    />
  );
}
