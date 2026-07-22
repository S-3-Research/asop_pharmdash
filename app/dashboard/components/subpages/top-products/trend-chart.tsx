"use client";

import { useMemo } from "react";
import type Highcharts from "highcharts";

import type { ApiListing, CategoryOption } from "../../types";
import { HighchartsCard } from "../../charts/highcharts-card";
import { formatRptPeriodLabel, prevRptPeriodKey } from "./config";

const FALLBACK_COLOR = "#94a3b8";

const CHART_STYLE = { fontFamily: "var(--font-geist-sans)" };

/** Append 2-digit hex alpha to a #rrggbb string (alpha 0–1) */
function withOpacity(hex: string, alpha: number): string {
  return hex + Math.round(alpha * 255).toString(16).padStart(2, "0");
}

interface ListingTrendChartProps {
  filteredListings: ApiListing[];
  /** All distinct rpt. period keys from the full dataset, sorted chronologically */
  allRptPeriodKeys: string[];
  selectedPrimaryName: string | null;
  /** Real, dynamically-derived category list (excludes the "all" pseudo-option) */
  categories: CategoryOption[];
  /** Label for the most recent rpt. period present in the dataset — derived
   *  from the release's own name/reportPeriod, not hardcoded. */
  currentPeriodLabel: string;
}

export function ListingTrendChart({
  filteredListings,
  allRptPeriodKeys,
  selectedPrimaryName,
  categories,
  currentPeriodLabel,
}: ListingTrendChartProps) {
  // Needed outside memo to conditionally render the prior-data note in JSX
  const isSingleRptPeriod = allRptPeriodKeys.length === 1;

  const options = useMemo((): Highcharts.Options => {
    // Filter out any undefined/empty keys that may arrive before data is ready
    const validKeys = allRptPeriodKeys.filter(Boolean);
    const singleQ = validKeys.length === 1;

    // x-axis: when only one rpt. period exists, prepend a ghost "prior period" label
    const xLabels = singleQ
      ? [
          formatRptPeriodLabel(prevRptPeriodKey(validKeys[0])),
          formatRptPeriodLabel(validKeys[0]),
        ]
      : validKeys.map(formatRptPeriodLabel);

    /** Build one series line, applying dashed-zone styling when prior data is absent */
    function makeSeries(
      name: string,
      color: string,
      counts: number[],
    ): Highcharts.SeriesLineOptions {
      if (singleQ) {
        const actual = counts[0] ?? 0;
        return {
          type: "line",
          name,
          color,
          // Segment from ghost-point (index 0) to real point (index 1) → dashed + faded
          zoneAxis: "x",
          zones: [
            {
              value: 1,
              dashStyle: "Dash" as Highcharts.DashStyleValue,
              color: withOpacity(color, 0.35),
            },
          ],
          data: [
            // Ghost baseline point — hollow marker signals "no real data here"
            {
              y: 0,
              marker: {
                symbol: "circle",
                fillColor: "white",
                lineWidth: 1.5,
                lineColor: withOpacity(color, 0.5),
                radius: 4,
              },
            } as Highcharts.PointOptionsObject,
            actual,
          ],
        };
      }

      return { type: "line", name, color, data: counts };
    }

    const colorByName = new Map(categories.map((c) => [c.name, c.color ?? FALLBACK_COLOR]));

    const series: Highcharts.SeriesLineOptions[] = selectedPrimaryName
      ? // Specific category → one line per secondary product
        [...new Set(filteredListings.map((l) => l.secondaryCategory))].map((prod) => {
          const color = colorByName.get(selectedPrimaryName) ?? FALLBACK_COLOR;
          const counts = validKeys.map(
            (q) =>
              filteredListings.filter(
                (l) => l.reportingPeriodId === q && l.secondaryCategory === prod,
              ).length,
          );
          return makeSeries(prod, color, counts);
        })
      : // All categories → one line per primary (dynamically derived from data)
        categories.map((cat) => {
          const color = cat.color ?? FALLBACK_COLOR;
          const counts = validKeys.map(
            (q) =>
              filteredListings.filter(
                (l) => l.reportingPeriodId === q && l.primaryCategory === cat.name,
              ).length,
          );
          return makeSeries(cat.name, color, counts);
        });

    return {
      chart: {
        type: "line",
        height: 230,
        backgroundColor: "transparent",
        style: CHART_STYLE,
      },
      title: { text: undefined },
      xAxis: {
        categories: xLabels,
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
  }, [filteredListings, allRptPeriodKeys, selectedPrimaryName, categories]);

  return (
    <HighchartsCard
      chart={{
        id: "product-trend",
        title: selectedPrimaryName
          ? `${selectedPrimaryName} — Rpt. Period Trend`
          : "Listing Trend by Category",
        subtitle: `rpt. period listing count · ${currentPeriodLabel}`,
        options,
      }}
      note={
        isSingleRptPeriod ? (
          <p className="flex items-center gap-2 text-xs text-slate-400">
            <span
              aria-hidden
              className="inline-block h-px w-6 shrink-0 border-b-2 border-dashed border-slate-300"
            />
            Prior Rpt. Period data unavailable — dashed segment shows estimated baseline (0).
          </p>
        ) : undefined
      }
    />
  );
}
