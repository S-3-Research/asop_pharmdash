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
    <DashboardCard variant="teal" className="h-full flex flex-col">
      {/* flex-1 pushes footer to bottom; content group stays at top */}
      <div className="flex flex-col flex-1 justify-between">
        <div>
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
                -%
              </span>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-[#9cd3e0] opacity-80">
          {hasChange
            ? (item.changeLabel ?? "vs prior rpt. period")
            : (item.changeLabel ?? "No prior Rpt. Period data")}
        </p>
      </div>
    </DashboardCard>
  );
}
