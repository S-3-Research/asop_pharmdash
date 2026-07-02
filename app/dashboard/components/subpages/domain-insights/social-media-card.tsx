"use client";

import dynamic from "next/dynamic";
import Highcharts from "highcharts";

import { DashboardCard } from "../../ui/dashboard-card";
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
  return (
    <DashboardCard title="Social Media Outlet" className="h-full overflow-hidden">
      <HighchartsReact highcharts={Highcharts} options={options} />
    </DashboardCard>
  );
}
