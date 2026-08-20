"use client";

import dynamic from "next/dynamic";
import Highcharts from "highcharts";

import { useMemo, useState, useRef, useEffect } from "react";
import { DashboardCard } from "../../ui/dashboard-card";
import { KeyTakeaway } from "../../ui/key-takeaway";
import { useWidgetData } from "../../copilot/copilot-context";
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
  loading: () => <div className="h-full w-full animate-pulse bg-slate-50" />,
});

interface RegistrarSunburstProps {
  domains: Domain[];
}

export function RegistrarSunburst({ domains }: RegistrarSunburstProps) {
  // Default to showing "Unknown" registrars (unchanged prior behavior) —
  // this toggle lets the user hide that bucket to focus on domains with
  // resolvable WHOIS registrar data.
  const [showUnknown, setShowUnknown] = useState(true);

  // See total-domain-card.tsx for why this ResizeObserver+reflow is needed.
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

  const registrarCounts = useMemo(() => {
    const byRegistrar = new Map<string, Set<string>>();
    for (const d of domains) {
      const r = d.whois.registrar.trim() || "Unknown";
      if (!showUnknown && r === "Unknown") continue;
      if (!byRegistrar.has(r)) byRegistrar.set(r, new Set());
      byRegistrar.get(r)!.add(d.domain);
    }
    return [...byRegistrar.entries()]
      .map(([label, set]) => ({ label, value: set.size }))
      .sort((a, b) => (b.value as number) - (a.value as number));
  }, [domains, showUnknown]);
  useWidgetData(
    "domain-registrar",
    registrarCounts,
    "Sunburst chart of the registrars used by the rogue domains; each value is the number of unique domains registered with that registrar. " +
      "Data source: WHOIS registrar field of each domain record in the published data release (deduplicated by domain name). " +
      `Counts reflect the page's current category filter${showUnknown ? "" : ", with domains lacking a resolvable registrar (\"Unknown\") excluded via the card's toggle"}.`,
  );

  const options = useMemo<Highcharts.Options>(
    () => ({
      chart: {
        type: "sunburst",
        backgroundColor: "transparent",
        style: { fontFamily: "var(--font-geist-sans)" },
        margin: [0, 0, 0, 0],
      },
      title: { text: undefined },
      credits: { enabled: false },
      accessibility: { enabled: false },
      tooltip: {
        // Render the tooltip in a container appended to <body> instead of
        // being clipped by this card's `overflow-hidden` ancestor, so long
        // domain/registrar names are never cut off.
        outside: true,
        // Use the untruncated `fullName` (set on domain leaf nodes) when
        // present; registrar nodes have no fullName and fall back to `name`.
        formatter: function () {
          const pt = this as unknown as {
            point: { id?: string; name: string; options: { id?: string; fullName?: string; value?: number } };
          };
          // Root/center node has no meaningful value — suppress its tooltip
          // instead of showing "<b></b>: undefined domains".
          if (pt.point.options.id === "root") return false;
          const label = pt.point.options.fullName ?? pt.point.name;
          return `<b>${label}</b>: ${pt.point.options.value} domains`;
        },
      },
      plotOptions: {
        sunburst: {
          allowTraversingTree: true,
          borderWidth: 1,
          borderColor: "#f8fafc",
          borderRadius: 3,
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
          data: buildRegistrarSunburstPoints(domains, { excludeUnknown: !showUnknown }) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        },
      ],
    }),
    [domains, showUnknown],
  );

  return (
    <DashboardCard
      title="Registrar"
      subtitle="Inner ring = registrar · outer ring = domain"
      className="h-full overflow-hidden"
      note={
        <KeyTakeaway>
          3 registrars account for 57% of all flagged domains. (example data)
        </KeyTakeaway>
      }
    >
      <div className="flex items-center gap-2 mb-2 -mt-1">
        <button
          type="button"
          role="switch"
          aria-checked={showUnknown}
          onClick={() => setShowUnknown((v) => !v)}
          className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
            showUnknown ? "bg-slate-300" : "bg-blue-500"
          }`}
          title={showUnknown ? "Hide domains with an unresolved registrar" : "Show domains with an unresolved registrar"}
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
              showUnknown ? "translate-x-0.5" : "translate-x-3.5"
            }`}
          />
        </button>
        <span className="text-[11px] text-slate-500">
          {showUnknown ? "Showing Unknown" : "Hiding Unknown"}
        </span>
      </div>
      <div ref={chartWrapRef} className="relative h-full">
        <HighchartsReact
          ref={chartCompRef}
          highcharts={Highcharts}
          options={options}
          immutable
          containerProps={{ style: { position: "absolute", inset: 0 } }}
        />
      </div>
    </DashboardCard>
  );
}
