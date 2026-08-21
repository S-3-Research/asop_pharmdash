"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import Highcharts from "highcharts";
import { Plus, Minus, Search, Hand, Home, Menu } from "lucide-react";

import { DashboardCard } from "../../ui/dashboard-card";
import { KeyTakeaway } from "../../ui/key-takeaway";
import { useWidgetData } from "../../copilot/copilot-context";
import { buildTrafficDatasets, buildTrafficMonthlySeries, type TrafficRange } from "./config";
import type { Domain } from "../../types";

interface TrafficChartProps {
  domains: Domain[];
}

const HighchartsReact = dynamic(() => import("highcharts-react-official"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-50" />,
});

const RANGES: TrafficRange[] = ["6M", "YTD", "MAX"];

export function TrafficChart({ domains }: TrafficChartProps) {
  const [range, setRange] = useState<TrafficRange>("MAX");
  const datasets = useMemo(() => buildTrafficDatasets(domains), [domains]);

  // See total-domain-card.tsx for why this ResizeObserver+reflow is needed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartCompRef = useRef<any>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      chartCompRef.current?.chart?.reflow();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const totals = useMemo(() => {
    let organic = 0;
    let paid = 0;
    for (const d of domains)
      for (const pt of d.seoClickHistory) {
        organic += pt.organicClicks ?? 0;
        paid += pt.paidClicks ?? 0;
      }
    return { organic, paid };
  }, [domains]);

  // Monthly average-clicks-per-domain series for the CURRENTLY SELECTED range
  // (same data the chart itself is plotting) — this is what actually lets
  // Copilot describe a month-over-month trend instead of just a lifetime sum.
  const monthlySeries = useMemo(() => buildTrafficMonthlySeries(domains), [domains]);
  const rangeSeries = useMemo(() => {
    const nowDate = new Date();
    const currentYear = nowDate.getFullYear();
    switch (range) {
      case "1M": return monthlySeries.slice(-1);
      case "6M": return monthlySeries.slice(-6);
      case "YTD": return monthlySeries.filter((p) => p.year === currentYear);
      case "MAX":
      default: return monthlySeries;
    }
  }, [monthlySeries, range]);

  useWidgetData(
    "domain-traffic",
    [
      { label: "Selected Range", value: range },
      ...rangeSeries.map((p) => ({
        label: `Avg Clicks/Domain — ${p.label}`,
        value: Math.round(p.avg),
      })),
      { label: "Domains Tracked", value: domains.length },
    ],
    "Line chart of monthly AVERAGE SEO traffic (organic + paid search clicks) per domain, with a 6M / YTD / MAX range toggle. " +
      "Each month's value is the average across only the domains that had click data that month (missing months are not counted as 0). " +
      "The 'Avg Clicks/Domain — <month>' data points above ARE the actual monthly series for the currently selected range (same numbers the chart is plotting) — use THESE to describe whether traffic is rising, falling, or flat month-over-month, comparing the most recent months against earlier ones. " +
      "IMPORTANT: the underlying click history can extend further back than the current reporting period (CBU) — do NOT sum/aggregate all months into one grand total figure, as that number is not meaningful; always talk in terms of the monthly trend instead. " +
      "Data source: each domain record's seoClickHistory (monthly organicClicks and paidClicks from upstream SEO analytics) in the published data release; counts reflect the page's current category filter.",
  );

  return (
    <DashboardCard
      title="Average Traffic"
      className="h-full overflow-hidden"
      note={
        <KeyTakeaway>
          Paid clicks account for a growing share of domain traffic. (example data)
        </KeyTakeaway>
      }
    >
      <div className="flex h-full flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-0">
          {/* Time-range selector */}
          <div className="flex divide-x divide-slate-200 border border-slate-200 rounded bg-white shadow-sm text-xs text-slate-600">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 transition-colors ${
                  range === r
                    ? "bg-slate-100 font-semibold text-slate-800"
                    : "hover:bg-slate-50"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Chart tool icons */}
          {/* <div className="flex items-center gap-2 text-slate-400">
            <Plus   className="w-3.5 h-3.5 cursor-pointer hover:text-blue-500" />
            <Minus  className="w-3.5 h-3.5 cursor-pointer hover:text-blue-500" />
            <Search className="w-3.5 h-3.5 cursor-pointer hover:text-blue-500" />
            <Hand   className="w-3.5 h-3.5 cursor-pointer hover:text-blue-500" />
            <Home   className="w-3.5 h-3.5 cursor-pointer hover:text-blue-500" />
            <Menu   className="w-3.5 h-3.5 cursor-pointer hover:text-blue-500" />
          </div> */}
        </div>

        <div ref={chartWrapRef} className="-mx-4 -mb-4 min-h-0 flex-1 relative">
          <HighchartsReact
            ref={chartCompRef}
            highcharts={Highcharts}
            options={datasets[range]}
            containerProps={{ style: { position: "absolute", inset: 0 } }}
          />
        </div>
      </div>
    </DashboardCard>
  );
}
