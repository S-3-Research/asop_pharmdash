"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import Highcharts from "highcharts";
import { Plus, Minus, Search, Hand, Home, Menu } from "lucide-react";

import { DashboardCard } from "../../ui/dashboard-card";
import { useWidgetData } from "../../copilot/copilot-context";
import { buildTrafficDatasets, type TrafficRange } from "./config";
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
  useWidgetData(
    "domain-traffic",
    [
      { label: "Selected Range", value: range },
      { label: "Total Organic Clicks (all periods)", value: totals.organic },
      { label: "Total Paid Clicks (all periods)", value: totals.paid },
      { label: "Domains Tracked", value: domains.length },
    ],
    "Line chart of monthly SEO traffic (organic + paid search clicks) aggregated across all rogue domains, with a 1M / 6M / YTD range toggle. " +
      "Data source: each domain record's seoClickHistory (monthly organicClicks and paidClicks from upstream SEO analytics) in the published data release. " +
      "Totals here cover all available months regardless of the selected range; counts reflect the page's current category filter.",
  );

  return (
    <DashboardCard title="Average Traffic" className="h-full overflow-hidden">
      <div className="flex h-full flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-2">
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
