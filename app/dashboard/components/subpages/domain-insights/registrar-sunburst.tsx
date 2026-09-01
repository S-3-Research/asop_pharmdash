"use client";

import dynamic from "next/dynamic";
import Highcharts from "highcharts";

import { useMemo, useState, useRef, useEffect } from "react";
import { DashboardCard } from "../../ui/dashboard-card";
import { KeyTakeaway, KEY_TAKEAWAY_SUPPRESSED } from "../../ui/key-takeaway";
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
      const r = d.whois.registrar.trim() || "Not Public";
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
  //    Shows the top 3 registrars by domain count, ranked purely by size —
  //    "Not Public" (unresolved WHOIS registrar) is just another bucket in
  //    that ranking, not a forced/pinned first row. ──
  const legendItems = useMemo(() => {
    const byRegistrar = new Map<string, Set<string>>();
    for (const d of domains) {
      const r = d.whois.registrar.trim() || "Not Public";
      if (!byRegistrar.has(r)) byRegistrar.set(r, new Set());
      byRegistrar.get(r)!.add(d.domain);
    }
    const total = domains.length;
    const sorted = [...byRegistrar.entries()].sort((a, b) => b[1].size - a[1].size);
    // Gradient colors are assigned by rank among named registrars only (same
    // rule buildRegistrarSunburstPoints uses), so a registrar's legend swatch
    // always matches its sunburst segment color; "Not Public" keeps its own
    // fixed neutral color wherever it lands in the ranking.
    let gradientIdx = 0;
    const colorByRegistrar = new Map<string, string>();
    for (const [registrar] of sorted) {
      if (registrar === "Not Public") continue;
      colorByRegistrar.set(registrar, REGISTRAR_GRADIENT[gradientIdx % REGISTRAR_GRADIENT.length]);
      gradientIdx++;
    }
    return sorted.slice(0, 3).map(([label, set]) => ({
      label,
      count: set.size,
      color: label === "Not Public" ? REGISTRAR_UNKNOWN_COLOR : colorByRegistrar.get(label)!,
      pct: total > 0 ? Math.round((set.size / total) * 100) : 0,
    }));
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
          // Domain leaf nodes always have value 1 (one point per domain) —
          // showing "xxx.com: 1 domain" is redundant noise, so leaf nodes
          // just show the domain name; only registrar (parent) nodes show
          // the aggregate "<b>Registrar</b>: N domains" count.
          const value = pt.point.options.value ?? 0;
          return value === 1 ? `<b>${label}</b>` : `<b>${label}</b>: ${value} domains`;
        },
      },
      plotOptions: {
        sunburst: {
          allowTraversingTree: true,
          // Level numbering resets relative to whatever node is currently
          // the traversal root (rather than always counting from the
          // overall data root) — this is what lets the domain-leaf ring
          // (level 3 below) stay collapsed by default but "become" the
          // now-outer, normal-size ring once a registrar segment is
          // clicked/traversed into.
          levelIsConstant: false,
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
          levels: [
            { level: 1 }, // center/root node
            { level: 2 }, // registrar ring — always visible at full size
            {
              // Domain leaf ring — collapsed to zero width by default so
              // only the registrar ring shows on first render; clicking a
              // registrar segment traverses into it (allowTraversingTree),
              // which re-roots the level numbering and makes this level
              // the new (normal-size) outer ring for that registrar's domains.
              level: 3,
              levelSize: { value: 0 },
              dataLabels: { enabled: false },
            },
          ],
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
      subtitle="Click a registrar to reveal its domains"
      className="h-full overflow-hidden"
      note={
        KEY_TAKEAWAY_SUPPRESSED ? undefined : (
          <KeyTakeaway>
            3 registrars account for 57% of all flagged domains. (example data)
          </KeyTakeaway>
        )
      }
    >
      <div className="flex h-full gap-3">
        {/* Legend — top 3 registrars by domain count, each independently clickable to show/hide */}
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
