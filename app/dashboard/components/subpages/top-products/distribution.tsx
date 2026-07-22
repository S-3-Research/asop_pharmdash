import type { CategoryOption, PieChartNodeData } from "../../types";
import { DashboardCard } from "../../ui/dashboard-card";
import { SunburstCard } from "../../charts/sunburst-card";

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
