"use client";

import { useMemo } from "react";
import { Globe, Share2, Sparkles } from "lucide-react";

import { SummaryStrip, type SummaryStripTile } from "../../ui/summary-strip";
import type { ApiListing } from "../../types";

interface OverallSummaryStripProps {
  /** Full, unfiltered listing set — this strip always reflects the
   *  all-category snapshot and must NOT react to the page's category
   *  filter (that filter only scopes the chart grid below). */
  allListings: ApiListing[];
  /** Domain-level facts (alive / has-social-profile) — these live on the
   *  Domain record, not the Listing record, so they're computed
   *  server-side from the release's full domain set and passed down. */
  domainSummary: { total: number; aliveCount: number; socialCount: number };
}

export function OverallSummaryStrip({ allListings, domainSummary }: OverallSummaryStripProps) {
  const tiles = useMemo((): SummaryStripTile[] => {
    const alivePct =
      domainSummary.total > 0
        ? Math.round((domainSummary.aliveCount / domainSummary.total) * 100)
        : 0;
    const socialPct =
      domainSummary.total > 0
        ? Math.round((domainSummary.socialCount / domainSummary.total) * 100)
        : 0;

    // Top-5 secondary categories (specific drugs, e.g. "Ozempic") by listing
    // count, as a share of all listings.
    const bySecondary = new Map<string, number>();
    for (const l of allListings) {
      bySecondary.set(l.secondaryCategory, (bySecondary.get(l.secondaryCategory) ?? 0) + 1);
    }
    const sorted = [...bySecondary.values()].sort((a, b) => b - a);
    const top5Sum = sorted.slice(0, 5).reduce((sum, n) => sum + n, 0);
    const top5Pct = allListings.length > 0 ? Math.round((top5Sum / allListings.length) * 100) : 0;

    return [
      {
        id: "alive",
        icon: Globe,
        accent: "bg-emerald-50 text-emerald-600",
        headline: `${alivePct}% domains alive`,
        label: "Detected domains currently online",
      },
      {
        id: "social",
        icon: Share2,
        accent: "bg-sky-50 text-sky-600",
        headline: `${socialPct}% social presence`,
        label: "Domains with an associated social media profile",
      },
      {
        id: "top5-secondary",
        icon: Sparkles,
        accent: "bg-violet-50 text-violet-600",
        headline: `Top 5 drugs = ${top5Pct}% of listings`,
        label: "Share of all listings held by the 5 most-listed drugs",
      },
    ];
  }, [allListings, domainSummary]);

  return <SummaryStrip tiles={tiles} className="mt-3" />;
}
