"use client";

import { useMemo } from "react";
import { Globe, Share2, Sparkles } from "lucide-react";

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

interface Tile {
  id: string;
  icon: typeof Globe;
  accent: string; // tailwind text/bg accent classes
  headline: string;
  label: string;
}

export function OverallSummaryStrip({ allListings, domainSummary }: OverallSummaryStripProps) {
  const tiles = useMemo((): Tile[] => {
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

  return (
    <div className="relative mt-3 overflow-visible rounded-xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 px-5 py-4 shadow-sm">
      {/* Raised tab, attached to the top-right edge — echoes the container's
          background/border/corner language so it reads as a continuation
          of the same surface (a page-level "Summary" callout), not a
          separate floating label. Positioned to overlap the container's
          top edge by half its own height so it visually emerges from the
          boundary rather than sitting flush on top of it. */}
      <div className="absolute -top-6 right-0 rounded-t-lg border border-b-0 border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 px-3 py-1">
        <span className="text-xs font-semibold tracking-wide text-slate-500">Summary</span>
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
