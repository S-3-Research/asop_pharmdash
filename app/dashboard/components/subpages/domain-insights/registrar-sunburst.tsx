"use client";

import dynamic from "next/dynamic";
import Highcharts from "highcharts";

import { useMemo } from "react";
import { DashboardCard } from "../../ui/dashboard-card";
import { buildRegistrarSunburstPoints } from "./config";
import type { Domain } from "../../types";

type HCWithModules = typeof Highcharts & { seriesTypes?: Record<string, unknown> };

// Load sunburst module synchronously
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _mod = require("highcharts/modules/sunburst");
  const _fn: (hc: typeof Highcharts) => void =
    typeof _mod?.default === "function" ? _mod.default : _mod;
  if (!(Highcharts as HCWithModules).seriesTypes?.sunburst && typeof _fn === "function") {
    _fn(Highcharts);
  }
}

const HighchartsReact = dynamic(() => import("highcharts-react-official"), {
  ssr: false,
  loading: () => <div className="h-52" />,
});

interface RegistrarSunburstProps {
  domains: Domain[];
}

export function RegistrarSunburst({ domains }: RegistrarSunburstProps) {
  const options = useMemo<Highcharts.Options>(
    () => ({
      chart: {
        type: "sunburst",
        height: 232,
        backgroundColor: "transparent",
        style: { fontFamily: "var(--font-geist-sans)" },
        margin: [0, 0, 0, 0],
      },
      title: { text: undefined },
      credits: { enabled: false },
      accessibility: { enabled: false },
      tooltip: { pointFormat: "<b>{point.name}</b>: {point.value} domains" },
      plotOptions: {
        sunburst: {
          allowTraversingTree: true,
          borderWidth: 1,
          borderColor: "#f8fafc",
          dataLabels: {
            enabled: true,
            format: "{point.name}",
            rotationMode: "perpendicular",
            style: {
              fontSize: "9px",
              fontWeight: "500",
              textOutline: "none",
              color: "#fff",
            },
          },
        },
      },
      series: [
        {
          type: "sunburst" as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          name: "Registrars",
          data: buildRegistrarSunburstPoints(domains) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        },
      ],
    }),
    [domains],
  );

  return (
    <DashboardCard
      title="Registrar"
      subtitle="Inner ring = registrar · outer ring = domain"
      className="h-full overflow-hidden"
    >
      <HighchartsReact highcharts={Highcharts} options={options} immutable />
    </DashboardCard>
  );
}
