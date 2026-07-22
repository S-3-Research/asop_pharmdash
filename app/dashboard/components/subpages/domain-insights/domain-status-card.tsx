"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import Highcharts from "highcharts";

import type { Domain } from "../../types";
import { DashboardCard } from "../../ui/dashboard-card";
import { useWidgetData } from "../../copilot/copilot-context";
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

  useWidgetData(
    "domain-status",
    [
      { label: "Live", value: domains.filter((d) => d.isLive).length },
      { label: "Inactive", value: domains.filter((d) => !d.isLive).length },
    ],
    "Shows live vs inactive rogue domains, broken down by secondary drug category in a stacked column chart. " +
      "Data source: each domain record's isLive flag from the published data release, after the page's category filter. " +
      "'Live' means the domain resolved and was serving content at scan time; 'Inactive' means it did not.",
  );

  return (
    <DashboardCard title="Status" className="h-full overflow-hidden">
      <HighchartsReact highcharts={Highcharts} options={options} />
    </DashboardCard>
  );
}
