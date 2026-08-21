import { useMemo, useState } from "react";

import type { CategoryOption, PieChartNodeData } from "../../types";
import { DashboardCard } from "../../ui/dashboard-card";
import { KeyTakeaway } from "../../ui/key-takeaway";
import { SunburstCard } from "../../charts/sunburst-card";
import { useWidgetData } from "../../copilot/copilot-context";

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

  return (
    <DashboardCard
      title="Product Distribution"
      className="p-5"
      note={
        <KeyTakeaway>
          One product accounts for nearly half of category listings. (example data)
        </KeyTakeaway>
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
      <SunburstCard
        data={filteredPieData}
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onCategorySelect={onCategorySelect}
        rootLabel={periodLabel}
      />

    </DashboardCard>
  );
}
