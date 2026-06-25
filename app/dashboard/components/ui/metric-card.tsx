import type { MetricCardData } from "../types";

import { DashboardCard } from "./dashboard-card";

type MetricCardProps = {
  item: MetricCardData;
};

const directionClass: Record<NonNullable<MetricCardData["direction"]>, string> = {
  up: "text-emerald-700",
  down: "text-rose-700",
  flat: "text-slate-700",
};

const directionSymbol: Record<NonNullable<MetricCardData["direction"]>, string> = {
  up: "↑",
  down: "↓",
  flat: "→",
};

export function MetricCard({ item }: MetricCardProps) {
  const hasChange = item.change !== null && item.direction !== null;
  const changeBgClass = item.direction === "down" ? "bg-rose-50" : "bg-white";

  return (
    <DashboardCard variant="teal">
      <div className="text-sm font-medium text-[#9cd3e0]">{item.label}</div>
      <div className="mt-2 text-3xl font-bold text-white flex items-center gap-2">
        {item.value}
        {hasChange ? (
          <span
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold ${changeBgClass} ${directionClass[item.direction!]}`}
          >
            {directionSymbol[item.direction!]} {item.change}
          </span>
        ) : (
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-white/10 text-white/40">
            —
          </span>
        )}
      </div>
      <div className="mt-2">
        <p className="mt-1 text-xs text-[#9cd3e0] opacity-80">
          {hasChange
            ? (item.changeLabel ?? "vs prior quarter")
            : (item.changeLabel ?? "No Q1 2026 data")}
        </p>
      </div>
    </DashboardCard>
  );
}
