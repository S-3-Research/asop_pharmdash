// ─── Domain Insights subpage — builder functions & constants ─────────────────
// All chart options are derived from Domain[] at render time.

import type Highcharts from "highcharts";
import type { CategoryOption, Domain } from "../../types";
import { socialPlatformLabel } from "../../utils/platform-label";
import { formatRptPeriodLabel } from "../top-products/config";

const CHART_STYLE = { fontFamily: "var(--font-geist-sans)" };

// ── Domain primary-category filter options ────────────────────────────────────
// Static fallback used only when no domains have loaded yet (e.g. mock data
// with no release published). Real usage should prefer
// `buildDomainCategoryOptions(domains)` below, which derives the live set
// of categories straight from the data, in the same spirit as
// `buildCategoryRegistry()` in lib/release-mapping.ts.
export const DOMAIN_PRIMARY_CATEGORIES: CategoryOption[] = [
  { id: "GLP",        name: "GLP",        color: "#3b82f6" },
  { id: "Cancer Med", name: "Cancer Med", color: "#10b981", isTop: true },
  { id: "CNS Med",    name: "CNS Med",    color: "#a855f7" },
  { id: "Pain Med",   name: "Pain Med",   color: "#f59e0b" },
];

const FIXED_CATEGORY_COLORS: Record<string, string> = {
  "GLP": "#3b82f6",
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
 *  actually present in `domains` (via each domain's `primaryCategories`,
 *  the domain-level product_label source of truth), instead of a hardcoded
 *  4-value list — so newly-introduced categories in a release automatically
 *  become selectable in the filter dropdown. */
export function buildDomainCategoryOptions(domains: Domain[]): CategoryOption[] {
  const counts = new Map<string, number>();
  for (const d of domains) {
    for (const c of d.primaryCategories) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  if (counts.size === 0) return DOMAIN_PRIMARY_CATEGORIES;
  let topName: string | null = null;
  for (const [name, count] of counts) {
    if (topName === null || count > (counts.get(topName) ?? 0)) topName = name;
  }
  return Array.from(counts.keys())
    .sort()
    .map((name) => ({
      id: name,
      name,
      color: FIXED_CATEGORY_COLORS[name] ?? hashCategoryColor(name),
      isTop: name === topName,
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
  periodLabels: Record<string, string> = {},
): TotalDomainChartResult {
  // Prefer the admin-configured display name; fall back to the formatted
  // internal code for any period not present in the map (see
  // lib/releases.ts `getReportPeriodDisplayMap`).
  const labelFor = (key: string) => periodLabels[key] || formatRptPeriodLabel(key);

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

  // Real rpt. period labels, 1:1 with each x-axis category below — no more
  // ghost baseline padding for a non-existent prior period (production
  // releases only ever have the one currently-published period; a fake
  // zero-value prior bar would be misleading, not informative).
  const rptPeriodLabels: string[] = rptPeriodKeys.map(labelFor);

  const totalSeries = rptPeriodKeys.map((k) => grouped[k] ?? 0);
  const liveSeries = rptPeriodKeys.map(
    (k) => allDomains.filter((d) => d.reportingPeriodId === k && d.isLive).length,
  );

  const options: Highcharts.Options = {
    chart: { type: "column", backgroundColor: "transparent", style: CHART_STYLE, margin: [10, 0, 0, 0], spacing: [5, 0, 0, 0] },
    title: { text: undefined },
    xAxis: { visible: false, categories: rptPeriodLabels },
    yAxis: { visible: false },
    legend: { align: "center", verticalAlign: "top", itemStyle: { fontSize: "10px", fontWeight: "500" }, margin: 4 },
    credits: { enabled: false },
    accessibility: { enabled: false },
    tooltip: {
      shared: true,
      outside: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter(this: any) {
        const points: { series: { name: string }; y: number; point: { index: number } }[] =
          this.points ?? [this];
        const idx = points[0]?.point?.index ?? 0;
        const label = rptPeriodLabels[idx] ?? "";
        const rows = points
          .map((p) => `${p.series.name}: <b>${p.y}</b><br/>`)
          .join("");
        return `<b>${label}</b><br/>${rows}`;
      },
    },
    plotOptions: {
      column: { borderRadius: 3, borderWidth: 0, groupPadding: 0.15, pointPadding: 0.05 },
    },
    series: [
      { type: "column", name: "Captured", color: "#91092f", data: totalSeries },
      { type: "column", name: "Online", color: "#74F9BC", data: liveSeries },
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
    for (const c of d.categories) {
      // "Unknown" (no resolvable product name — see lib/release-mapping.ts
      // `meaningfulProductName`) is excluded outright, not toggleable: it
      // isn't a real drug category and would otherwise show up as a
      // meaningless column here.
      if (c.secondary === "Unknown") continue;
      secondarySet.add(c.secondary);
    }
  }
  const cats = Array.from(secondarySet).slice(0, 11);
  const online  = cats.map((c) => domains.filter((d) => d.isLive && d.categories.some((p) => p.secondary === c)).length);
  const offline = cats.map((c) => domains.filter((d) => !d.isLive && d.categories.some((p) => p.secondary === c)).length);
  return {
    chart: { type: "column", backgroundColor: "transparent", style: CHART_STYLE, spacingTop: 0,},
    title: { text: undefined },
    xAxis: {
      categories: cats.map((c) => (c.length > 11 ? c.slice(0, 11) + "..." : c)),
      labels: { rotation: -90, style: { fontSize: "9px", color: "#6b7280" } },
      lineColor: "#e2e8f0", tickLength: 0,
    },
    yAxis: { title: { text: undefined }, gridLineColor: "#e5e7eb", gridLineDashStyle: "Dash", labels: { enabled: false } },
    legend: { align: "center", verticalAlign: "top", itemStyle: { fontSize: "10px", fontWeight: "500" }, margin: 4 },
    credits: { enabled: false }, accessibility: { enabled: false },
    plotOptions: {
      // Stacked (not grouped) so a category with zero offline domains just
      // shows a single full-height Online segment instead of reserving an
      // empty-looking slot for a zero-height Offline bar next to it — which
      // made per-category gaps look uneven when grouped side-by-side.
      column: { stacking: "normal", borderWidth: 0, borderRadius: 2 },
    },
    tooltip: { shared: true, outside: true, headerFormat: "<b>{point.key}</b><br/>", pointFormat: "{series.name}: <b>{point.y}</b><br/>" },
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
// Each platform gets its own hue (no two platforms share a color) so
// bubbles remain visually distinguishable at a glance.
const SOCIAL_PLATFORM_COLORS: Record<string, string> = {
  facebook: "#3b82f6", instagram: "#ec4899", reddit: "#f97316", twitter: "#0f172a", // X — deliberately dark navy, distinct from Threads' black
  threads: "#000000", linkedin: "#0369a1", tiktok: "#06b6d4", youtube: "#ef4444",
  tumblr: "#6366f1", pinterest: "#db2777", quora: "#b45309", whatsapp: "#22c55e",
  telegram: "#38bdf8", snapchat: "#eab308", "about.me": "#14b8a6", kik: "#84cc16",
  myspace: "#7e22ce", venmo: "#2563eb",
};

const FALLBACK_PLATFORM_PALETTE = [
  "#a855f7", "#d946ef", "#f43f5e", "#fb923c", "#84cc16", "#10b981", "#0ea5e9", "#64748b",
];

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
    name: socialPlatformLabel(name),
    value,
    color: SOCIAL_PLATFORM_COLORS[name.toLowerCase()] ?? hashPlatformColor(name),
  }));
  return {
    chart: { type: "packedbubble", backgroundColor: "transparent", style: CHART_STYLE },
    title: { text: undefined }, credits: { enabled: false }, accessibility: { enabled: false }, legend: { enabled: false },
    tooltip: { useHTML: true, outside: true, headerFormat: "<b>{point.name}</b><br/>", pointFormat: "Associated accounts: <b>{point.y}</b>" },
    plotOptions: {
      packedbubble: {
        minSize: "30%", maxSize: "110%",
        marker: { lineWidth: 0 },
        layoutAlgorithm: { gravitationalConstant: 0.05, splitSeries: false, seriesInteraction: true, dragBetweenSeries: false, parentNodeLimit: true },
        // "contrast" auto-picks black/white text based on each bubble's own
        // background color, so labels stay legible on both light and dark
        // platform colors without needing per-platform label overrides.
        dataLabels: { enabled: true, format: "{point.name}", style: { fontSize: "10px", fontWeight: "600", textOutline: "1px contrast", color: "contrast" } },
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
// Colors are computed, not hand-picked: payment types are ranked by total
// count and assigned a shade along a light blue→green gradient (same family
// as the WHOIS registrar sunburst). There are only a handful of payment
// types, so we use a short palette with wide steps between each color
// (rather than the finer-grained gradient used for registrars, which has
// more distinct entries) so each type reads as clearly different.
const PAYMENT_GRADIENT = ["#60a5fa", "#2dd4bf", "#4ade80"];

/** Lighten a hex color toward white by a fraction (0-1). Used so a payment
 *  type's provider leaf nodes read as a paler tint of their parent's color
 *  (rather than darker, since the parent palette is already light). */
function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.floor(((n >> 16) & 0xff) + (255 - ((n >> 16) & 0xff)) * amount));
  const g = Math.min(255, Math.floor(((n >> 8) & 0xff) + (255 - ((n >> 8) & 0xff)) * amount));
  const b = Math.min(255, Math.floor((n & 0xff) + (255 - (n & 0xff)) * amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

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
  // Rank payment types by total count (descending) so the largest gets the
  // deepest blue and later types shade toward teal/green.
  const rankedTypes = Object.entries(parentCounts).sort((a, b) => b[1] - a[1]);
  const data: object[] = [];
  rankedTypes.forEach(([type], idx) => {
    const pid = type.replace(/\s+/g, "-").toLowerCase();
    const color = PAYMENT_GRADIENT[idx % PAYMENT_GRADIENT.length];
    data.push({ id: pid, name: type, color });
    // Provider (child) nodes ranked by count within their type and given a
    // progressively paler tint of the parent's color, so the largest
    // provider stays closest to its parent's hue and smaller ones fade
    // lighter — while still visibly belonging to the same color family.
    const rankedProviders = Object.entries(childCounts[type] ?? {}).sort((a, b) => b[1] - a[1]);
    rankedProviders.forEach(([provider, count], childIdx) => {
      const childColor = lighten(color, 0.25 + childIdx * 0.15);
      data.push({ id: `${pid}-${provider.toLowerCase()}`, name: provider, parent: pid, value: count, color: childColor });
    });
  });
  return {
    chart: { type: "treemap", backgroundColor: "transparent", style: CHART_STYLE, spacingTop:2, },
    title: { text: undefined }, credits: { enabled: false }, accessibility: { enabled: false }, legend: { enabled: false },
    tooltip: { outside: true, headerFormat: "<b>{point.name}</b><br/>", pointFormat: "Payment mentions: <b>{point.value}</b>" },
    series: [{
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: "treemap" as any, layoutAlgorithm: "squarified", allowTraversingTree: true, borderWidth: 2, borderColor: "#f8fafc", borderRadius: 8,
      levels: [
        // Level 1 (payment type) — larger, bolder, fully opaque white text.
        // Anchored to the top-left corner (rather than centered) so that
        // when a type has only one provider — meaning its child tile
        // occupies the parent's *entire* rectangle — the type's own label
        // still has a dedicated spot instead of being fully covered by the
        // child's centered label (which happens when both are centered).
        {
          level: 1,
          layoutAlgorithm: "squarified",
          dataLabels: {
            enabled: true,
            align: "left",
            verticalAlign: "top",
            x: 6,
            y: 4,
            style: { fontSize: "13px", fontWeight: "700", color: "#fff", textOutline: "none" },
          },
          borderWidth: 3,
        },
        // Level 2 (provider) — inset within its parent (borderWidth creates
        // a visible margin revealing the parent's own color/label behind
        // it) and centered, visibly smaller/dimmer than level 1 so the
        // hierarchy between the two rings is unambiguous.
        {
          level: 2,
          dataLabels: {
            enabled: true,
            verticalAlign: "middle",
            style: { fontSize: "10px", fontWeight: "500", color: "rgba(15,23,42,0.75)", textOutline: "none" },
          },
          borderWidth: 4,
        },
      ],
      data,
    }],
  };
}

// ── Card 5: Registrar Sunburst ────────────────────────────────────────────────
// Blue → green gradient, ordered by descending domain count so the largest
// registrar gets the deepest blue and later ones shade toward teal/green.
// "Not Public" always stays a fixed neutral gray, outside the gradient.
export const REGISTRAR_GRADIENT = ["#60a5fa", "#38bdf8", "#2dd4bf", "#34d399", "#4ade80", "#86efac"];
export const REGISTRAR_UNKNOWN_COLOR = "#94a3b8";

/** Darken a hex color by a fraction (0-1) toward black, used so a registrar's
 *  domain leaf nodes read as a deeper shade of their parent's gradient color. */
function darken(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.floor(((n >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.floor(((n >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.floor((n & 0xff) * (1 - amount)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function buildRegistrarSunburstPoints(
  domains: Domain[],
  options?: { excludeUnknown?: boolean; excludeLabels?: string[] },
): { id: string; parent: string; name: string; fullName?: string; value?: number; color?: string }[] {
  // Use Map<registrar, Set<domain>> so both levels are deduplicated by
  // data-structure construction:
  //  - Map keys are unique → each registrar parent node pushed exactly once
  //  - Set values are unique → each domain child node pushed exactly once
  // This covers multi-select scenarios where the same domain can appear in
  // filteredDomains more than once, and guards against whitespace/casing
  // differences in registrar names via .trim().
  // Registrars with missing/unresolved whois data are folded into a single
  // "Not Public" bucket rather than shown as their own segment.
  const excludeUnknown = options?.excludeUnknown ?? false;
  const excludeSet = new Set(options?.excludeLabels ?? []);
  const byRegistrar = new Map<string, Set<string>>();
  for (const d of domains) {
    const raw = d.whois.registrar.trim();
    const r = raw === "" || raw === "Unknown" ? "Not Public" : raw;
    if (excludeUnknown && r === "Not Public") continue;
    if (excludeSet.has(r)) continue;
    if (!byRegistrar.has(r)) byRegistrar.set(r, new Set());
    byRegistrar.get(r)!.add(d.domain); // Set.add is idempotent — no duplicates
  }

  const pts: { id: string; parent: string; name: string; fullName?: string; value?: number; color?: string }[] = [
    // Explicit neutral color for the center/root node — without this,
    // Highcharts falls back to its default series palette (a blue), which
    // looks like an intentional "registrar" color but isn't one we set.
    { id: "root", parent: "", name: "", color: "#f1f5f9" },
  ];
  // Sort all registrars (including Not Public) by domain count descending so
  // both the gradient assignment and the sunburst's push order (which
  // determines each segment's angular position) follow the same ranking.
  const sortedRegistrars = [...byRegistrar.entries()].sort((a, b) => b[1].size - a[1].size);
  let gradientIdx = 0;
  const colorByRegistrar = new Map<string, string>();
  for (const [registrar] of sortedRegistrars) {
    if (registrar === "Not Public") continue;
    colorByRegistrar.set(registrar, REGISTRAR_GRADIENT[gradientIdx % REGISTRAR_GRADIENT.length]);
    gradientIdx++;
  }
  for (const [registrar, domainSet] of sortedRegistrars) {
    const color = registrar === "Not Public" ? REGISTRAR_UNKNOWN_COLOR : colorByRegistrar.get(registrar)!;
    pts.push({ id: registrar, name: registrar, parent: "root", value: domainSet.size, color });
    // Domain leaf nodes inherit the parent's gradient color but darkened one
    // step further, so the outer ring reads as a deeper shade of its parent.
    const childColor = registrar === "Not Public" ? darken(REGISTRAR_UNKNOWN_COLOR, 0.15) : darken(color, 0.2);
    for (const dom of domainSet) {
      const shortDom = dom.length > 18 ? dom.slice(0, 17) + "…" : dom;
      // `name` stays truncated for the in-chart data label (limited arc space);
      // `fullName` carries the untruncated domain for the tooltip.
      // Composite ID avoids collision between registrar names and domain names.
      pts.push({ id: `${registrar}:${dom}`, name: shortDom, fullName: dom, parent: registrar, value: 1, color: childColor });
    }
  }
  return pts;
}

// ── Card 6: Traffic ───────────────────────────────────────────────────────────
export type TrafficRange = "1M" | "6M" | "YTD" | "MAX";

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
      chart: { type: "area", backgroundColor: "transparent", style: CHART_STYLE, spacingTop: 10, spacingLeft: 20, spacingRight: 20 },
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
    yAxis: { title: { text: undefined }, gridLineColor: "#e5e7eb", gridLineDashStyle: "Dash", labels: { enabled: false } },
    legend: { enabled: false }, credits: { enabled: false }, accessibility: { enabled: false },
    tooltip: {
      outside: true,
      formatter() {
        // `this.x` is the numeric category index in modern Highcharts —
        // use the point's category label ("Aug '24") instead.
        const label = this.category ?? this.key ?? this.x;
        return `<b>${label}</b><br/>Avg Clicks: <b>${(this.y ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}</b>`;
      },
    },
    plotOptions: {
      area: {
        fillColor: { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, "rgba(71,85,105,0.42)"], [1, "rgba(71,85,105,0.0)"]] },
        lineColor: "#334155", lineWidth: 1.5, marker: { enabled: false },
      },
    },
    series: [{ type: "area", name: "Avg Clicks", data }],
  };
}

/** Aggregates every domain's `seoClickHistory` into a chronological monthly
 *  time series of the AVERAGE clicks (organic + paid) per domain — computed
 *  only over domains that actually reported a (non-null) data point for that
 *  month, rather than treating missing months as 0 and diluting the average
 *  across every domain. This replaces the previous sum-across-all-domains
 *  metric, which skewed upward/downward as domains with sparse history
 *  entered/left the dataset. */
/** Shared monthly average-clicks series, keyed by month, reusable by both the
 *  chart-options builder below and by callers (e.g. the copilot data note)
 *  that need the raw label/avg pairs rather than a Highcharts config. */
export interface TrafficMonthPoint {
  label: string;
  year: number;
  month: number;
  avg: number;
}

export function buildTrafficMonthlySeries(domains: Domain[]): TrafficMonthPoint[] {
  // month key -> { sum of clicks, count of domains with a non-null point that month }
  const statsByMonth = new Map<string, { year: number; month: number; label: string; sum: number; count: number }>();

  for (const d of domains) {
    for (const point of d.seoClickHistory) {
      const parsed = parseSeoMonthLabel(point.date);
      if (!parsed) continue;
      // Only count this domain toward the month's average if it actually
      // reported at least one non-null click figure — a domain with no
      // data for a month should not pull the average toward 0.
      if (point.organicClicks == null && point.paidClicks == null) continue;
      const clicks = (point.organicClicks ?? 0) + (point.paidClicks ?? 0);
      const key = `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
      const existing = statsByMonth.get(key);
      if (existing) {
        existing.sum += clicks;
        existing.count += 1;
      } else {
        statsByMonth.set(key, { year: parsed.year, month: parsed.month, label: point.date, sum: clicks, count: 1 });
      }
    }
  }

  return Array.from(statsByMonth.values())
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((p) => ({ label: p.label, year: p.year, month: p.month, avg: p.count > 0 ? p.sum / p.count : 0 }));
}

export function buildTrafficDatasets(domains: Domain[]): Record<TrafficRange, Highcharts.Options> {
  const sorted = buildTrafficMonthlySeries(domains);

  const nowDate = new Date();
  const currentYear = nowDate.getFullYear();

  const last1 = sorted.slice(-1);
  const last6 = sorted.slice(-6);
  const ytd = sorted.filter((p) => p.year === currentYear);
  const max = sorted;

  return {
    "1M":  buildTrafficOptions(last1.map((p) => p.label), last1.map((p) => p.avg)),
    "6M":  buildTrafficOptions(last6.map((p) => p.label), last6.map((p) => p.avg)),
    "YTD": buildTrafficOptions(ytd.map((p) => p.label),   ytd.map((p) => p.avg)),
    "MAX": buildTrafficOptions(max.map((p) => p.label),   max.map((p) => p.avg)),
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
