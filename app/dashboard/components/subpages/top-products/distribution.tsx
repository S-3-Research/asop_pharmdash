import { useMemo, useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import Highcharts from "highcharts";

import type { CategoryOption, PieChartNodeData } from "../../types";
import { DashboardCard } from "../../ui/dashboard-card";
import { KeyTakeaway, KEY_TAKEAWAY_SUPPRESSED } from "../../ui/key-takeaway";
import { useWidgetData } from "../../copilot/copilot-context";

type HCWithModules = typeof Highcharts & { seriesTypes?: Record<string, unknown> };

// Load the sunburst module synchronously — see registrar-sunburst.tsx for
// why this must happen before any chart renders (require() is synchronous;
// the typeof window guard prevents this from running during SSR, since
// Next.js evaluates "use client" modules on the server to extract exports,
// and Highcharts modules touch browser-only APIs).
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _mod = require("highcharts/modules/sunburst");
  const _fn: (hc: typeof Highcharts) => void =
    typeof _mod?.default === "function" ? _mod.default : _mod;
  if (!(Highcharts as HCWithModules).seriesTypes?.sunburst && typeof _fn === "function") {
    _fn(Highcharts);
  }
}

const HighchartsReact = dynamic(() => import("highcharts-react-official"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-50" />,
});

/** Slightly darken a hex color for the outer (secondary-product) ring */
function darkenForOuter(hex: string): string {
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const d = (c: number) => Math.round(c * 0.68);
  return `rgb(${d(r)}, ${d(g)}, ${d(b)})`;
}

interface ProductDistributionProps {
  drillablePieData: PieChartNodeData[];
  categories: CategoryOption[];
  selectedCategoryId: string;
  onCategorySelect: (id: string) => void;
  periodLabel: string;
}

export function ProductDistribution({
  drillablePieData,
  categories,
  selectedCategoryId,
  onCategorySelect,
  periodLabel,
}: ProductDistributionProps) {
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

  // "Unknown" secondary-category slices (products with no resolvable name —
  // see lib/release-mapping.ts `meaningfulProductName`) are hidden by
  // default, same UX as the Registrar sunburst's toggle, so the chart
  // focuses on actually-identified products. Values/percentages are
  // recomputed against the post-filter totals, not just hidden visually.
  const [showUnknown, setShowUnknown] = useState(false);

  const filteredPieData = useMemo((): PieChartNodeData[] => {
    if (showUnknown) return drillablePieData;

    const withoutUnknown = drillablePieData
      .map((cat) => {
        const children = (cat.children ?? []).filter((child) => child.name !== "Unknown");
        const value = children.reduce((sum, c) => sum + c.value, 0);
        return { ...cat, children, value };
      })
      .filter((cat) => cat.value > 0);

    const total = withoutUnknown.reduce((sum, cat) => sum + cat.value, 0);

    return withoutUnknown.map((cat) => ({
      ...cat,
      percentage: total > 0 ? Math.round((cat.value / total) * 100) : 0,
      children: cat.children!.map((child) => ({
        ...child,
        percentage: cat.value > 0 ? Math.round((child.value / cat.value) * 100) : 0,
      })),
    }));
  }, [drillablePieData, showUnknown]);

  useWidgetData(
    "top-products-distribution",
    filteredPieData.flatMap((cat) => [
      { label: cat.name, value: `${cat.value} (${cat.percentage}%)` },
      ...(cat.children ?? []).map((child) => ({
        label: `${cat.name} → ${child.name}`,
        value: child.value,
      })),
    ]),
    "Two-level sunburst: inner ring = primary drug category, outer ring = individual products; values are listing counts and category share (%). " +
      "Data points are given as 'Category' rows (with % share) followed by 'Category → Product' rows. " +
      "Data source: pre-aggregated drillable pie data from the published data release for the current reporting period (unaffected by the page filter — clicking a slice sets the filter instead). " +
      `${showUnknown ? "" : "Products with no resolvable name (\"Unknown\") are excluded via the card's toggle, and percentages are recomputed against the remaining totals."}`,
  );

  // primaryName → CategoryOption.id  (e.g. "CNS Med" → "cns-med")
  const nameToOptionId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of categories) {
      if (c.id !== "all") map[c.name] = c.id;
    }
    return map;
  }, [categories]);

  const selectedPrimaryName = useMemo(() => {
    if (selectedCategoryId === "all") return null;
    return categories.find((c) => c.id === selectedCategoryId)?.name ?? null;
  }, [selectedCategoryId, categories]);

  const options = useMemo((): Highcharts.Options => {
    // Closure captures for the click handler (avoids stale closures with useMemo)
    const _data = filteredPieData;
    const _nameToOptionId = nameToOptionId;
    const _selectedCategoryId = selectedCategoryId;
    const _onCategorySelect = onCategorySelect;

    type FlatPoint = {
      id: string;
      parent: string;
      name: string;
      value?: number;
      color: string;
    };

    // Always build the complete 3-layer tree.
    // Only rootId changes on category selection — Highcharts animates the zoom.
    const points: FlatPoint[] = [
      { id: "root", parent: "", name: periodLabel, color: "#f1f5f9" },
    ];
    for (const primary of _data) {
      const base = primary.color ?? "#94a3b8";
      points.push({
        id: primary.id,
        parent: "root",
        name: primary.name,
        value: primary.value,
        color: base,
      });
      for (const child of primary.children ?? []) {
        points.push({
          id: child.id,
          parent: primary.id,
          name: child.name,
          value: child.value,
          color: darkenForOuter(base),
        });
      }
    }

    // Zoom to the selected primary; fall back to the global root.
    const rootId = selectedPrimaryName
      ? (_data.find((d) => d.name === selectedPrimaryName)?.id ?? "root")
      : "root";

    return {
      chart: {
        type: "sunburst",
        backgroundColor: "transparent",
        style: { fontFamily: "var(--font-geist-sans)" },
        animation: { duration: 350 },
      },
      title: { text: undefined },
      credits: { enabled: false },
      accessibility: { enabled: false },
      tooltip: {
        outside: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: function (this: any) {
          if (this.options?.id === "root") return false;
          return `<b>${this.name}</b><br/>Listings: ${this.options?.value ?? this.y}`;
        },
      },
      plotOptions: {
        sunburst: {
          allowTraversingTree: false,
          stickyTracking: false,
          borderWidth: 1.5,
          borderColor: "#ffffff",
          borderRadius: 3,
          cursor: "pointer",
          dataLabels: {
            enabled: true,
            format: "{point.name}",
            rotationMode: "circular",
            style: {
              fontSize: "10px",
              fontWeight: "500",
              textOutline: "none",
              color: "#ffffff",
            },
            filter: { property: "outerArcLength", operator: ">", value: 22 },
          },
          levels: [
            { level: 1 },
            { level: 2 },
            { level: 3 },
          ],
          point: {
            events: {
              mouseOver: function () {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (!(this as any).options) return false;
              },
              click: function () {
                const pt = this as unknown as {
                  options: { id: string; parent: string };
                  name: string;
                };
                const { id: ptId, parent: ptParent } = pt.options;

                // Clicking the global root center → no-op
                if (ptId === "root") return;

                if (ptParent === "root") {
                  // Primary category ring (full view) OR
                  // the drilled center node itself (parent is still "root" in data).
                  // Toggle: clicking the already-selected primary = reset to all.
                  const optId = _nameToOptionId[pt.name];
                  if (optId) {
                    _onCategorySelect(_selectedCategoryId === optId ? "all" : optId);
                  }
                } else if (ptParent !== "") {
                  // Outer-ring secondary product → select its parent primary
                  const parentPrimary = _data.find((d) => d.id === ptParent);
                  if (parentPrimary) {
                    const optId = _nameToOptionId[parentPrimary.name];
                    if (optId) _onCategorySelect(optId);
                  }
                }
              },
            },
          },
        },
      },
      series: [
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type: "sunburst" as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: points as any,
          // rootId controls which node is the center; changing it triggers
          // Highcharts' built-in zoom animation without destroying any points.
          rootId,
          name: "Listings",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      ],
    };
  }, [
    filteredPieData,
    selectedPrimaryName,
    selectedCategoryId,
    nameToOptionId,
    onCategorySelect,
    periodLabel,
  ]);

  // Stable signature of every node id currently in the tree (root + all
  // primary/secondary ids). Changes ONLY when the node set itself changes
  // structurally (e.g. the "Hide Unknown" toggle adding/removing secondary
  // nodes, or the category filter changing which primaries exist) — NOT on
  // every render, and NOT when only `selectedCategoryId`/rootId changes.
  //
  // This drives HighchartsReact's `key`: without it, toggling a node back
  // into `data` after it had been filtered out relies on Highcharts'
  // in-place chart.update() to add the point back into the sunburst's
  // polar layout, which reserves its arc space (percentages/angles add up
  // correctly) but can fail to actually paint the new point's shape —
  // i.e. an invisible slice that still occupies space. Forcing a full
  // remount (fresh `Highcharts.chart()`) whenever the node set changes
  // sidesteps that incremental-update edge case entirely. Plain rootId
  // zoom/drill (same node set) is unaffected and keeps its smooth in-place
  // chart.update() animation.
  const nodeSignature = useMemo(() => {
    const ids: string[] = ["root"];
    for (const primary of filteredPieData) {
      ids.push(primary.id);
      for (const child of primary.children ?? []) ids.push(child.id);
    }
    return ids.join("|");
  }, [filteredPieData]);

  return (
    <DashboardCard
      title="Product Distribution"
      className="p-5 h-full"
      note={
        KEY_TAKEAWAY_SUPPRESSED ? undefined : (
          <KeyTakeaway>
            One product accounts for nearly half of category listings. (example data)
          </KeyTakeaway>
        )
      }
    >
      <div className="mb-4 flex items-center justify-between gap-3 py-1">
        <p className="text-xs text-slate-500">
          Inner ring = category · outer ring = product · click to filter
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={showUnknown}
              onClick={() => setShowUnknown((v) => !v)}
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                showUnknown ? "bg-slate-300" : "bg-blue-500"
              }`}
              title={showUnknown ? "Hide products with no resolvable name" : "Show products with no resolvable name"}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                  showUnknown ? "translate-x-0.5" : "translate-x-3.5"
                }`}
              />
            </button>
            <span className="text-[11px] text-slate-500">
              {showUnknown ? "Showing Unknown" : "Hiding Unknown"}
            </span>
          </div>
          {selectedCategoryId !== "all" ? (
            <button
              type="button"
              onClick={() => onCategorySelect("all")}
              className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
            >
              Reset ✕
            </button>
          ) : null}
        </div>
      </div>
      <div ref={chartWrapRef} className="min-h-0 flex-1 relative">
        <HighchartsReact
          key={nodeSignature}
          ref={chartCompRef}
          highcharts={Highcharts}
          options={options}
          containerProps={{ style: { position: "absolute", inset: 0 } }}
        />
      </div>
    </DashboardCard>
  );
}
