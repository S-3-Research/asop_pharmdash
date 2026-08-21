"use client";

import dynamic from "next/dynamic";
import Highcharts from "highcharts";

import type { ReactNode } from "react";
import type { ChartCardData } from "../types";
import { DashboardCard } from "../ui/dashboard-card";

const HighchartsReact = dynamic(() => import("highcharts-react-official"), {
  ssr: false,
});

type HighchartsCardProps = {
  chart: ChartCardData;
  note?: ReactNode;
  subtitleClassName?: string;
};

export function HighchartsCard({ chart, note, subtitleClassName }: HighchartsCardProps) {
  return (
    <DashboardCard
      title={chart.title}
      subtitle={chart.subtitle}
      subtitleClassName={subtitleClassName}
      className="p-5"
      note={note}
    >
      <HighchartsReact highcharts={Highcharts} options={chart.options} />
    </DashboardCard>
  );
}
