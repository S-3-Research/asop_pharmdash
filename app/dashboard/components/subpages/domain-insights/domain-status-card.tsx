"use client";

import { useMemo, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import Highcharts from "highcharts";

import type { Domain } from "../../types";
import { DashboardCard } from "../../ui/dashboard-card";
import { KeyTakeaway, KEY_TAKEAWAY_SUPPRESSED } from "../../ui/key-takeaway";
import { useWidgetData } from "../../copilot/copilot-context";
import { buildDomainStatusOptions } from "./config";

const HighchartsReact = dynamic(() => import("highcharts-react-official"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-50" />,
});

interface DomainStatusCardProps {
  domains: Domain[];
  /** Primary categories currently selected via the page's chart filter
   *  (e.g. ["Cancer Med"]). When non-empty, both the chart and the
   *  Copilot-facing breakdown only aggregate each domain's products whose
   *  own primary category is in this set — not every product the domain
   *  sells — so a domain that matched the page filter via one category
   *  doesn't also surface its other categories' drug names here. */
  selectedCategories?: string[];
}

export function DomainStatusCard({ domains, selectedCategories = [] }: DomainStatusCardProps) {
  const options = useMemo(
    () => buildDomainStatusOptions(domains, selectedCategories),
    [domains, selectedCategories],
  );

  // See total-domain-card.tsx for why this ResizeObserver+reflow is needed —
  // highcharts-react-official only sizes the chart once at mount, which can
  // race with the flex/grid layout still resolving its final height.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartCompRef = useRef<any>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const chart = chartCompRef.current?.chart;
      if (!chart || !chart.container) return;
      try {
        chart.tooltip?.hide(0);
        chart.reflow();
      } catch {
        // Highcharts can throw internally if a resize races with an
        // in-flight tooltip animation (e.g. rapid container resize when
        // the card's expand modal opens/closes) — safe to ignore.
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Per-secondary-category Online/Offline breakdown — mirrors the exact
  // grouping logic used by buildDomainStatusOptions (config.ts) so the data
  // points Copilot sees match what the stacked columns actually show,
  // instead of only a flat live/inactive total with no category dimension.
  const categoryBreakdown = useMemo(() => {
    const relevantCategories = (d: Domain) =>
      selectedCategories.length === 0
        ? d.categories
        : d.categories.filter((c) => selectedCategories.includes(c.primary));

    const secondarySet = new Set<string>();
    for (const d of domains) {
      for (const c of relevantCategories(d)) {
        // Kept in sync with buildDomainStatusOptions (config.ts): "Unknown"
        // (no resolvable product name) isn't a real drug category and is
        // excluded from the chart, so it's excluded here too.
        if (c.secondary === "Unknown") continue;
        secondarySet.add(c.secondary);
      }
    }
    return Array.from(secondarySet).map((cat) => {
      const inCategory = domains.filter((d) => relevantCategories(d).some((c) => c.secondary === cat));
      return {
        category: cat,
        online: inCategory.filter((d) => d.isLive).length,
        offline: inCategory.filter((d) => !d.isLive).length,
      };
    });
  }, [domains, selectedCategories]);

  useWidgetData(
    "domain-status",
    [
      { label: "Live (all categories)", value: domains.filter((d) => d.isLive).length },
      { label: "Inactive (all categories)", value: domains.filter((d) => !d.isLive).length },
      ...categoryBreakdown.map((c) => ({
        label: `${c.category} — Online/Offline`,
        value: `${c.online} online / ${c.offline} offline (${c.online + c.offline} total)`,
      })),
    ],
    "Stacked column chart of rogue domains broken down by secondary drug category (e.g. Ozempic, Tramadol). " +
      "Each column represents one secondary category; its total height is the total number of domains selling that drug, " +
      "split into a stacked 'Online' segment (currently live) and 'Offline' segment (taken down / no longer resolving). " +
      "A domain selling multiple drugs contributes to multiple columns. " +
      "The '<category> — Online/Offline' data points above give the EXACT per-category breakdown the chart is plotting — use these (not just the overall Live/Inactive totals) whenever asked about a specific drug/category. " +
      "Data source: each domain record's categories[].secondary field and isLive flag from the published data release, after the page's category filter. Domains with no resolvable product name (\"Unknown\") are excluded, since that isn't a real drug category. " +
      "When one or more primary categories (e.g. Cancer Med, GLP) are selected via the page's chart filter, only that domain's products belonging to the SELECTED primary categories are aggregated here — not every product the domain sells — so a domain matched into the filter via one category won't also surface drug names from its other categories. " +
      "'Online' means the domain resolved and was serving content at scan time; 'Offline' means it did not (e.g. taken down/seized).",
  );

  return (
    <DashboardCard
      title="Status"
      className="h-full overflow-hidden"
      note={
        KEY_TAKEAWAY_SUPPRESSED ? undefined : (
          <KeyTakeaway>
            62% of flagged domains remain live 30 days post-detection. (example data)
          </KeyTakeaway>
        )
      }
    >
      <div ref={chartWrapRef} className="relative h-full">
        <HighchartsReact
          ref={chartCompRef}
          highcharts={Highcharts}
          options={options}
          containerProps={{ style: { position: "absolute", inset: 0 } }}
        />
      </div>
    </DashboardCard>
  );
}
