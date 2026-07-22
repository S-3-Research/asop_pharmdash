"use client";

import dynamic from "next/dynamic";
import Highcharts from "highcharts";
import { MoreHorizontal } from "lucide-react";
import useSWR from "swr";

import type { SocialKeywordBubble, SocialKeywordCountPayload } from "../../types";
import { useWidgetData } from "../../copilot/copilot-context";

// Load highcharts/more for bubble series (guards against double-init)
if (typeof window !== "undefined") {
  type HCWithSeriesTypes = typeof Highcharts & { seriesTypes?: Record<string, unknown> };
  const hc = Highcharts as HCWithSeriesTypes;
  if (!hc.seriesTypes?.bubble) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("highcharts/highcharts-more");
    const fn: (h: typeof Highcharts) => void =
      typeof mod?.default === "function" ? mod.default : mod;
    if (typeof fn === "function") fn(Highcharts);
  }
}

const HighchartsReact = dynamic(() => import("highcharts-react-official"), {
  ssr: false,
  loading: () => <div className="h-52" />,
});

interface KeywordPerformanceCardProps {
  bubbles: SocialKeywordBubble[];
  platform: string;
}

const countFetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<SocialKeywordCountPayload>);

export function KeywordPerformanceCard({ bubbles, platform }: KeywordPerformanceCardProps) {
  const top12    = bubbles.slice(0, 12);
  const keywords = top12.map((b) => b.keyword).join(",");

  useWidgetData(
    "social-keyword-performance",
    bubbles.map((b) => ({ label: b.keyword, value: b.signalCount })),
    "Bubble chart of keyword performance: bubble size = signal count per monitored keyword, plus a live raw-mention count per keyword. " +
      "The data points here contain ALL keywords with their signal counts; the on-screen chart shows only the top 12. " +
      "Data source: keyword signal aggregates from the published data release, filtered by the page's category and platform selection; raw counts come from the live keyword-count API.",
  );

  const kwParams = new URLSearchParams({ keywords });
  if (platform !== "all") kwParams.set("platform", platform);

  const { data: countData } = useSWR<SocialKeywordCountPayload>(
    keywords ? `/api/social-media/keyword-count?${kwParams}` : null,
    countFetcher,
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const rawCountMap = new Map(
    (countData?.results ?? []).map((r) => [r.keyword, r.rawCount]),
  );

  // Build Highcharts bubble series data: x=rawCount, y=signalCount, z=rawCount (bubble size)
  const seriesData = top12.map((b) => ({
    name:  b.keyword,
    x:     rawCountMap.get(b.keyword) ?? 0,
    y:     b.signalCount,
    z:     rawCountMap.get(b.keyword) ?? 1,
    color: b.color + "cc",
    borderColor: b.color,
  }));

  const options: Highcharts.Options = {
    chart: {
      type: "bubble",
      height: 290,
      backgroundColor: "transparent",
      style: { fontFamily: "var(--font-geist-sans)" },
      animation: { duration: 300 },
    },
    title:    { text: undefined },
    credits:  { enabled: false },
    legend:   { enabled: false },
    accessibility: { enabled: false },
    xAxis: {
      title: { text: "Raw Count (Rpt. Period)", style: { fontSize: "10px", color: "#9ca3af" } },
      gridLineWidth: 1,
      gridLineColor: "#f3f4f6",
      lineColor: "#e5e7eb",
      labels: { style: { fontSize: "10px", color: "#9ca3af" } },
    },
    yAxis: {
      title: { text: "Signal Count", style: { fontSize: "10px", color: "#9ca3af" } },
      gridLineColor: "#f3f4f6",
      labels: { style: { fontSize: "10px", color: "#9ca3af" } },
    },
    tooltip: {
      useHTML: true,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#e5e7eb",
      backgroundColor: "#ffffff",
      shadow: { color: "#00000020", offsetX: 0, offsetY: 4, opacity: 0.15, width: 16 },
      formatter() {
        // `this` in Highcharts tooltip context is FormatterCallbackFunction context
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx = this as any;
        const pt  = ctx.point ?? ctx;
        const penetration: string = pt.x > 0
          ? ((pt.y / pt.x) * 100).toFixed(1) + "%"
          : "—";
        return `
          <div style="font-size:12px;font-weight:700;color:${ctx.color};margin-bottom:6px">${pt.name}</div>
          <table style="font-size:11px;border-collapse:collapse">
            <tr><td style="color:#9ca3af;padding-right:12px">Signal</td><td style="font-weight:600;color:#374151">${pt.y}</td></tr>
            <tr><td style="color:#9ca3af;padding-right:12px">Raw count</td><td style="font-weight:600;color:#374151">${pt.x > 0 ? (pt.x as number).toLocaleString() : "—"}</td></tr>
            <tr style="border-top:1px solid #f3f4f6"><td style="color:#9ca3af;padding-right:12px;padding-top:4px">Penetration</td><td style="font-weight:600;color:#059669;padding-top:4px">${penetration}</td></tr>
          </table>`;
      },
    },
    plotOptions: {
      bubble: {
        minSize: 12,
        maxSize: 40,
        dataLabels: {
          enabled: true,
          format: "{point.name}",
          style: { fontSize: "9px", fontWeight: "600", color: "#374151", textOutline: "none" },
        },
        marker: { lineWidth: 1.5 },
      },
    },
    series: [
      {
        type: "bubble",
        data: seriesData,
      } as Highcharts.SeriesBubbleOptions,
    ],
  };

  if (bubbles.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col h-[380px]">
        <h3 className="font-semibold text-gray-800 text-sm mb-4">Keyword Performance</h3>
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col h-[380px]">
      <div className="flex justify-between items-center mb-1">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">Keyword Performance</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">X: raw count · Y: signal count · size: raw count</p>
        </div>
        <MoreHorizontal size={16} className="text-gray-400 cursor-pointer" />
      </div>
      <div className="flex-1 min-h-0">
        <HighchartsReact highcharts={Highcharts} options={options} />
      </div>
    </div>
  );
}


