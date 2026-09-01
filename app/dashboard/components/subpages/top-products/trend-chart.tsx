"use client";

import { useMemo, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import Highcharts from "highcharts";

import type { ApiListing, CategoryOption } from "../../types";
import { DashboardCard } from "../../ui/dashboard-card";
import { useWidgetData } from "../../copilot/copilot-context";
import { formatRptPeriodLabel } from "./config";

const HighchartsReact = dynamic(() => import("highcharts-react-official"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-50" />,
});

const FALLBACK_COLOR = "#94a3b8";

const CHART_STYLE = { fontFamily: "var(--font-geist-sans)" };

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
  /** Admin-configured display name per internal reporting-period code (see
   *  lib/releases.ts `getReportPeriodDisplayMap`) — used for every period
   *  shown on this chart's axis/tooltip, not just the current one. Falls
   *  back to `formatRptPeriodLabel` for any key missing from the map (e.g.
   *  releases created before display names existed). */
  periodLabels: Record<string, string>;
}

export function ListingTrendChart({
  filteredListings,
  allRptPeriodKeys,
  selectedPrimaryName,
  categories,
  currentPeriodLabel,
  periodLabels,
}: ListingTrendChartProps) {
  // See total-domain-card.tsx for why this ResizeObserver+reflow is needed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartCompRef = useRef<any>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const chart = chartCompRef.current?.chart;
      if (!chart || !chart.container) return;
      try {
        chart.tooltip?.hide(0);
        chart.reflow();
      } catch {
        // Highcharts can throw internally if a resize races with an
        // in-flight tooltip animation (e.g. rapid container resize when
        // the card's expand modal opens/closes) — safe to ignore.
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Prefer the admin-configured display name; fall back to the formatted
  // internal code for any period not present in the map.
  const labelFor = useMemo(
    () => (key: string) => periodLabels[key] || formatRptPeriodLabel(key),
    [periodLabels],
  );

  const periodCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of filteredListings)
      counts[l.reportingPeriodId] = (counts[l.reportingPeriodId] ?? 0) + 1;
    return allRptPeriodKeys
      .filter(Boolean)
      .map((k) => ({ label: labelFor(k), value: counts[k] ?? 0 }));
  }, [filteredListings, allRptPeriodKeys, labelFor]);
  useWidgetData(
    "top-products-trend",
    periodCounts,
    "Bar chart of illegal listing volume per reporting period, one bar series per drug category. " +
      "The data points here are the total listing counts per reporting period (all categories combined) after the page's category filter. " +
      "Data source: listing records in the published data release, grouped by reporting period.",
  );

  const options = useMemo((): Highcharts.Options => {
    // Filter out any undefined/empty keys that may arrive before data is ready
    const validKeys = allRptPeriodKeys.filter(Boolean);
    const xLabels = validKeys.map(labelFor);

    function makeSeries(
      name: string,
      color: string,
      counts: number[],
    ): Highcharts.SeriesColumnOptions {
      return { type: "column", name, color, data: counts };
    }

    const colorByName = new Map(categories.map((c) => [c.name, c.color ?? FALLBACK_COLOR]));

    const series: Highcharts.SeriesColumnOptions[] = selectedPrimaryName
      ? // Specific category → one series per secondary product
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
      : // All categories → one series per primary (dynamically derived from data)
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
        type: "column",
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
        column: { borderRadius: 3, borderWidth: 0, groupPadding: 0.12, pointPadding: 0.05 },
      },
      tooltip: {
        shared: true,
        outside: true,
        useHTML: true,
        // Constrain the tooltip's own box instead of letting it grow
        // unbounded — with many category/product series sharing one
        // tooltip, an unconstrained box can grow tall enough to push the
        // page's scroll height around on every hover, which forces a full
        // layout reflow (visible as jank) each time the tooltip's line count
        // changes. A capped, internally-scrollable box keeps the tooltip's
        // footprint constant regardless of how many series it lists.
        style: { pointerEvents: "auto" },
        formatter(): string {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ctx = this as any;
          const points: Array<{ series: { name: string; color: string }; y: number; key?: string }> =
            ctx.points ?? [];
          const sorted = [...points].sort((a, b) => b.y - a.y);
          const xLabel = points[0]?.key ?? ctx.x;
          const rows = sorted
            .map(
              (p) =>
                `<tr><td style="padding-right:10px;color:${p.series.color}">● ${p.series.name}</td>` +
                `<td style="font-weight:600;color:#1e293b;text-align:right">${p.y}</td></tr>`,
            )
            .join("");
          return (
            `<div style="font-size:11px;font-weight:700;color:#1e293b;margin-bottom:6px">Rpt: ${xLabel}</div>` +
            `<div class="[scrollbar-width:thin] [scrollbar-color:#e2e8f0_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-300" style="max-height:180px;overflow-y:auto">` +
            `<table style="font-size:11px;border-collapse:collapse">${rows}</table>` +
            `</div>`
          );
        },
      },
      series,
    };
  }, [filteredListings, allRptPeriodKeys, selectedPrimaryName, categories, labelFor]);

  return (
    <DashboardCard
      title={selectedPrimaryName ? `${selectedPrimaryName} — Rpt. Period Trend` : "Listing Trend by Category"}
      subtitle={`rpt. period listing count · ${currentPeriodLabel}`}
      subtitleClassName="py-1"
      className="p-5 h-full"
    >
      <div ref={chartWrapRef} className="min-h-0 flex-1 relative">
        <HighchartsReact
          ref={chartCompRef}
          highcharts={Highcharts}
          options={options}
          containerProps={{ style: { position: "absolute", inset: 0 } }}
        />
      </div>
    </DashboardCard>
  );
}
