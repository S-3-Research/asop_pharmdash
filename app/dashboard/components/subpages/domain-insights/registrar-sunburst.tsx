"use client";

import dynamic from "next/dynamic";
import Highcharts from "highcharts";

import { useMemo, useState, useRef, useEffect } from "react";
import { DashboardCard } from "../../ui/dashboard-card";
import { KeyTakeaway } from "../../ui/key-takeaway";
import { useWidgetData } from "../../copilot/copilot-context";
import { buildRegistrarSunburstPoints, REGISTRAR_GRADIENT, REGISTRAR_UNKNOWN_COLOR } from "./config";
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
  // Set of legend labels currently hidden from the chart — any legend row
  // (Unknown or a named top-2 registrar) can be toggled off to focus on the
  // remaining segments; empty by default (everything shown).
  const [hiddenLabels, setHiddenLabels] = useState<Set<string>>(new Set());

  const toggleLabel = (label: string) => {
    setHiddenLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

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
      if (hiddenLabels.has(r)) continue;
      if (!byRegistrar.has(r)) byRegistrar.set(r, new Set());
      byRegistrar.get(r)!.add(d.domain);
    }
    return [...byRegistrar.entries()]
      .map(([label, set]) => ({ label, value: set.size }))
      .sort((a, b) => (b.value as number) - (a.value as number));
  }, [domains, hiddenLabels]);
  useWidgetData(
    "domain-registrar",
    registrarCounts,
    "Sunburst chart of the registrars used by the rogue domains; each value is the number of unique domains registered with that registrar. " +
      "Data source: WHOIS registrar field of each domain record in the published data release (deduplicated by domain name). " +
      `Counts reflect the page's current category filter${hiddenLabels.size === 0 ? "" : `, with ${[...hiddenLabels].join(", ")} hidden via the legend`}.`,
  );

  // ── Legend model — always computed from the FULL/unfiltered-by-hiding
  //    set so each row's share always reflects its true (unhidden) count,
  //    and every row remains clickable regardless of its current visibility.
  //    Shows Unknown + the top 2 named registrars only (no "Others" bucket). ──
  const legendItems = useMemo(() => {
    const byRegistrar = new Map<string, Set<string>>();
    for (const d of domains) {
      const r = d.whois.registrar.trim() || "Unknown";
      if (!byRegistrar.has(r)) byRegistrar.set(r, new Set());
      byRegistrar.get(r)!.add(d.domain);
    }
    const total = domains.length;
    const unknown = byRegistrar.get("Unknown");
    const named = [...byRegistrar.entries()]
      .filter(([label]) => label !== "Unknown")
      .sort((a, b) => b[1].size - a[1].size);
    const top2 = named.slice(0, 2);

    const rows: { label: string; count: number; color: string }[] = [];
    if (unknown && unknown.size > 0) {
      rows.push({ label: "Unknown", count: unknown.size, color: REGISTRAR_UNKNOWN_COLOR });
    }
    top2.forEach(([label, set], i) => {
      rows.push({ label, count: set.size, color: REGISTRAR_GRADIENT[i % REGISTRAR_GRADIENT.length] });
    });
    return rows.map((r) => ({ ...r, pct: total > 0 ? Math.round((r.count / total) * 100) : 0 }));
  }, [domains]);

  const options = useMemo<Highcharts.Options>(
    () => ({
      chart: {
        type: "sunburst",
        backgroundColor: "transparent",
        style: { fontFamily: "var(--font-geist-sans)" },
        margin: [0, 0, 0, 0],
        spacing: [0, 0, 0, 0],
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
          data: buildRegistrarSunburstPoints(domains, { excludeLabels: [...hiddenLabels] }) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        },
      ],
    }),
    [domains, hiddenLabels],
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
      <div className="flex h-full gap-3">
        {/* Legend — Unknown + top 2 registrars, each independently clickable to show/hide */}
        <ul className="flex w-24 shrink-0 flex-col justify-center gap-2.5">
          {legendItems.map((item) => {
            const dimmed = hiddenLabels.has(item.label);
            return (
              <li key={item.label}>
                <button
                  type="button"
                  onClick={() => toggleLabel(item.label)}
                  title={dimmed ? `Show ${item.label}` : `Hide ${item.label}`}
                  aria-pressed={!dimmed}
                  className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-slate-50"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={
                      dimmed
                        ? { border: `1.5px solid ${item.color}`, backgroundColor: "transparent" }
                        : { backgroundColor: item.color }
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[10px] font-medium leading-tight ${
                        dimmed ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      {item.label}
                    </span>
                    <span className={`block text-[10px] leading-tight ${dimmed ? "text-slate-300" : "text-slate-400"}`}>
                      {item.pct}%
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div ref={chartWrapRef} className="relative flex-1 min-w-0">
          <HighchartsReact
            ref={chartCompRef}
            highcharts={Highcharts}
            options={options}
            immutable
            containerProps={{ style: { position: "absolute", inset: 0 } }}
          />
        </div>
      </div>
    </DashboardCard>
  );
}
