"use client";

import dynamic from "next/dynamic";
import Highcharts from "highcharts";

import type { ChartCardData } from "../types";
import { DashboardCard } from "../ui/dashboard-card";

const HighchartsReact = dynamic(() => import("highcharts-react-official"), {
  ssr: false,
});

type HighchartsCardProps = {
  chart: ChartCardData;
};

export function HighchartsCard({ chart }: HighchartsCardProps) {
  return (
    <DashboardCard
      title={chart.title}
      subtitle={chart.subtitle}
      className="p-5"
      rightSlot={
        <button type="button" className="text-sm text-slate-400 hover:text-slate-600">
          •••
        </button>
      }
    >
      <HighchartsReact highcharts={Highcharts} options={chart.options} />
    </DashboardCard>
  );
}
