"use client";

import { useMemo } from "react";
import { Percent, TrendingUp, Sparkles } from "lucide-react";

import { SummaryStrip, type SummaryStripTile } from "../../ui/summary-strip";
import type { SocialMetrics, SocialProductSignalCount } from "../../types";

interface SocialSummaryStripProps {
  /** Full, unfiltered metrics snapshot — this strip always reflects the
   *  all-category/all-platform totals and must NOT react to the page's
   *  category/platform filter selection (mirrors DomainSummaryStrip). */
  metrics?: SocialMetrics;
  /** Full, unfiltered product signal counts (descending) — same rule. */
  productSignalCounts?: SocialProductSignalCount[];
}

export function SocialSummaryStrip({ metrics, productSignalCounts }: SocialSummaryStripProps) {
  const tiles = useMemo((): SummaryStripTile[] => {
    const totalPosts  = metrics?.totalPosts ?? 0;
    const activeCount = metrics?.activeCount ?? 0;
    const activePct = totalPosts > 0 ? Math.round((activeCount / totalPosts) * 100) : 0;

    const counts   = productSignalCounts ?? [];
    const top5Sum  = counts.slice(0, 5).reduce((sum, c) => sum + c.count, 0);
    const totalSum = counts.reduce((sum, c) => sum + c.count, 0);
    const top5Pct  = totalSum > 0 ? Math.round((top5Sum / totalSum) * 100) : 0;

    return [
      {
        id: "active-selling-pct",
        icon: Percent,
        accent: "bg-emerald-50 text-emerald-600",
        headline: totalPosts > 0 ? `${activePct}% active` : "No data",
        label: "% of selling posts/comments still active",
      },
      {
        id: "top5-drugs-share",
        icon: TrendingUp,
        accent: "bg-violet-50 text-violet-600",
        headline: totalSum > 0 ? `Top 5 drugs = ${top5Pct}%` : "No data",
        label: "Top 5 drugs account for this share of selling posts/comments",
      },
      {
        id: "placeholder",
        icon: Sparkles,
        accent: "bg-slate-50 text-slate-400",
        headline: "Coming soon",
        label: "Reserved for a future metric",
      },
    ];
  }, [metrics, productSignalCounts]);

  return <SummaryStrip tiles={tiles} />;
}
