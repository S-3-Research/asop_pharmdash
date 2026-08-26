"use client";

import { useMemo } from "react";
import { Layers, ShieldAlert, Sparkles } from "lucide-react";

import { SummaryStrip, type SummaryStripTile } from "../../ui/summary-strip";
import type { Domain } from "../../types";

interface DomainSummaryStripProps {
  /** Full, unfiltered domain set — this strip always reflects the
   *  all-category snapshot and must NOT react to the page's category
   *  filter (mirrors OverallSummaryStrip on the Top Products page). */
  allDomains: Domain[];
}

export function DomainSummaryStrip({ allDomains }: DomainSummaryStripProps) {
  const tiles = useMemo((): SummaryStripTile[] => {
    // Domains that carry BOTH a GLP-1 and a Cancer Med category among their
    // full categories[] set (not just the single "representative" pair) —
    // i.e. dual-selling across these two specific primary categories.
    const dualSellingCount = allDomains.filter((d) => {
      const primaries = new Set(d.categories.map((c) => c.primary));
      return primaries.has("GLP-1") && primaries.has("Cancer Med");
    }).length;

    const nabpNotRecommendedCount = allDomains.filter((d) => d.nabpStatus === "not recommend").length;
    const nabpNotRecommendedPct =
      allDomains.length > 0 ? Math.round((nabpNotRecommendedCount / allDomains.length) * 100) : 0;

    return [
      {
        id: "dual-selling",
        icon: Layers,
        accent: "bg-violet-50 text-violet-600",
        headline: `${dualSellingCount} dual-selling domains`,
        label: "Domains listing both GLP-1 and Cancer Med products",
      },
      {
        id: "nabp-not-recommended",
        icon: ShieldAlert,
        accent: "bg-rose-50 text-rose-600",
        headline: `${nabpNotRecommendedPct}% on NABP Not Recommended`,
        label: `${nabpNotRecommendedCount} domains flagged "not recommend" by NABP`,
      },
      {
        id: "placeholder",
        icon: Sparkles,
        accent: "bg-slate-50 text-slate-400",
        headline: "Coming soon",
        label: "Reserved for a future metric",
      },
    ];
  }, [allDomains]);

  return <SummaryStrip tiles={tiles} className="mt-3" />;
}
