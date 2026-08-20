"use client";

import { useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import Highcharts from "highcharts";
import useSWR from "swr";

import type { SocialKeywordBubble, SocialKeywordCountPayload } from "../../types";
import { useWidgetData } from "../../copilot/copilot-context";
import { KeyTakeaway } from "../../ui/key-takeaway";

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
  loading: () => <div className="h-full w-full animate-pulse bg-slate-50" />,
});

interface KeywordPerformanceCardProps {
  bubbles: SocialKeywordBubble[];
  platform: string;
  /** Selected category ids (e.g. ["GLP-1"]) — forwarded to the raw-count
   *  lookup so it matches the same category filter used to build `bubbles`. */
  categories: string[];
}

const countFetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<SocialKeywordCountPayload>);

export function KeywordPerformanceCard({ bubbles, platform, categories }: KeywordPerformanceCardProps) {
  const top12    = bubbles.slice(0, 12);
  const keywords = top12.map((b) => b.keyword).join(",");

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

  const kwParams = new URLSearchParams({ keywords });
  if (platform !== "all") kwParams.set("platform", platform);
  if (categories.length > 0) kwParams.set("categories", categories.join(","));

  const { data: countData } = useSWR<SocialKeywordCountPayload>(
    keywords ? `/api/social-media/keyword-count?${kwParams}` : null,
    countFetcher,
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const rawCountMap = new Map(
    (countData?.results ?? []).map((r) => [r.keyword, r.rawCount]),
  );

  useWidgetData(
    "social-keyword-performance",
    bubbles.map((b) => {
      const rawCount = rawCountMap.get(b.keyword);
      const ratioPart =
        rawCount != null && rawCount > 0
          ? ` (ratio ${((b.signalCount / rawCount) * 100).toFixed(1)}% of ${rawCount} raw hits)`
          : rawCount === 0
            ? " (raw hits: 0)"
            : "";
      return { label: b.keyword, value: `${b.signalCount} signals${ratioPart}` };
    }),
    "Bubble chart of keyword performance: bubble size = signal count per monitored keyword, plus a live raw-mention count per keyword (x-axis = raw count). " +
      "Meaning: for each keyword, we search that platform using the keyword and retrieve a set of 'raw' results/mentions (rawCount); " +
      "'signalCount' is the number of those raw results that were detected/classified as illegal-selling signals (e.g. rogue pharmacy listings or solicitations). " +
      "So rawCount is the total search hits for the keyword, and signalCount is the subset flagged as actual illegal-selling signals within that raw data. " +
      "IMPORTANT for prioritization: what matters most is the RELATIVE SIZE of signalCount vs rawCount (i.e. the signal-to-raw ratio/'hit rate'), not the absolute numbers alone. " +
      "A keyword with a small rawCount but a high signalCount/rawCount ratio is a concentrated, high-confidence signal and deserves attention even if its raw volume is low; " +
      "a keyword with a huge rawCount but a low ratio (mostly noise/false positives) is lower priority despite a large signalCount or large bubble. " +
      "When asked which keywords are worth watching, compare signalCount against rawCount (not signalCount/bubble size in isolation) and call out keywords with an unusually high ratio. " +
      "NOTE: rawCount/ratio above is only available for keywords among the top 12 (fetched live from the keyword-count API) — for other keywords the raw count simply hasn't been fetched, not that it's zero. " +
      "The data points here contain ALL keywords with their signal counts; the on-screen chart shows only the top 12. " +
      "Data source: keyword signal aggregates from the published data release, after the page's category/platform filter selection; raw counts come from the live keyword-count API.",
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
      outside: true,
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
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col h-full">
        <h3 className="font-semibold text-gray-800 text-sm mb-4">Keyword Performance</h3>
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col h-full">
      <div className="flex justify-between items-center mb-1">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">Keyword Performance</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">X: raw count · Y: signal count · size: raw count</p>
        </div>
      </div>
      <div ref={chartWrapRef} className="relative flex-1 min-h-0">
        <HighchartsReact
          ref={chartCompRef}
          highcharts={Highcharts}
          options={options}
          containerProps={{ style: { position: "absolute", inset: 0 } }}
        />
      </div>
      <div className="mt-3 border-t border-gray-100 pt-2.5">
        <KeyTakeaway>
          Ratio, not bubble size, best predicts a keyword's signal quality. (example data)
        </KeyTakeaway>
      </div>
    </div>
  );
}


