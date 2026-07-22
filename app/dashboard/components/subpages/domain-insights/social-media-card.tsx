"use client";

import dynamic from "next/dynamic";
import Highcharts from "highcharts";

import { DashboardCard } from "../../ui/dashboard-card";
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
  loading: () => <div className="h-52" />,
});

export function SocialMediaCard({ domains }: SocialMediaCardProps) {
  const options = buildSocialBubbleOptions(domains);

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
    <DashboardCard title="Social Media Outlet" className="h-full overflow-hidden">
      <HighchartsReact highcharts={Highcharts} options={options} />
    </DashboardCard>
  );
}
