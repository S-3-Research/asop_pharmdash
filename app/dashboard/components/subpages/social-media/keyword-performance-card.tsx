"use client";

import { useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import Highcharts from "highcharts";
import useSWR from "swr";

import type { SocialKeywordBubble, SocialKeywordCountPayload } from "../../types";
import { useWidgetData } from "../../copilot/copilot-context";
import { KeyTakeaway, KEY_TAKEAWAY_SUPPRESSED } from "../../ui/key-takeaway";

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
  /** True when keyword_stats data exists for this filter but consists
   *  entirely of matched user-handle/community-name rows rather than
   *  genuine search keywords — see SocialMediaPayload.onlyAccountBasedData. */
  onlyAccountBasedData?: boolean;
}

const countFetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<SocialKeywordCountPayload>);

export function KeywordPerformanceCard({ bubbles, platform, categories, onlyAccountBasedData }: KeywordPerformanceCardProps) {
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
          ? ` (${((b.signalCount / rawCount) * 100) < 0.01 ? "less than 0.01" : ((b.signalCount / rawCount) * 100).toFixed(2)}% selling of ${rawCount} total)`
          : rawCount === 0
            ? " (total count: 0)"
            : "";
      return { label: b.keyword, value: `${b.signalCount} selling posts/comments${ratioPart}` };
    }),
    "Bubble chart of keyword performance: bubble size = selling posts/comments count per monitored keyword, plus a live total mention count per keyword (x-axis = Total Count). " +
      "Meaning: for each keyword, we search that platform using the keyword and retrieve a set of 'total' search results (rawCount, labeled 'Total Count' in the UI); " +
      "'signalCount' is the number of those total results that were detected/classified as illegal selling posts/comments. " +
      "Keyword Performance is essentially a SEARCH-YIELD metric: it shows how likely a search for a particular keyword is to surface content associated with illicit selling activity (signalCount / rawCount, shown in the UI as '% Selling'). " +
      "A keyword with a relatively high % Selling can represent a higher-value surveillance or enforcement target, even if that keyword generates fewer overall posts (a small Total Count) — a small, concentrated, high-confidence set of hits deserves attention. " +
      "Conversely, a keyword with a huge Total Count but a low % Selling is mostly noise/false positives and is lower priority despite a large signalCount or large bubble. " +
      "As additional reporting periods accumulate, changes in these % Selling/signal rates can also help observe how illicit sellers shift their language and tactics over time, potentially in response to platform enforcement, policy changes, or broader market trends — so % Selling trends across periods are as informative as any single period's snapshot. " +
      "When asked which keywords are worth watching, compare signalCount against Total Count (not signalCount or bubble size in isolation) and call out keywords with an unusually high % Selling. Very small ratios (below 0.01%) are reported as 'less than 0.01%' rather than rounded down to 0%. " +
      "NOTE: Total Count/% Selling above is only available for keywords among the top 12 (fetched live from the keyword-count API) — for other keywords the total count simply hasn't been fetched, not that it's zero. " +
      "The data points here contain ALL keywords with their selling posts/comments counts; the on-screen chart shows only the top 12. " +
      "Data source: keyword aggregates from the published data release, after the page's category/platform filter selection; total counts come from the live keyword-count API.",
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
      title: { text: "Total Count", style: { fontSize: "10px", color: "#9ca3af" } },
      gridLineWidth: 1,
      gridLineColor: "#f3f4f6",
      lineColor: "#e5e7eb",
      labels: { style: { fontSize: "10px", color: "#9ca3af" } },
    },
    yAxis: {
      title: { text: "Selling Posts/Comments", style: { fontSize: "10px", color: "#9ca3af" } },
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
        const percentSelling: string = pt.x > 0
          ? (() => {
              const pct = (pt.y / pt.x) * 100;
              return pct < 0.01 ? "less than 0.01%" : pct.toFixed(2) + "%";
            })()
          : "—";
        return `
          <div style="font-size:12px;font-weight:700;color:${ctx.color};margin-bottom:6px">${pt.name}</div>
          <table style="font-size:11px;border-collapse:collapse">
            <tr><td style="color:#9ca3af;padding-right:12px">Selling Posts/Comments</td><td style="font-weight:600;color:#374151">${pt.y}</td></tr>
            <tr><td style="color:#9ca3af;padding-right:12px">Total Count</td><td style="font-weight:600;color:#374151">${pt.x > 0 ? (pt.x as number).toLocaleString() : "—"}</td></tr>
            <tr style="border-top:1px solid #f3f4f6"><td style="color:#9ca3af;padding-right:12px;padding-top:4px">% Selling</td><td style="font-weight:600;color:#059669;padding-top:4px">${percentSelling}</td></tr>
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
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400 text-center px-6">
          {onlyAccountBasedData
            ? "Data not available because of account-based search"
            : "No data available"}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col h-full">
      <div className="flex justify-between items-center mb-1">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">Keyword Performance</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">X: total count · Y: selling posts/comments · size: total count</p>
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
      {!KEY_TAKEAWAY_SUPPRESSED && (
        <div className="mt-3 border-t border-gray-100 pt-2.5">
          <KeyTakeaway>
            Ratio, not bubble size, best predicts a keyword's selling-posts quality. (example data)
          </KeyTakeaway>
        </div>
      )}
    </div>
  );
}


