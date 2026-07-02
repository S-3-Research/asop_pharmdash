"use client";

import type { SocialPlatformTab } from "../../types";
import { PLATFORM_COLORS } from "./config";

interface PlatformTabsProps {
  tabs: SocialPlatformTab[];
  selected: string;
  onSelect: (platform: string) => void;
}

export function PlatformTabs({ tabs, selected, onSelect }: PlatformTabsProps) {
  const allCount = tabs.reduce((s, t) => s + t.count, 0);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <TabButton
        label="All"
        count={allCount}
        isActive={selected === "all"}
        color="#334155"
        onClick={() => onSelect("all")}
      />
      {tabs.map(({ platform, count }) => (
        <TabButton
          key={platform}
          label={platform}
          count={count}
          isActive={selected === platform}
          color={PLATFORM_COLORS[platform] ?? PLATFORM_COLORS.default}
          onClick={() => onSelect(platform)}
        />
      ))}
    </div>
  );
}

function TabButton({
  label,
  count,
  isActive,
  color,
  onClick,
}: {
  label: string;
  count: number;
  isActive: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        isActive
          ? "text-white shadow-sm"
          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
      }`}
      style={isActive ? { backgroundColor: color } : {}}
    >
      {label}
      <span
        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
          isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
        }`}
      >
        {count.toLocaleString()}
      </span>
    </button>
  );
}
