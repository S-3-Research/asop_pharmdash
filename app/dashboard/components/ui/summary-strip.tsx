import type { ComponentType } from "react";
import { Database } from "lucide-react";

/**
 * Shared visual shell for the page-level "Summary Strip" callouts used on
 * Top Products (OverallSummaryStrip), Domain Insights (DomainSummaryStrip),
 * and Social Media Insights (SocialSummaryStrip). Each subpage still owns
 * its own tile *computation* (what the 3 metrics are, how they're derived,
 * whether the data is filtered or not) — this component only owns the
 * shared *rendering* (grid layout, card chrome, icon badge, headline/label
 * typography), so all 3 strips stay visually consistent by construction.
 *
 * All 3 current usages are deliberately unfiltered snapshots (they must NOT
 * react to their page's category/platform filter — see each subpage's own
 * comment), so this shell always renders a small "All data" corner label
 * (icon + text, no pill/border chrome) in the top-right to make that
 * explicit, rather than leaving it as an undocumented assumption a user
 * could easily miss.
 */
export interface SummaryStripTile {
  id: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  /** Tailwind text/bg accent classes for the icon badge, e.g. "bg-emerald-50 text-emerald-600" */
  accent: string;
  headline: string;
  label: string;
}

interface SummaryStripProps {
  tiles: SummaryStripTile[];
  className?: string;
}

export function SummaryStrip({ tiles, className }: SummaryStripProps) {
  return (
    <div
      className={`relative overflow-visible rounded-xl border border-slate-200 border-l-4 border-l-[#77CDD1] bg-gradient-to-br from-white via-white to-slate-50 px-5 pb-5.5 pt-1 shadow-sm ${className ?? ""}`}
    >
      <div className="mb-1 flex justify-end">
        <span
          title="These figures always reflect the full dataset and are not affected by the filters below"
          className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400"
        >
          <Database size={10} strokeWidth={2.25} />
          All data
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">


        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div
              key={tile.id}
              className="flex items-center gap-3 rounded-lg bg-white/70 px-3 py-2.5 shadow-sm ring-1 ring-slate-100"
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tile.accent}`}>
                <Icon size={17} strokeWidth={2.25} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-800">{tile.headline}</div>
                <div className="truncate text-xs text-slate-500">{tile.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
