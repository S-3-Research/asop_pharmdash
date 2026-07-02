"use client";

import { useMemo } from "react";
import type Highcharts from "highcharts";

import type { ApiListing } from "../../types";
import { HighchartsCard } from "../../charts/highcharts-card";
import {
  ALL_PRIMARY,
  CATEGORY_COLORS,
  CURRENT_PERIOD,
  formatCbuLabel,
  prevCbuKey,
} from "./config";

const CHART_STYLE = { fontFamily: "var(--font-geist-sans)" };

/** Append 2-digit hex alpha to a #rrggbb string (alpha 0–1) */
function withOpacity(hex: string, alpha: number): string {
  return hex + Math.round(alpha * 255).toString(16).padStart(2, "0");
}

interface ListingTrendChartProps {
  filteredListings: ApiListing[];
  /** All distinct CBU keys from the full dataset, sorted chronologically */
  allCbuKeys: string[];
  selectedPrimaryName: string | null;
}

export function ListingTrendChart({
  filteredListings,
  allCbuKeys,
  selectedPrimaryName,
}: ListingTrendChartProps) {
  // Needed outside memo to conditionally render the prior-data note in JSX
  const isSingleCbu = allCbuKeys.length === 1;

  const options = useMemo((): Highcharts.Options => {
    // Filter out any undefined/empty keys that may arrive before data is ready
    const validKeys = allCbuKeys.filter(Boolean);
    const singleQ = validKeys.length === 1;

    // x-axis: when only one CBU exists, prepend a ghost "prior CBU" label
    const xLabels = singleQ
      ? [
          formatCbuLabel(prevCbuKey(validKeys[0])),
          formatCbuLabel(validKeys[0]),
        ]
      : validKeys.map(formatCbuLabel);

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

    const series: Highcharts.SeriesLineOptions[] = selectedPrimaryName
      ? // Specific category → one line per secondary product
        [...new Set(filteredListings.map((l) => l.secondaryCategory))].map((prod) => {
          const color = CATEGORY_COLORS[selectedPrimaryName];
          const counts = validKeys.map(
            (q) =>
              filteredListings.filter(
                (l) => l.cbuId === q && l.secondaryCategory === prod,
              ).length,
          );
          return makeSeries(prod, color, counts);
        })
      : // All categories → one line per primary
        ALL_PRIMARY.map((cat) => {
          const color = CATEGORY_COLORS[cat];
          const counts = validKeys.map(
            (q) =>
              filteredListings.filter(
                (l) => l.cbuId === q && l.primaryCategory === cat,
              ).length,
          );
          return makeSeries(cat, color, counts);
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
  }, [filteredListings, allCbuKeys, selectedPrimaryName]);

  return (
    <HighchartsCard
      chart={{
        id: "product-trend",
        title: selectedPrimaryName
          ? `${selectedPrimaryName} — CBU Trend`
          : "Listing Trend by Category",
        subtitle: `CBU listing count · ${CURRENT_PERIOD}`,
        options,
      }}
      note={
        isSingleCbu ? (
          <p className="flex items-center gap-2 text-xs text-slate-400">
            <span
              aria-hidden
              className="inline-block h-px w-6 shrink-0 border-b-2 border-dashed border-slate-300"
            />
            Prior CBU data unavailable — dashed segment shows estimated baseline (0).
          </p>
        ) : undefined
      }
    />
  );
}
