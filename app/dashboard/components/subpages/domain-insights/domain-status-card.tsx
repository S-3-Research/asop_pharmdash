"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import Highcharts from "highcharts";

import type { Domain } from "../../types";
import { DashboardCard } from "../../ui/dashboard-card";
import { buildDomainStatusOptions } from "./config";

const HighchartsReact = dynamic(() => import("highcharts-react-official"), {
  ssr: false,
  loading: () => <div className="h-52" />,
});

interface DomainStatusCardProps {
  domains: Domain[];
}

export function DomainStatusCard({ domains }: DomainStatusCardProps) {
  const options = useMemo(() => buildDomainStatusOptions(domains), [domains]);
  return (
    <DashboardCard title="Status" className="h-full overflow-hidden">
      <HighchartsReact highcharts={Highcharts} options={options} />
    </DashboardCard>
  );
}
