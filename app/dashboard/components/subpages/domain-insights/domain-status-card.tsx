"use client";

import { useMemo, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import Highcharts from "highcharts";

import type { Domain } from "../../types";
import { DashboardCard } from "../../ui/dashboard-card";
import { useWidgetData } from "../../copilot/copilot-context";
import { buildDomainStatusOptions } from "./config";

const HighchartsReact = dynamic(() => import("highcharts-react-official"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-50" />,
});

interface DomainStatusCardProps {
  domains: Domain[];
}

export function DomainStatusCard({ domains }: DomainStatusCardProps) {
  const options = useMemo(() => buildDomainStatusOptions(domains), [domains]);

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
      chartCompRef.current?.chart?.reflow();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
