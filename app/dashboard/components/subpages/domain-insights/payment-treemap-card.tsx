"use client";

import dynamic from "next/dynamic";
import Highcharts from "highcharts";

import { useMemo } from "react";
import { DashboardCard } from "../../ui/dashboard-card";
import { buildPaymentTreemapOptions } from "./config";
import type { Domain } from "../../types";

interface PaymentTreemapCardProps {
  domains: Domain[];
}

type HCWithModules = typeof Highcharts & { seriesTypes?: Record<string, unknown> };

// Load heatmap (peer dep) then treemap module synchronously
if (typeof window !== "undefined") {
  const hc = Highcharts as HCWithModules;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _heatmap = require("highcharts/modules/heatmap");
  const _heatmapFn: (hc: typeof Highcharts) => void =
    typeof _heatmap?.default === "function" ? _heatmap.default : _heatmap;
  if (!hc.seriesTypes?.heatmap && typeof _heatmapFn === "function") {
    _heatmapFn(Highcharts);
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _treemap = require("highcharts/modules/treemap");
  const _treemapFn: (hc: typeof Highcharts) => void =
    typeof _treemap?.default === "function" ? _treemap.default : _treemap;
  if (!hc.seriesTypes?.treemap && typeof _treemapFn === "function") {
    _treemapFn(Highcharts);
  }
}

const HighchartsReact = dynamic(() => import("highcharts-react-official"), {
  ssr: false,
  loading: () => <div className="h-52" />,
});

export function PaymentTreemapCard({ domains }: PaymentTreemapCardProps) {
  const options = useMemo(() => buildPaymentTreemapOptions(domains), [domains]);
  return (
    <DashboardCard title="Payment Info" className="h-full overflow-hidden">
      <HighchartsReact highcharts={Highcharts} options={options} immutable />
    </DashboardCard>
  );
}
