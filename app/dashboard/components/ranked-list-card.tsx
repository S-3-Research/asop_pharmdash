import type { RankedItem } from "./types";
import { DashboardCard } from "./ui/dashboard-card";

type RankedListCardProps = {
  title: string;
  subtitle: string;
  items: RankedItem[];
};

const directionClass: Record<NonNullable<RankedItem["direction"]>, string> = {
  up: "text-emerald-300",
  down: "text-rose-300",
  flat: "text-slate-300",
};

const directionSymbol: Record<NonNullable<RankedItem["direction"]>, string> = {
  up: "↑",
  down: "↓",
  flat: "→",
};

export function RankedListCard({ title, subtitle, items }: RankedListCardProps) {
  return (
    <DashboardCard title={title} subtitle={subtitle} variant="teal">
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-[#183d46] px-3 py-2"
          >
            <div>
              <div className="text-sm font-medium text-white">{item.name}</div>
              <div className="text-xs text-[#9cd3e0]">{item.value}</div>
            </div>
            {item.change !== null && item.direction !== null ? (
              <div className={`text-sm font-semibold ${directionClass[item.direction]}`}>
                {directionSymbol[item.direction]} {item.change}
              </div>
            ) : (
              <div className="text-xs font-medium text-white/25">-%</div>
            )}
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}
