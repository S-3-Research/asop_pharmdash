"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import type { Domain, DomainWithMatch } from "../../types";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const CAT_COLORS: Record<string, string> = {
  "GLP-1":      "#3b82f6",
  "Cancer Med": "#10b981",
  "CNS Med":    "#a855f7",
  "Pain Med":   "#f59e0b",
};

const FALLBACK_PALETTE = ["#ef4444", "#0ea5e9", "#84cc16", "#ec4899", "#14b8a6", "#8b5cf6"];

function categoryColor(label: string): string {
  if (CAT_COLORS[label]) return CAT_COLORS[label];
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

interface TooltipState {
  domain: string;
  isLive: boolean;
  primaryCategory: string;
  secondaryCategory: string;
  registrar: string;
  /** Formatted "type · provider" string, or a "no data" placeholder — never
   *  a fabricated default like "Credit Card" when the release reported no
   *  payment_info at all. */
  paymentLabel: string;
  city: string;
  x: number;
  y: number;
}

export function HeatmapMapClient({ domains }: { domains: (Domain | DomainWithMatch)[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  // Evaluate once — NEXT_PUBLIC_ vars are inlined at build time
  const noToken = !MAPBOX_TOKEN;

  const geojson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      // Skip domains with no resolvable geo coordinates — avoids plotting a
      // cluster of unrelated domains at (0,0) in the Gulf of Guinea.
      features: domains
        .filter((d) => d.geoLocation.lat !== 0 || d.geoLocation.lng !== 0)
        .map((d) => {
          const payment = d.paymentInfo[0];
          const paymentLabel = !payment
            ? "No payment data"
            : payment.provider
              ? `${payment.type} \u00b7 ${payment.provider}`
              : payment.type;
          return {
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: [d.geoLocation.lng, d.geoLocation.lat] as [number, number],
            },
            properties: {
              domain:            d.domain,
              isLive:            d.isLive,
              primaryCategory:   d.primaryCategory,
              secondaryCategory: d.secondaryCategory,
              registrar:         d.whois.registrar,
              paymentLabel,
              city:              d.geoLocation.city,
              color:             categoryColor(d.primaryCategory),
              // Number of currently-selected categories this domain matches —
              // drives heatmap density weight / circle size. Defaults to 1 when
              // the caller hasn't computed a matchCount (e.g. unfiltered Domain[]).
              weight:            "matchCount" in d ? Math.max(1, d.matchCount) : 1,
            },
          };
        }),
    }),
    [domains],
  );

  // Keep a stable ref so the load callback always sees the latest data
  const geojsonRef = useRef(geojson);
  geojsonRef.current = geojson;

  // ── Mount map (synchronous, no async import chain) ────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current || noToken) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:     "mapbox://styles/mapbox/light-v11",
      center:    [-98, 39],
      zoom:      3.2,
      attributionControl: false,
    });
    mapRef.current = map;

    // ── Map controls: zoom in/out + fullscreen ────────────────────────────
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    map.addControl(new mapboxgl.FullscreenControl(), "top-right");

    // Observe container size changes — fires when the flex layout resolves
    // a non-zero height, even if the container was 0×0 at map creation time.
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    map.on("load", () => {
      // Also force resize once the style is ready
      map.resize();

      map.addSource("domains", { type: "geojson", data: geojsonRef.current });

      // ── Heatmap density layer (low zoom) ──────────────────────────────────
      map.addLayer({
        id:      "domains-heat",
        type:    "heatmap",
        source:  "domains",
        maxzoom: 8,
        paint: {
          "heatmap-weight":    ["get", "weight"],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 8, 3],
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0,   "rgba(33,102,172,0)",
            0.2, "rgba(103,169,207,0.6)",
            0.4, "rgba(209,229,240,0.8)",
            0.6, "rgba(253,219,199,0.9)",
            0.8, "rgba(239,138,98,1)",
            1,   "rgba(178,24,43,1)",
          ],
          "heatmap-radius":  ["interpolate", ["linear"], ["zoom"], 0, 25, 8, 50],
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 6, 1, 9, 0],
        },
      });

      // ── Circle markers ────────────────────────────────────────────────────
      map.addLayer({
        id:     "domains-point",
        type:   "circle",
        source: "domains",
        paint: {
          // Mapbox GL requires "zoom" to only appear as the input of a
          // top-level step/interpolate expression — it cannot be nested
          // inside another expression's output. So the outer interpolate
          // must key on zoom, with the weight-based radius nested as each
          // zoom stop's *output* value (that nesting direction is fine).
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            2, ["interpolate", ["linear"], ["get", "weight"], 1, 5, 10, 10],
            9, ["interpolate", ["linear"], ["get", "weight"], 1, 14, 10, 22],
          ],
          "circle-color":          ["get", "color"],
          "circle-opacity":        0.88,
          "circle-stroke-width":   1.5,
          "circle-stroke-color":   "#ffffff",
          "circle-stroke-opacity": 0.9,
        },
      });

      // ── Hover events ──────────────────────────────────────────────────────
      map.on("mousemove", "domains-point", (e) => {
        const feature = e.features?.[0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const props = (feature as any)?.properties as Record<string, unknown> | undefined;
        if (!props) return;
        map.getCanvas().style.cursor = "pointer";
        setTooltip({
          domain:            String(props.domain ?? ""),
          isLive:            props.isLive === true || props.isLive === "true",
          primaryCategory:   String(props.primaryCategory ?? ""),
          secondaryCategory: String(props.secondaryCategory ?? ""),
          registrar:         String(props.registrar ?? ""),
          paymentLabel:      String(props.paymentLabel ?? "No payment data"),
          city:              String(props.city ?? ""),
          x: e.point.x,
          y: e.point.y,
        });
      });

      map.on("mouseleave", "domains-point", () => {
        map.getCanvas().style.cursor = "";
        setTooltip(null);
      });
    });

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync GeoJSON source when filter changes ───────────────────────────────
  useEffect(() => {
    const src = mapRef.current?.getSource("domains") as mapboxgl.GeoJSONSource | undefined;
    src?.setData(geojson as Parameters<mapboxgl.GeoJSONSource["setData"]>[0]);
  }, [geojson]);

  if (noToken) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-slate-400 text-sm px-6 text-center">
        Add{" "}
        <code className="mx-1 font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
          NEXT_PUBLIC_MAPBOX_TOKEN
        </code>{" "}
        to .env.local
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 h-full" />

      {/* Domain hover tooltip */}
      {tooltip && (
        <div
          className="absolute z-30 pointer-events-none"
          style={{
            left:      tooltip.x + 16,
            top:       tooltip.y - 10,
            transform: tooltip.x > 260 ? "translateX(calc(-100% - 32px))" : undefined,
          }}
        >
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 p-3 w-52">
            <p className="text-xs font-semibold text-slate-800 truncate mb-2">
              {tooltip.domain}
            </p>
            <div className="flex items-center gap-1.5 mb-2.5">
              <span
                className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                  tooltip.isLive ? "bg-emerald-400" : "bg-slate-300"
                }`}
              />
              <span
                className={`text-[10px] font-medium ${
                  tooltip.isLive ? "text-emerald-600" : "text-slate-400"
                }`}
              >
                {tooltip.isLive ? "Live" : "Offline"}
              </span>
              <span className="ml-auto text-[10px] text-slate-400 truncate">
                {tooltip.city}
              </span>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[10px]">
              <dt className="text-slate-400">Category</dt>
              <dd
                className="font-medium truncate"
                style={{ color: categoryColor(tooltip.primaryCategory) }}
              >
                {tooltip.primaryCategory}
              </dd>
              <dt className="text-slate-400">Product</dt>
              <dd className="text-slate-700 truncate">{tooltip.secondaryCategory}</dd>
              <dt className="text-slate-400">Registrar</dt>
              <dd className="text-slate-700 truncate">{tooltip.registrar}</dd>
              <dt className="text-slate-400">Payment</dt>
              <dd className="text-slate-700 truncate">{tooltip.paymentLabel}</dd>
            </dl>
          </div>
        </div>
      )}
    </>
  );
}
