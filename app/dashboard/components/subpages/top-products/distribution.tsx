import type { CategoryOption, PieChartNodeData } from "../../types";
import { DashboardCard } from "../../ui/dashboard-card";
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
  useWidgetData(
    "top-products-distribution",
    drillablePieData.flatMap((cat) => [
      { label: cat.name, value: `${cat.value} (${cat.percentage}%)` },
      ...(cat.children ?? []).map((child) => ({
        label: `${cat.name} → ${child.name}`,
        value: child.value,
      })),
    ]),
    "Two-level sunburst: inner ring = primary drug category, outer ring = individual products; values are listing counts and category share (%). " +
      "Data points are given as 'Category' rows (with % share) followed by 'Category → Product' rows. " +
      "Data source: pre-aggregated drillable pie data from the published data release for the current reporting period (unaffected by the page filter — clicking a slice sets the filter instead).",
  );

  return (
    <DashboardCard
      title="Product Distribution"
      subtitle="Inner ring = category · outer ring = product · click to filter"
      className="p-5"
      rightSlot={
        selectedCategoryId !== "all" ? (
          <button
            type="button"
            onClick={() => onCategorySelect("all")}
            className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
          >
            Reset ✕
          </button>
        ) : (
          <span className="text-xs text-slate-300">•••</span>
        )
      }
    >
      <SunburstCard
        data={drillablePieData}
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onCategorySelect={onCategorySelect}
        rootLabel={periodLabel}
      />
    </DashboardCard>
  );
}
