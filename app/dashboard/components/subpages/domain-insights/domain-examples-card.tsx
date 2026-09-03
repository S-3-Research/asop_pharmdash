"use client";

import { useMemo, useState } from "react";
import { ExternalLink, MapPin, Building2, ChevronDown } from "lucide-react";
import type { Domain, DomainWithMatch } from "../../types";
import { useWidgetData } from "../../copilot/copilot-context";
import { formatCityDisplay, formatBestLocation, formatAddressSource } from "@/lib/geo-format";

// ── Color helpers (mirrors heatmap-map-client.tsx's category palette) ────────
const CAT_COLORS: Record<string, string> = {
  "GLP-1":      "#3b82f6",
  "Cancer Med": "#10b981",
  "CNS Med":    "#a855f7",
  "Pain Med":   "#f59e0b",
};
const FALLBACK_PALETTE = ["#ef4444", "#0ea5e9", "#84cc16", "#ec4899", "#14b8a6", "#8b5cf6"];

function categoryColor(label: string): string {
  if (CAT_COLORS[label]) return CAT_COLORS[label];
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

function formatMoney(n: number): string {
  return n > 0 ? `$${n.toLocaleString()}` : "—";
}

/** Cheap string hash → deterministic pseudo-random ordering. Using a hash of
 *  each domain's own name (rather than Math.random()) means the "random"
 *  sample of N stays stable across re-renders — it won't reshuffle every
 *  time an unrelated state change (e.g. the page's category filter) causes
 *  this component's parent to re-render with a new array reference. */
function stableHash(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return hash;
}

interface DomainExamplesCardProps {
  domains: (Domain | DomainWithMatch)[];
  sampleSize?: number;
  /** Admin-configured display name per internal reporting-period code (see
   *  lib/releases.ts `getReportPeriodDisplayMap`) — used instead of the raw
   *  internal code (e.g. "2026-RPT-01") in the expanded detail view. */
  periodLabels?: Record<string, string>;
}

export function DomainExamplesCard({ domains, sampleSize = 10, periodLabels = {} }: DomainExamplesCardProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Deterministic random sample: sort by hash(domain name) instead of
  // Math.random(), so the same N domains show up on every render for a
  // given dataset (only changes when the underlying data/filter actually
  // changes), avoiding a jarring reshuffle on unrelated re-renders.
  // Only domains explicitly flagged `is_example` in the release are
  // eligible — these are the curated set meant for the Domain Samples
  // card, not an arbitrary random cross-section of every domain.
  const samples = useMemo(() => {
    return domains
      .filter((d) => d.isExample)
      .sort((a, b) => stableHash(a.domain) - stableHash(b.domain))
      .slice(0, sampleSize);
  }, [domains, sampleSize]);

  useWidgetData(
    "domain-samples",
    samples.map((d) => ({
      label: d.domain,
      value: `${d.isLive ? "Live" : "Inactive"} · ${[d.geoLocation.city ? formatCityDisplay(d.geoLocation.city) : "", d.geoLocation.country].filter(Boolean).join(", ") || "unknown location"}`,
    })),
    "Card of individual sampled rogue domain records (a deterministic random subset, not the full dataset) — each entry expands to show registrar, WHOIS dates, payment info, ad spend, social profiles, and reporting period. " +
      "Use this to look at concrete example domains behind the aggregate charts on this page, rather than aggregate counts. " +
      "Data source: individual domain records from the published data release, after the page's category filter; the sample is capped at a fixed size and does not represent every matching domain.",
  );

  function toggle(domain: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800 text-sm">
          Domain Samples
          <span className="ml-2 text-[11px] text-gray-400 font-normal">{samples.length} shown</span>
        </h3>
      </div>

      {samples.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
          No domains match the current filter.
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2.5 pr-1 [scrollbar-width:thin] [scrollbar-color:#e2e8f0_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-300">
          {samples.map((d) => {
            const isOpen = expanded.has(d.domain);
            const payment = d.paymentInfo[0];
            const paymentLabel = !payment
              ? "No payment data"
              : payment.provider
                ? `${payment.type} · ${payment.provider}`
                : payment.type;
            const location = formatBestLocation(
              d.geoLocation.city,
              d.geoLocation.state,
              d.geoLocation.country,
            );
            const addressSourceLabel = formatAddressSource(d.geoLocation.addressSource);
            // Only annotate the source when we actually have a location to
            // annotate and a source was reported — avoids a dangling "()" or
            // a misleading source label next to an omitted address line.
            const locationWithSource =
              location && addressSourceLabel ? `${location} (${addressSourceLabel})` : location;
            // Collapsed view: one pill per domain-level primary category
            // (d.primaryCategories, from product_label — the sole source
            // of truth for "what category is this domain"), each labeled
            // with how many of this domain's own products (categories[])
            // resolved to that same category name; 0 matching products
            // just shows the bare category name with no "×N".
            const productCountByPrimary = d.categories.reduce<Record<string, number>>((acc, c) => {
              if (c.primary !== "Uncategorized") acc[c.primary] = (acc[c.primary] ?? 0) + 1;
              return acc;
            }, {});
            const primaryCounts = d.primaryCategories.reduce<Record<string, number>>((acc, c) => {
              acc[c] = productCountByPrimary[c] ?? 0;
              return acc;
            }, {});

            return (
              <div
                key={d.domain}
                className="border border-gray-100 rounded-xl bg-gray-50/50 flex-shrink-0 overflow-hidden"
              >
                {/* ── Collapsed header row — always visible, click to expand ── */}
                <button
                  type="button"
                  onClick={() => toggle(d.domain)}
                  className="w-full text-left p-3 flex flex-col gap-1.5"
                >
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-xs font-bold text-gray-800 truncate">{d.domain}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          d.isLive ? "text-emerald-600 bg-emerald-50" : "text-slate-400 bg-slate-100"
                        }`}
                      >
                        {d.isLive ? "Live" : "Offline"}
                      </span>
                      <ChevronDown
                        size={13}
                        className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {Object.entries(primaryCounts).map(([primary, count]) => (
                      <span
                        key={primary}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{ backgroundColor: categoryColor(primary) + "1a", color: categoryColor(primary) }}
                      >
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: categoryColor(primary) }} />
                        {primary}
                        {count > 1 && <span className="text-[9px] opacity-70">×{count}</span>}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2.5 text-[10px]">
                    <span className="inline-flex items-center gap-1 text-slate-500 font-medium shrink-0">
                      <Building2 size={11} className="shrink-0 text-slate-400" />
                      {d.whois.registrar}
                    </span>
                    {location && (
                      <span className="inline-flex items-center gap-1 text-gray-500 truncate">
                        <MapPin size={11} className="shrink-0 text-gray-400" />
                        <span className="truncate">{locationWithSource}</span>
                      </span>
                    )}
                  </div>
                </button>

                {/* ── Expanded detail — full schema fields, only rendered when open ── */}
                {isOpen && (
                  <div className="px-3 pb-3 border-t border-gray-100 pt-2.5">
                    {/* Full category/product breakdown — deduped + counted per
                        secondary name (same "Name ×N" pattern as the collapsed
                        row's primary-category chips), color-keyed by primary.
                        Products with no meaningful product_name ("Unknown" —
                        see lib/release-mapping.ts meaningfulProductName) are
                        skipped entirely rather than shown as an "Unknown"
                        pill: an unresolved product name isn't a real, useful
                        label to surface here, no matter what its primary
                        category is. */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      {Object.values(
                        d.categories
                          .filter((c) => c.secondary !== "Unknown")
                          .reduce<Record<string, { primary: string; secondary: string; count: number }>>(
                            (acc, c) => {
                              const key = `${c.primary}::${c.secondary}`;
                              if (!acc[key]) acc[key] = { primary: c.primary, secondary: c.secondary, count: 0 };
                              acc[key].count += 1;
                              return acc;
                            },
                            {},
                          ),
                      ).map((c) => (
                        <span
                          key={`${c.primary}-${c.secondary}`}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{ backgroundColor: categoryColor(c.primary) + "1a", color: categoryColor(c.primary) }}
                        >
                          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: categoryColor(c.primary) }} />
                          {c.secondary}
                          {c.count > 1 && <span className="text-[9px] opacity-70">×{c.count}</span>}
                        </span>
                      ))}
                      {d.platforms.map((p) => (
                        <span key={p} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-500">
                          {p}
                        </span>
                      ))}
                    </div>

                    {d.associatedBusinessName && (
                      <div className="flex items-center gap-1.5 mb-2 text-[10px] text-gray-500">
                        <Building2 size={11} className="shrink-0 text-gray-400" />
                        <span className="truncate">{d.associatedBusinessName}</span>
                      </div>
                    )}

                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] mb-2.5">
                      <dt className="text-gray-400">Registrar</dt>
                      <dd className="text-gray-700 text-right truncate">{d.whois.registrar}</dd>
                      <dt className="text-gray-400">Registered</dt>
                      <dd className="text-gray-700 text-right">{d.whois.createdDate}</dd>
                      <dt className="text-gray-400">Expires</dt>
                      <dd className="text-gray-700 text-right">{d.whois.expiryDate}</dd>
                      <dt className="text-gray-400">Payment</dt>
                      <dd className="text-gray-700 text-right truncate">{paymentLabel}</dd>
                      <dt className="text-gray-400">Ad Spend</dt>
                      <dd className="text-gray-700 text-right">{formatMoney(d.sem.adSpend ?? 0)}</dd>
                      <dt className="text-gray-400">Impressions</dt>
                      <dd className="text-gray-700 text-right">
                        {d.sem.impressions ? d.sem.impressions.toLocaleString() : "—"}
                      </dd>
                      <dt className="text-gray-400">Social</dt>
                      <dd className="text-gray-700 text-right truncate">
                        {d.socialProfiles.length > 0
                          ? d.socialProfiles.map((s) => s.platform).join(", ")
                          : "—"}
                      </dd>
                      <dt className="text-gray-400">Rpt. Period</dt>
                      <dd className="text-gray-700 text-right">
                        {periodLabels[d.reportingPeriodId] || d.reportingPeriodId}
                      </dd>
                    </dl>

                    <div className="flex justify-end">
                      <a
                        href={`https://${d.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-600 hover:bg-blue-100 transition-colors"
                      >
                        Visit <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
