"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import Highcharts from "highcharts";

import type { Domain } from "../../types";
import { DashboardCard } from "../../ui/dashboard-card";
import { buildTotalDomainChart, CURRENT_RPT_PERIOD } from "./config";

const HighchartsReact = dynamic(() => import("highcharts-react-official"), {
  ssr: false,
  loading: () => <div className="h-40" />,
});

interface TotalDomainCardProps {
  domains: Domain[];
}

export function TotalDomainCard({ domains }: TotalDomainCardProps) {
  const { count, pctChange, noPriorData, options } = useMemo(
    () => buildTotalDomainChart(domains, CURRENT_RPT_PERIOD),
    [domains],
  );

  const isUp = pctChange !== null && pctChange >= 0;
  const changeLabel =
    pctChange !== null ? `${isUp ? "▲" : "▼"} ${Math.abs(pctChange)}%` : "—";
  const badgeClass =
    pctChange === null
      ? "text-slate-400 bg-slate-100"
      : isUp
        ? "text-emerald-600 bg-emerald-50"
        : "text-rose-600 bg-rose-50";

  return (
    <DashboardCard
      title="Total Domain"
      className="h-full overflow-hidden"
      note={
        noPriorData ? (
          <span className="text-[10px] text-slate-400">Prior Rpt. Period data unavailable</span>
        ) : undefined
      }
    >
      <div className="flex items-baseline gap-2 mb-0.5">
        <span className="text-3xl font-bold text-slate-800">{count}</span>
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${badgeClass}`}>
          {changeLabel}
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-2">vs prior rpt. period</p>
      <div className="-mx-4 -mb-4">
        <HighchartsReact highcharts={Highcharts} options={options} />
      </div>
    </DashboardCard>
  );
}
