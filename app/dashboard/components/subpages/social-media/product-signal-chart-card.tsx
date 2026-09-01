"use client";

import { useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import Highcharts from "highcharts";

import type { SocialProductSignalCount } from "../../types";
import { useWidgetData } from "../../copilot/copilot-context";
import { KeyTakeaway, KEY_TAKEAWAY_SUPPRESSED } from "../../ui/key-takeaway";

const HighchartsReact = dynamic(() => import("highcharts-react-official"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-50" />,
});

interface ProductSignalChartCardProps {
  productSignalCounts: SocialProductSignalCount[];
}

const MAX_ITEMS = 10;
const BAR_COLOR = "#3a76f0";

export function ProductSignalChartCard({ productSignalCounts }: ProductSignalChartCardProps) {
  const top = productSignalCounts.slice(0, MAX_ITEMS);

  // See total-domain-card.tsx (domain insights) for why this
  // ResizeObserver+reflow is needed — without it, this chart used a
  // hardcoded pixel height and would overflow/underflow whenever the
  // parent card's flex-computed height changed.
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

  useWidgetData(
    "social-product-signal-chart",
    top.map((p) => ({ label: p.name, value: `${p.count} selling posts/comments` })),
    "Column chart of selling posts/comments count broken down by product name (the specific drug/product mentioned in each post, not the broader drug category). " +
      "The data points here contain only the top items shown on-screen. " +
      "Data source: product mentions resolved from the published data release's social media rows, after the page's category/platform filter selection.",
  );

  const options: Highcharts.Options = {
    chart: {
      type: "column",
      backgroundColor: "transparent",
      style: { fontFamily: "var(--font-geist-sans)" },
      animation: { duration: 300 },
      spacingBottom: 4,
    },
    title:    { text: undefined },
    credits:  { enabled: false },
    legend:   { enabled: false },
    accessibility: { enabled: false },
    xAxis: {
      categories: top.map((p) => p.name),
      lineColor: "#e5e7eb",
      labels: {
        style: { fontSize: "10px", color: "#9ca3af" },
        rotation: -30,
      },
    },
    yAxis: {
      title: { text: "Selling Posts/Comments", style: { fontSize: "10px", color: "#9ca3af" } },
      gridLineColor: "#f3f4f6",
      labels: { style: { fontSize: "10px", color: "#9ca3af" } },
      allowDecimals: false,
    },
    tooltip: {
      useHTML: true,
      outside: true,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#e5e7eb",
      backgroundColor: "#ffffff",
      shadow: { color: "#00000020", offsetX: 0, offsetY: 4, opacity: 0.15, width: 16 },
      formatter() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx = this as any;
        const pt  = ctx.point ?? ctx;
        return `
          <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:6px">${pt.category ?? pt.name}</div>
          <table style="font-size:11px;border-collapse:collapse">
            <tr><td style="color:#9ca3af;padding-right:12px">Selling Posts/Comments</td><td style="font-weight:600;color:#374151">${pt.y}</td></tr>
          </table>`;
      },
    },
    plotOptions: {
      column: {
        borderRadius: 4,
        color: BAR_COLOR,
        dataLabels: { enabled: false },
      },
    },
    series: [
      {
        type: "column",
        name: "Selling Posts/Comments",
        data: top.map((p) => p.count),
      } as Highcharts.SeriesColumnOptions,
    ],
  };

  if (top.length === 0) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col h-full">
        <h3 className="font-semibold text-gray-800 text-sm mb-4">Selling Posts/Comments by Product</h3>
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col h-full">
      <div className="flex justify-between items-center mb-1">
        <h3 className="font-semibold text-gray-800 text-sm">Selling by Product</h3>
      </div>
      <div ref={chartWrapRef} className="relative flex-1 min-h-0">
        <HighchartsReact
          ref={chartCompRef}
          highcharts={Highcharts}
          options={options}
          containerProps={{ style: { position: "absolute", inset: 0 } }}
        />
      </div>
      {!KEY_TAKEAWAY_SUPPRESSED && (
        <div className="mt-3 border-t border-gray-100 pt-2.5">
          <KeyTakeaway>
            Top product accounts for the largest share of selling posts/comments this period. (example data)
          </KeyTakeaway>
        </div>
      )}
    </div>
  );
}
