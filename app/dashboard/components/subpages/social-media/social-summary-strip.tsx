"use client";

import { useMemo } from "react";
import { Percent, TrendingUp, AlertTriangle } from "lucide-react";

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

    const unapprovedCount = metrics?.unapprovedCount ?? 0;
    const unapprovedPct = totalPosts > 0 ? Math.round((unapprovedCount / totalPosts) * 100) : 0;

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
        id: "unapproved-listings",
        icon: AlertTriangle,
        accent: "bg-amber-50 text-amber-600",
        headline: `${unapprovedPct}% unapproved listings`,
        label: `${unapprovedCount} of ${totalPosts} selling posts/comments have an unapproved product`,
      },
    ];
  }, [metrics, productSignalCounts]);

  return <SummaryStrip tiles={tiles} />;
}
