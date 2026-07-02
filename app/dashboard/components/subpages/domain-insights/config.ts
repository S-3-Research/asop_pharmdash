// ─── Domain Insights subpage — builder functions & constants ─────────────────
// All chart options are derived from Domain[] at render time.

import type Highcharts from "highcharts";
import type { CategoryOption, Domain } from "../../types";

const CHART_STYLE = { fontFamily: "var(--font-geist-sans)" };

export const CURRENT_CBU = "2026-CBU-02";

// ── Domain primary-category filter options ────────────────────────────────────
export const DOMAIN_PRIMARY_CATEGORIES: CategoryOption[] = [
  { id: "GLP-1",      name: "GLP-1",      color: "#3b82f6" },
  { id: "Cancer Med", name: "Cancer Med", color: "#10b981", isTop: true },
  { id: "CNS Med",    name: "CNS Med",    color: "#a855f7" },
  { id: "Pain Med",   name: "Pain Med",   color: "#f59e0b" },
];

// ── City → CSS position map ───────────────────────────────────────────────────
export const CITY_POSITIONS: Record<string, { top: string; left: string }> = {
  Vancouver:       { top: "35%", left: "30%" },
  Calgary:         { top: "36%", left: "45%" },
  Chicago:         { top: "48%", left: "60%" },
  "New York":      { top: "45%", left: "65%" },
  "Los Angeles":   { top: "75%", left: "25%" },
};

// ── Card 1: Total Domain ──────────────────────────────────────────────────────
export interface TotalDomainChartResult {
  count: number;
  pctChange: number | null;
  noPriorData: boolean;
  options: Highcharts.Options;
}

export function buildTotalDomainChart(
  allDomains: Domain[],
  currentCbuId: string,
): TotalDomainChartResult {
  const grouped: Record<string, number> = {};
  for (const d of allDomains) {
    grouped[d.cbuId] = (grouped[d.cbuId] ?? 0) + 1;
  }
  const cbuKeys = Object.keys(grouped).sort();
  const currentCount = grouped[currentCbuId] ?? 0;
  const prevKey = cbuKeys[cbuKeys.indexOf(currentCbuId) - 1];
  const prevCount = prevKey != null ? (grouped[prevKey] ?? 0) : null;
  const pctChange =
    prevCount !== null && prevCount > 0
      ? Math.round(((currentCount - prevCount) / prevCount) * 100)
      : null;

  const noPriorData = prevKey == null;

  const areaSeries = cbuKeys.map((k) => grouped[k] ?? 0);
  const liveSeries = cbuKeys.map(
    (k) => allDomains.filter((d) => d.cbuId === k && d.isLive).length,
  );

  // When no prior CBU: prepend ghost baseline (0) and mark segment as dashed+faded
  const areaData: Highcharts.SeriesAreaOptions["data"] = noPriorData
    ? [0, currentCount]
    : areaSeries;
  const liveData: Highcharts.SeriesLineOptions["data"] = noPriorData
    ? [0, liveSeries[0] ?? 0]
    : liveSeries;

  const ghostAreaZone: Highcharts.SeriesZonesOptionsObject[] = [
    {
      value: 1,
      dashStyle: "Dash" as Highcharts.DashStyleValue,
      color: "rgba(56,189,248,0.30)",
      fillColor: {
        linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
        stops: [[0, "rgba(56,189,248,0.10)"], [1, "rgba(56,189,248,0)"]],
      } as Highcharts.GradientColorObject,
    },
  ];
  const ghostLineZone: Highcharts.SeriesZonesOptionsObject[] = [
    { value: 1, dashStyle: "Dash" as Highcharts.DashStyleValue, color: "rgba(239,68,68,0.30)" },
  ];

  const options: Highcharts.Options = {
    chart: { height: 150, backgroundColor: "transparent", style: CHART_STYLE, margin: [0, 0, 0, 0], spacing: [0, 0, 0, 0] },
    title: { text: undefined },
    xAxis: { visible: false },
    yAxis: { visible: false },
    legend: { enabled: false },
    credits: { enabled: false },
    accessibility: { enabled: false },
    tooltip: { shared: true, pointFormat: "{series.name}: <b>{point.y}</b><br/>" },
    plotOptions: {
      area: {
        fillColor: { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, "rgba(56,189,248,0.55)"], [1, "rgba(56,189,248,0.02)"]] },
        lineColor: "#38bdf8", lineWidth: 2, marker: { enabled: false },
      },
      line: { color: "#ef4444", lineWidth: 2, marker: { enabled: false } },
    },
    series: [
      {
        type: "area", name: "Total Domains", data: areaData,
        ...(noPriorData ? { zoneAxis: "x", zones: ghostAreaZone } : {}),
      },
      {
        type: "line", name: "Live", data: liveData,
        ...(noPriorData ? { zoneAxis: "x", zones: ghostLineZone } : {}),
      },
    ],
  };
  return { count: currentCount, pctChange, noPriorData, options };
}

// ── Card 2: Domain Status ─────────────────────────────────────────────────────
export function buildDomainStatusOptions(domains: Domain[]): Highcharts.Options {
  const cats = [...new Set(domains.map((d) => d.secondaryCategory))].slice(0, 11);
  const online  = cats.map((c) => domains.filter((d) => d.secondaryCategory === c && d.isLive).length);
  const offline = cats.map((c) => domains.filter((d) => d.secondaryCategory === c && !d.isLive).length);
  return {
    chart: { type: "column", height: 225, backgroundColor: "transparent", style: CHART_STYLE },
    title: { text: undefined },
    xAxis: {
      categories: cats.map((c) => (c.length > 11 ? c.slice(0, 11) + "..." : c)),
      labels: { rotation: -90, style: { fontSize: "9px", color: "#6b7280" } },
      lineColor: "#e2e8f0", tickLength: 0,
    },
    yAxis: { title: { text: undefined }, gridLineColor: "#e5e7eb", gridLineDashStyle: "Dash", labels: { style: { color: "#6b7280", fontSize: "10px" } } },
    legend: { align: "center", verticalAlign: "top", itemStyle: { fontSize: "10px", fontWeight: "500" }, margin: 4 },
    credits: { enabled: false }, accessibility: { enabled: false },
    plotOptions: { column: { grouping: true, borderWidth: 0, borderRadius: 2 } },
    tooltip: { shared: true, headerFormat: "<b>{point.key}</b><br/>", pointFormat: "{series.name}: <b>{point.y}</b><br/>" },
    series: [
      { type: "column", name: "Online",  color: "#4ade80", data: online  },
      { type: "column", name: "Offline", color: "#cbd5e1", data: offline },
    ],
  };
}

// ── Card 3: Social Media Outlet ───────────────────────────────────────────────
const PLATFORM_COLORS: Record<string, string> = {
  Google: "#bfdbfe", Bing: "#7dd3fc", DuckDuckGo: "#fbcfe8",
  Social: "#c7d2fe", "Manual Insert": "#fed7aa",
};

export function buildSocialBubbleOptions(domains: Domain[]): Highcharts.Options {
  const counts: Record<string, number> = {};
  for (const d of domains) for (const p of d.platforms) counts[p] = (counts[p] ?? 0) + 1;
  const data = Object.entries(counts).map(([name, value]) => ({ name, value, color: PLATFORM_COLORS[name] ?? "#e2e8f0" }));
  return {
    chart: { type: "packedbubble", height: 232, backgroundColor: "transparent", style: CHART_STYLE },
    title: { text: undefined }, credits: { enabled: false }, accessibility: { enabled: false }, legend: { enabled: false },
    tooltip: { useHTML: true, pointFormat: "<b>{point.name}</b>: {point.y}" },
    plotOptions: {
      packedbubble: {
        minSize: "30%", maxSize: "110%",
        layoutAlgorithm: { gravitationalConstant: 0.05, splitSeries: false, seriesInteraction: true, dragBetweenSeries: false, parentNodeLimit: true },
        dataLabels: { enabled: true, format: "{point.name}", style: { fontSize: "10px", fontWeight: "500", textOutline: "none", color: "#1e293b" } },
      } as Highcharts.PlotPackedbubbleOptions,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    series: [{ type: "packedbubble" as any, name: "Platforms", data }],
  };
}

// ── Card 4: Payment Info Treemap ──────────────────────────────────────────────
const TREEMAP_COLORS: Record<string, string> = {
  "Credit Card": "#1d4ed8", Visa: "#3b82f6", Mastercard: "#2563eb", Amex: "#1d4ed8",
  Crypto: "#065f46", BTC: "#10b981", ETH: "#059669",
  "Bank Transfer": "#7c2d12", Wire: "#ea580c", ACH: "#f97316",
};

export function buildPaymentTreemapOptions(domains: Domain[]): Highcharts.Options {
  const parentCounts: Record<string, number> = {};
  const childCounts: Record<string, Record<string, number>> = {};
  for (const d of domains) {
    const { type, provider } = d.paymentInfo;
    parentCounts[type] = (parentCounts[type] ?? 0) + 1;
    if (!childCounts[type]) childCounts[type] = {};
    childCounts[type][provider] = (childCounts[type][provider] ?? 0) + 1;
  }
  const data: object[] = [];
  for (const [type] of Object.entries(parentCounts)) {
    const pid = type.replace(/\s+/g, "-").toLowerCase();
    data.push({ id: pid, name: type, color: TREEMAP_COLORS[type] ?? "#94a3b8" });
    for (const [provider, count] of Object.entries(childCounts[type] ?? {})) {
      data.push({ id: `${pid}-${provider.toLowerCase()}`, name: provider, parent: pid, value: count, color: TREEMAP_COLORS[provider] ?? "#cbd5e1" });
    }
  }
  return {
    chart: { type: "treemap", height: 232, backgroundColor: "transparent", style: CHART_STYLE },
    title: { text: undefined }, credits: { enabled: false }, accessibility: { enabled: false }, legend: { enabled: false },
    tooltip: { pointFormat: "<b>{point.name}</b>: {point.value}" },
    series: [{
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: "treemap" as any, layoutAlgorithm: "squarified", allowTraversingTree: true, borderWidth: 2, borderColor: "#f8fafc",
      levels: [
        { level: 1, layoutAlgorithm: "squarified", dataLabels: { enabled: true, style: { fontSize: "12px", fontWeight: "600", color: "#fff", textOutline: "none" } }, borderWidth: 3 },
        { level: 2, dataLabels: { enabled: true, style: { fontSize: "10px", color: "rgba(255,255,255,0.9)", textOutline: "none" } } },
      ],
      data,
    }],
  };
}

// ── Card 5: Registrar Sunburst ────────────────────────────────────────────────
const REGISTRAR_COLORS: Record<string, string> = {
  GoDaddy: "#3b82f6", Namecheap: "#10b981", Tucows: "#f59e0b", Other: "#a855f7",
};

export function buildRegistrarSunburstPoints(
  domains: Domain[],
): { id: string; parent: string; name: string; value?: number; color?: string }[] {
  // Use Map<registrar, Set<domain>> so both levels are deduplicated by
  // data-structure construction:
  //  - Map keys are unique → each registrar parent node pushed exactly once
  //  - Set values are unique → each domain child node pushed exactly once
  // This covers multi-select scenarios where the same domain can appear in
  // filteredDomains more than once, and guards against whitespace/casing
  // differences in registrar names via .trim().
  const byRegistrar = new Map<string, Set<string>>();
  for (const d of domains) {
    const r = d.whois.registrar.trim();
    if (!byRegistrar.has(r)) byRegistrar.set(r, new Set());
    byRegistrar.get(r)!.add(d.domain); // Set.add is idempotent — no duplicates
  }

  const pts: { id: string; parent: string; name: string; value?: number; color?: string }[] = [
    { id: "root", parent: "", name: "" },
  ];
  for (const [registrar, domainSet] of byRegistrar) {
    const color = REGISTRAR_COLORS[registrar] ?? "#94a3b8";
    pts.push({ id: registrar, name: registrar, parent: "root", value: domainSet.size, color });
    for (const dom of domainSet) {
      const shortDom = dom.length > 18 ? dom.slice(0, 17) + "…" : dom;
      // Composite ID avoids collision between registrar names and domain names.
      pts.push({ id: `${registrar}:${dom}`, name: shortDom, parent: registrar, value: 1, color });
    }
  }
  return pts;
}

// ── Card 6: Traffic ───────────────────────────────────────────────────────────
export type TrafficRange = "1M" | "6M" | "YTD";

function buildTrafficOptions(categories: string[], data: number[]): Highcharts.Options {
  return {
    chart: { type: "area", height: 190, backgroundColor: "transparent", style: CHART_STYLE, margin: [10, 10, 30, 40] },
    title: { text: undefined },
    xAxis: { categories, lineColor: "#e2e8f0", tickLength: 0, labels: { style: { color: "#6b7280", fontSize: "10px" } } },
    yAxis: { title: { text: undefined }, gridLineColor: "#e5e7eb", gridLineDashStyle: "Dash", labels: { style: { color: "#6b7280", fontSize: "10px" } } },
    legend: { enabled: false }, credits: { enabled: false }, accessibility: { enabled: false },
    tooltip: { formatter() { return `<b>${this.x}</b><br/>Domains: <b>${this.y}</b>`; } },
    plotOptions: {
      area: {
        fillColor: { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, "rgba(71,85,105,0.42)"], [1, "rgba(71,85,105,0.0)"]] },
        lineColor: "#334155", lineWidth: 1.5, marker: { enabled: false },
      },
    },
    series: [{ type: "area", name: "Domains", data }],
  };
}

export function buildTrafficDatasets(domains: Domain[]): Record<TrafficRange, Highcharts.Options> {
  const now = new Date("2026-07-01").getTime() / 1000;
  const oneMonth = 30 * 86400;
  const sixMonths = 180 * 86400;

  const b1m = [0, 0, 0, 0];
  const b6m = [0, 0, 0, 0, 0, 0];
  const bYTD = new Array(7).fill(0);
  const weekLen = oneMonth / 4;
  const monLen  = sixMonths / 6;

  for (const d of domains) {
    const ago = now - d.createTimestamp;
    if (ago >= 0 && ago < oneMonth)   b1m[Math.min(3, Math.floor(ago / weekLen))]++;
    if (ago >= 0 && ago < sixMonths)  b6m[Math.min(5, Math.floor(ago / monLen))]++;
    const m = new Date(d.createDate).getMonth();
    if (m < 7) bYTD[m]++;
  }

  return {
    "1M":  buildTrafficOptions(["W1","W2","W3","W4"],             [...b1m].reverse()),
    "6M":  buildTrafficOptions(["Feb","Mar","Apr","May","Jun","Jul"], [...b6m].reverse()),
    "YTD": buildTrafficOptions(["Jan","Feb","Mar","Apr","May","Jun","Jul"], bYTD),
  };
}

// ── Card 7: Heatmap points ────────────────────────────────────────────────────
export interface HeatmapPoint {
  city: string;
  country: string;
  count: number;
  liveCount: number;
  top: string;
  left: string;
}

export function buildHeatmapPoints(domains: Domain[]): HeatmapPoint[] {
  const agg: Record<string, { count: number; liveCount: number; country: string }> = {};
  for (const d of domains) {
    const { city, country } = d.geoLocation;
    if (!agg[city]) agg[city] = { count: 0, liveCount: 0, country };
    agg[city].count++;
    if (d.isLive) agg[city].liveCount++;
  }
  return Object.entries(agg)
    .filter(([city]) => CITY_POSITIONS[city])
    .map(([city, v]) => ({ city, country: v.country, count: v.count, liveCount: v.liveCount, ...CITY_POSITIONS[city] }));
}
