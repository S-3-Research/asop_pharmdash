"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import Highcharts from "highcharts";
import type { PieChartNodeData, CategoryOption } from "../types";
import { CURRENT_PERIOD } from "../subpages/top-products/config";

const HighchartsReact = dynamic(() => import("highcharts-react-official"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[330px] items-center justify-center text-sm text-slate-400">
      Loading chart…
    </div>
  ),
});

// ─── Synchronous Sunburst registration ───────────────────────────────────────
// require() is synchronous — guarantees registration before any chart renders.
// The typeof window guard prevents the module from running during SSR:
// Next.js evaluates "use client" modules on the server to extract exports,
// and Highcharts modules touch browser-only APIs (e.g. Templating).
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _mod = require("highcharts/modules/sunburst");
  const _fn: (hc: typeof Highcharts) => void =
    typeof _mod?.default === "function" ? _mod.default : _mod;
  if (!(Highcharts as any).seriesTypes?.sunburst && typeof _fn === "function") {
    _fn(Highcharts);
  }
}

// ─── Color helpers ────────────────────────────────────────────────────────────

/** Slightly darken a hex color for the outer (secondary-product) ring */
function darkenForOuter(hex: string): string {
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const d = (c: number) => Math.round(c * 0.68);
  return `rgb(${d(r)}, ${d(g)}, ${d(b)})`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface SunburstCardProps {
  data: PieChartNodeData[];
  categories: CategoryOption[];
  /** Controlled value – id from CategoryOption (e.g. "glp-1") or "all" */
  selectedCategoryId: string;
  /** Called when user clicks a segment; receives CategoryOption.id or "all" */
  onCategorySelect: (id: string) => void;
}

export function SunburstCard({
  data,
  categories,
  selectedCategoryId,
  onCategorySelect,
}: SunburstCardProps) {
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
    const _data = data;
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
      { id: "root", parent: "", name: CURRENT_PERIOD, color: "#f1f5f9" },
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
        height: 230,
        backgroundColor: "transparent",
        style: { fontFamily: "var(--font-geist-sans)" },
        animation: { duration: 350 },
      },
      title: { text: undefined },
      credits: { enabled: false },
      accessibility: { enabled: false },
      tooltip: {
        formatter: function () {
          const pt = this as any;
          if (pt.options?.id === "root") return false;
          return `<b>${pt.name}</b><br/>Listings: ${pt.options?.value ?? pt.y}`;
        },
      },
      plotOptions: {
        sunburst: {
          allowTraversingTree: false,
          stickyTracking: false,
          borderWidth: 1.5,
          borderColor: "#ffffff",
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
          type: "sunburst" as any,
          data: points as any,
          // rootId controls which node is the center; changing it triggers
          // Highcharts' built-in zoom animation without destroying any points.
          rootId,
          name: "Listings",
        } as any,
      ],
    };
  }, [
    data,
    selectedPrimaryName,
    selectedCategoryId,
    nameToOptionId,
    onCategorySelect,
  ]);

  // No key needed: chart.update() handles rootId changes in-place with animation.
  return <HighchartsReact highcharts={Highcharts} options={options} />;
}
