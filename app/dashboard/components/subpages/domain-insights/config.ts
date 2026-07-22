// ─── Domain Insights subpage — builder functions & constants ─────────────────
// All chart options are derived from Domain[] at render time.

import type Highcharts from "highcharts";
import type { CategoryOption, Domain } from "../../types";

const CHART_STYLE = { fontFamily: "var(--font-geist-sans)" };

export const CURRENT_RPT_PERIOD = "2026-RPT-02";

// ── Domain primary-category filter options ────────────────────────────────────
// Static fallback used only when no domains have loaded yet (e.g. mock data
// with no release published). Real usage should prefer
// `buildDomainCategoryOptions(domains)` below, which derives the live set
// of categories straight from the data, in the same spirit as
// `buildCategoryRegistry()` in lib/release-mapping.ts.
export const DOMAIN_PRIMARY_CATEGORIES: CategoryOption[] = [
  { id: "GLP-1",      name: "GLP-1",      color: "#3b82f6" },
  { id: "Cancer Med", name: "Cancer Med", color: "#10b981", isTop: true },
  { id: "CNS Med",    name: "CNS Med",    color: "#a855f7" },
  { id: "Pain Med",   name: "Pain Med",   color: "#f59e0b" },
];

const FIXED_CATEGORY_COLORS: Record<string, string> = {
  "GLP-1": "#3b82f6",
  "Cancer Med": "#10b981",
  "CNS Med": "#a855f7",
  "Pain Med": "#f59e0b",
};

const FALLBACK_CATEGORY_PALETTE = [
  "#3b82f6", "#10b981", "#a855f7", "#f59e0b", "#ef4444",
  "#0ea5e9", "#84cc16", "#ec4899", "#14b8a6", "#8b5cf6",
];

function hashCategoryColor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return FALLBACK_CATEGORY_PALETTE[hash % FALLBACK_CATEGORY_PALETTE.length];
}

/** Derives the live set of selectable primary categories from whatever is
 *  actually present in `domains` (via each domain's full `categories[]`),
 *  instead of a hardcoded 4-value list — so newly-introduced categories in
 *  a release automatically become selectable in the filter dropdown. */
export function buildDomainCategoryOptions(domains: Domain[]): CategoryOption[] {
  const labels = new Set<string>();
  for (const d of domains) {
    for (const c of d.categories) labels.add(c.primary);
  }
  if (labels.size === 0) return DOMAIN_PRIMARY_CATEGORIES;
  return Array.from(labels)
    .sort()
    .map((name) => ({
      id: name,
      name,
      color: FIXED_CATEGORY_COLORS[name] ?? hashCategoryColor(name),
      isTop: name in FIXED_CATEGORY_COLORS,
    }));
}

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
  currentRptPeriodId: string,
): TotalDomainChartResult {
  const grouped: Record<string, number> = {};
  for (const d of allDomains) {
    grouped[d.reportingPeriodId] = (grouped[d.reportingPeriodId] ?? 0) + 1;
  }
  const rptPeriodKeys = Object.keys(grouped).sort();
  const currentCount = grouped[currentRptPeriodId] ?? 0;
  const prevKey = rptPeriodKeys[rptPeriodKeys.indexOf(currentRptPeriodId) - 1];
  const prevCount = prevKey != null ? (grouped[prevKey] ?? 0) : null;
  const pctChange =
    prevCount !== null && prevCount > 0
      ? Math.round(((currentCount - prevCount) / prevCount) * 100)
      : null;

  const noPriorData = prevKey == null;

  const areaSeries = rptPeriodKeys.map((k) => grouped[k] ?? 0);
  const liveSeries = rptPeriodKeys.map(
    (k) => allDomains.filter((d) => d.reportingPeriodId === k && d.isLive).length,
  );

  // When no prior rpt. period: prepend ghost baseline (0) and mark segment as dashed+faded
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
// Uses the FULL categories[] set (every product's secondary category), not
// just the domain's single representative value, so a domain selling both
// Ozempic and Tramadol contributes to both bars — consistent with the
// intersection-counting principle used elsewhere on this subpage.
export function buildDomainStatusOptions(domains: Domain[]): Highcharts.Options {
  const secondarySet = new Set<string>();
  for (const d of domains) {
    for (const c of d.categories) secondarySet.add(c.secondary);
  }
  const cats = Array.from(secondarySet).slice(0, 11);
  const online  = cats.map((c) => domains.filter((d) => d.isLive && d.categories.some((p) => p.secondary === c)).length);
  const offline = cats.map((c) => domains.filter((d) => !d.isLive && d.categories.some((p) => p.secondary === c)).length);
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
// Uses `socialProfiles` (social_media_profile_info per schema) — the
// domain's actual social media presence — rather than `platforms`, which is
// the search engine the domain was *discovered* through (Google/Bing/etc.)
// and is a completely different concept.
const SOCIAL_PLATFORM_COLORS: Record<string, string> = {
  facebook: "#93c5fd", instagram: "#f9a8d4", reddit: "#fca5a5", twitter: "#7dd3fc",
  threads: "#cbd5e1", linkedin: "#93c5fd", tiktok: "#94a3b8", youtube: "#fca5a5",
  tumblr: "#c4b5fd", pinterest: "#fca5a5", quora: "#fdba74", whatsapp: "#86efac",
  telegram: "#93c5fd", snapchat: "#fde047", "about.me": "#e2e8f0", kik: "#fde68a",
  myspace: "#c4b5fd", venmo: "#93c5fd",
};

const FALLBACK_PLATFORM_PALETTE = ["#bfdbfe", "#fbcfe8", "#c7d2fe", "#fed7aa", "#bbf7d0"];

function hashPlatformColor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return FALLBACK_PLATFORM_PALETTE[hash % FALLBACK_PLATFORM_PALETTE.length];
}

export function buildSocialBubbleOptions(domains: Domain[]): Highcharts.Options {
  const counts: Record<string, number> = {};
  for (const d of domains) {
    for (const p of d.socialProfiles) counts[p.platform] = (counts[p.platform] ?? 0) + 1;
  }
  const data = Object.entries(counts).map(([name, value]) => ({
    name,
    value,
    color: SOCIAL_PLATFORM_COLORS[name.toLowerCase()] ?? hashPlatformColor(name),
  }));
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
// Faithful 2-level structure per schema: type (Credit Card / Crypto Token /
// Bank Transfer / ...) -> paymentoption (Visa / Bitcoin / ...). Entries with
// no paymentoption still count toward their type parent but are excluded
// from the child ring (no synthetic "Unknown" leaf).
const TREEMAP_COLORS: Record<string, string> = {
  "Credit Card": "#1d4ed8", Visa: "#3b82f6", Mastercard: "#2563eb", "American Express": "#1d4ed8", AMEX: "#1d4ed8", Discover: "#0ea5e9",
  "Crypto Token": "#065f46", "Crypto Stablecoin": "#047857", Bitcoin: "#10b981", Ethereum: "#059669", USDT: "#34d399", USDC: "#6ee7b7", XRP: "#a7f3d0", RLUSD: "#a7f3d0",
  "Bank Transfer": "#7c2d12", "Digital Wallets": "#9a3412", "Gift Card": "#c2410c", "Debit Card": "#ea580c",
};

export function buildPaymentTreemapOptions(domains: Domain[]): Highcharts.Options {
  const parentCounts: Record<string, number> = {};
  const childCounts: Record<string, Record<string, number>> = {};
  for (const d of domains) {
    for (const { type, provider } of d.paymentInfo) {
      parentCounts[type] = (parentCounts[type] ?? 0) + 1;
      if (!provider) continue; // no fabricated "Unknown" leaf — still counted in parent
      if (!childCounts[type]) childCounts[type] = {};
      childCounts[type][provider] = (childCounts[type][provider] ?? 0) + 1;
    }
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
  // "Unknown" registrars (missing/unresolved whois data) are folded into
  // the "Other" bucket rather than shown as their own segment.
  const byRegistrar = new Map<string, Set<string>>();
  for (const d of domains) {
    const raw = d.whois.registrar.trim();
    const r = raw === "" || raw === "Unknown" ? "Other" : raw;
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

const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Parses the upstream "Mon 'YY" label (e.g. "Aug '24") into a sortable
 *  {year, month} pair. Returns null for anything that doesn't match. */
function parseSeoMonthLabel(label: string): { year: number; month: number } | null {
  const match = /^([A-Za-z]{3})\s*'(\d{2})$/.exec(label.trim());
  if (!match) return null;
  const month = MONTH_INDEX[match[1].toLowerCase()];
  if (month === undefined) return null;
  return { year: 2000 + parseInt(match[2], 10), month };
}

function buildTrafficOptions(categories: string[], data: number[]): Highcharts.Options {
  return {
    chart: { type: "area", height: 190, backgroundColor: "transparent", style: CHART_STYLE, margin: [10, 10, 48, 20] },
    title: { text: undefined },
    xAxis: {
      categories,
      lineColor: "#e2e8f0",
      tickLength: 0,
      // Labels like "Aug '24" are wide enough that Highcharts' default
      // overlap-avoidance silently hides every other tick when rendered
      // horizontally in this card's narrow width. Rotating -45° (and
      // disabling further auto-rotation/label-skipping) keeps every
      // month visible instead of some being dropped.
      labels: {
        rotation: -45,
        autoRotation: [],
        style: { color: "#6b7280", fontSize: "10px" },
      },
    },
    yAxis: { title: { text: undefined }, gridLineColor: "#e5e7eb", gridLineDashStyle: "Dash", labels: { style: { color: "#6b7280", fontSize: "10px" } } },
    legend: { enabled: false }, credits: { enabled: false }, accessibility: { enabled: false },
    tooltip: {
      formatter() {
        // `this.x` is the numeric category index in modern Highcharts —
        // use the point's category label ("Aug '24") instead.
        const label = this.category ?? this.key ?? this.x;
        return `<b>${label}</b><br/>Clicks: <b>${(this.y ?? 0).toLocaleString("en-US")}</b>`;
      },
    },
    plotOptions: {
      area: {
        fillColor: { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, "rgba(71,85,105,0.42)"], [1, "rgba(71,85,105,0.0)"]] },
        lineColor: "#334155", lineWidth: 1.5, marker: { enabled: false },
      },
    },
    series: [{ type: "area", name: "Clicks", data }],
  };
}

/** Aggregates every domain's `seoClickHistory` (organic + paid clicks) into
 *  a single chronological monthly time series, summed across all domains —
 *  replaces the old "count of domains created" proxy metric with the
 *  actual traffic figures reported upstream via seo_info.history_click_us. */
export function buildTrafficDatasets(domains: Domain[]): Record<TrafficRange, Highcharts.Options> {
  const totalsByMonth = new Map<string, { year: number; month: number; label: string; total: number }>();

  for (const d of domains) {
    for (const point of d.seoClickHistory) {
      const parsed = parseSeoMonthLabel(point.date);
      if (!parsed) continue;
      const key = `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
      const existing = totalsByMonth.get(key);
      const clicks = (point.organicClicks ?? 0) + (point.paidClicks ?? 0);
      if (existing) {
        existing.total += clicks;
      } else {
        totalsByMonth.set(key, { year: parsed.year, month: parsed.month, label: point.date, total: clicks });
      }
    }
  }

  const sorted = Array.from(totalsByMonth.values()).sort(
    (a, b) => a.year - b.year || a.month - b.month,
  );

  const nowDate = new Date();
  const currentYear = nowDate.getFullYear();

  const last1 = sorted.slice(-1);
  const last6 = sorted.slice(-6);
  const ytd = sorted.filter((p) => p.year === currentYear);

  return {
    "1M":  buildTrafficOptions(last1.map((p) => p.label), last1.map((p) => p.total)),
    "6M":  buildTrafficOptions(last6.map((p) => p.label), last6.map((p) => p.total)),
    "YTD": buildTrafficOptions(ytd.map((p) => p.label),   ytd.map((p) => p.total)),
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
    const { city, country, lat, lng } = d.geoLocation;
    // Skip domains with no resolvable geo coordinates — avoids plotting a
    // cluster of unrelated domains at (0,0) in the Gulf of Guinea.
    if (!lat && !lng) continue;
    if (!agg[city]) agg[city] = { count: 0, liveCount: 0, country };
    agg[city].count++;
    if (d.isLive) agg[city].liveCount++;
  }
  return Object.entries(agg)
    .filter(([city]) => CITY_POSITIONS[city])
    .map(([city, v]) => ({ city, country: v.country, count: v.count, liveCount: v.liveCount, ...CITY_POSITIONS[city] }));
}
