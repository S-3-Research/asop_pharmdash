"use client";

import { useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import Highcharts from "highcharts";

import { DashboardCard } from "../../ui/dashboard-card";
import { KeyTakeaway } from "../../ui/key-takeaway";
import { useWidgetData } from "../../copilot/copilot-context";
import { buildSocialBubbleOptions } from "./config";
import type { Domain } from "../../types";

interface SocialMediaCardProps {
  domains: Domain[];
}

// In Highcharts v13 packed bubble is bundled inside highcharts-more (root level)
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _mod = require("highcharts/highcharts-more");
  const _fn: (hc: typeof Highcharts) => void =
    typeof _mod?.default === "function" ? _mod.default : _mod;
  if (!(Highcharts as Record<string, unknown> & { seriesTypes?: Record<string, unknown> }).seriesTypes?.packedbubble && typeof _fn === "function") {
    _fn(Highcharts);
  }
}

const HighchartsReact = dynamic(() => import("highcharts-react-official"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-50" />,
});

export function SocialMediaCard({ domains }: SocialMediaCardProps) {
  const options = buildSocialBubbleOptions(domains);

  // See total-domain-card.tsx for why this ResizeObserver+reflow is needed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartCompRef = useRef<any>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      chartCompRef.current?.chart?.reflow();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const counts: Record<string, number> = {};
  for (const d of domains)
    for (const p of d.socialProfiles)
      counts[p.platform] = (counts[p.platform] ?? 0) + 1;
  useWidgetData(
    "domain-social-media",
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value })),
    "Packed-bubble chart of social media platforms where the rogue domains maintain profiles. " +
      "Data source: each domain record's socialProfiles array from the published data release; the value is the number of domain-profile links per platform (one domain can appear on multiple platforms). " +
      "Counts reflect the page's current category filter.",
  );

  return (
    <DashboardCard
      title="Social Media Outlet"
      className="h-full overflow-hidden"
      note={
        <KeyTakeaway>
          2 platforms account for most domain-linked social profiles. (example data)
        </KeyTakeaway>
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
