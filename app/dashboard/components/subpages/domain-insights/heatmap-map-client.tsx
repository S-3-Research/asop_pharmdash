"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import type { Domain, DomainWithMatch } from "../../types";
import { formatCityDisplay, formatAddressSource } from "@/lib/geo-format";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const CAT_COLORS: Record<string, string> = {
  "GLP-1":      "#3b82f6",
  "Cancer Med": "#10b981",
  "CNS Med":    "#a855f7",
  "Pain Med":   "#f59e0b",
};

const FALLBACK_PALETTE = ["#ef4444", "#0ea5e9", "#84cc16", "#ec4899", "#14b8a6", "#8b5cf6"];

// Distinct color for domains that sell products across 2+ primary categories
// (primaryCategories.length > 1) — avoids implying such a domain belongs to
// just one category via an arbitrary "first match" color.
const MULTI_CATEGORY_COLOR = "#f43f5e";

function categoryColor(label: string): string {
  if (CAT_COLORS[label]) return CAT_COLORS[label];
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

interface TooltipCategoryCount {
  primary: string;
  /** Number of this domain's products (categories[]) resolving to this same
   *  primary category name; 0 when this domain-level category (from
   *  product_label) has no matching product — rendered as a bare label. */
  count: number;
}

interface TooltipState {
  domain: string;
  isLive: boolean;
  /** This domain's primaryCategories (product_label), each paired with its
   *  product count, so the tooltip lists every domain-level category the
   *  domain is tagged with — not just a single "representative" pair. */
  categories: TooltipCategoryCount[];
  registrar: string;
  /** Formatted "type · provider" string, or a "no data" placeholder — never
   *  a fabricated default like "Credit Card" when the release reported no
   *  payment_info at all. */
  paymentLabel: string;
  city: string;
  /** Formatted address_source label ("WHOIS" / "Website"), or "" when the
   *  release didn't report one — never shown as a fake-precision default. */
  addressSource: string;
  x: number;
  y: number;
}

export function HeatmapMapClient({
  domains,
  selectedCategories,
}: {
  domains: (Domain | DomainWithMatch)[];
  /** Currently-selected primary-category filters. When 2+ categories are
   *  selected, a domain's point color reflects whichever of ITS OWN
   *  categories is first among the selected set, instead of always using
   *  the domain's single "representative" primaryCategory (which may not
   *  even be one of the selected categories) — avoids a misleading color
   *  when a domain matches multiple selected categories. */
  selectedCategories?: string[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef   = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  // Evaluate once — NEXT_PUBLIC_ vars are inlined at build time
  const noToken = !MAPBOX_TOKEN;

  const geojson = useMemo(
    () => {
      // Spiderfy: many domains share a fallback city-center coordinate and
      // would otherwise render as fully-overlapping circles. Track how many
      // points have already been placed at each rounded coordinate and, for
      // the 2nd+ point at that location, nudge it outward along a small
      // spiral in degree-space. The same degree offset maps to a larger
      // on-screen pixel distance at higher zoom levels, so these offsets
      // naturally merge back together when zoomed out (still looks like one
      // point) and visibly separate out when zoomed in — no zoom-dependent
      // recompute needed.
      const coordCounts = new Map<string, number>();
      return {
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
            // Domain-level primary category matching (d.primaryCategories,
            // from product_label — the sole source of truth for "what
            // category is this domain") drives both point color and which
            // categories the tooltip lists — independent from the
            // product-level `categories[]` detail used only to compute the
            // per-category product count below.
            const matchedCategory =
              selectedCategories && selectedCategories.length > 0
                ? (d.primaryCategories.find((c) => selectedCategories.includes(c)) ??
                  d.primaryCategories[0] ??
                  "Uncategorized")
                : (d.primaryCategories[0] ?? "Uncategorized");
            // Domains tagged with 2+ primary categories render in a distinct
            // blended color rather than an arbitrary "first match" color.
            const isMultiCategory = d.primaryCategories.length > 1;
            // Product count per domain-level primary category — 0 when this
            // domain has no product resolving to that same category name
            // (tooltip shows the bare category name in that case, no "×N").
            const productCountByPrimary = d.categories.reduce<Record<string, number>>((acc, c) => {
              if (c.primary !== "Uncategorized") acc[c.primary] = (acc[c.primary] ?? 0) + 1;
              return acc;
            }, {});
            const primaryCategoriesForTooltip =
              d.primaryCategories.length > 0 ? d.primaryCategories : ["Uncategorized"];

            const baseLng = d.geoLocation.lng;
            const baseLat = d.geoLocation.lat;
            const key = `${baseLat.toFixed(4)},${baseLng.toFixed(4)}`;
            const idx = coordCounts.get(key) ?? 0;
            coordCounts.set(key, idx + 1);
            let lng = baseLng;
            let lat = baseLat;
            if (idx > 0) {
              const angle = idx * 2.4; // golden-angle-ish spread (radians)
              const radius = 0.0006 * Math.sqrt(idx); // degrees
              lng += radius * Math.cos(angle);
              lat += radius * Math.sin(angle);
            }

            return {
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: [lng, lat] as [number, number],
              },
              properties: {
                domain:            d.domain,
                isLive:            d.isLive,
                // Serialized [{primary, count}] pairs for the tooltip — parsed
                // back out in the mousemove handler.
                categoriesJson:    JSON.stringify(
                  primaryCategoriesForTooltip.map((primary) => ({
                    primary,
                    count: productCountByPrimary[primary] ?? 0,
                  })),
                ),
                registrar:         d.whois.registrar,
                paymentLabel,
                city:              d.geoLocation.city,
                addressSource:     d.geoLocation.addressSource ?? "",
                color:             isMultiCategory ? MULTI_CATEGORY_COLOR : categoryColor(matchedCategory),
                // Point size reflects the number of this domain's products
                // matching the current filter (or its total product count
                // when unfiltered) — see heatmap-card.tsx / domain-insights-
                // subpage.tsx for the "does this domain match at all" logic,
                // which is a separate, domain-level (primaryCategories) check.
                weight:
                  selectedCategories && selectedCategories.length > 0
                    ? Math.max(
                        1,
                        d.categories.filter((c) => selectedCategories.includes(c.primary)).length,
                      )
                    : Math.max(1, d.categories.length),
              },
            };
          }),
      };
    },
    [domains, selectedCategories],
  );

  // Distinct primary categories present across the current (filtered)
  // domain set — drives the legend. "Uncategorized" is excluded (matches
  // the point-color fallback, which only applies when a domain has no
  // primaryCategories at all — rare/edge-case, not worth a legend entry).
  // Built from geoLocation-plottable domains only (mirrors the `geojson`
  // filter above) — a category with domains that all lack resolvable
  // coordinates would otherwise show a legend entry for a color that never
  // actually appears as a point on the map. A single-category name is only
  // included when some plotted domain resolves to THAT category alone
  // (primaryCategories.length === 1) — a domain with 2+ categories always
  // renders as the "Multiple Categories" blended color (see `geojson`
  // above), so its individual category names never actually appear as a
  // point color and shouldn't get their own legend entry just because
  // they're present in some multi-category domain's list.
  const legendEntries = useMemo(() => {
    const names = new Set<string>();
    let hasMulti = false;
    for (const d of domains) {
      if (d.geoLocation.lat === 0 && d.geoLocation.lng === 0) continue;
      if (d.primaryCategories.length > 1) {
        hasMulti = true;
      } else if (d.primaryCategories.length === 1 && d.primaryCategories[0] !== "Uncategorized") {
        names.add(d.primaryCategories[0]);
      }
    }
    const entries = Array.from(names)
      .sort()
      .map((name) => ({ name, color: categoryColor(name) }));
    if (hasMulti) entries.push({ name: "Multiple Categories", color: MULTI_CATEGORY_COLOR });
    return entries;
  }, [domains]);

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

    // Compact (icon-only) attribution — keeps required Mapbox/OSM credit per
    // ToS without the full-text watermark taking up visual space.
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

    // ── Map controls: zoom in/out + fullscreen ────────────────────────────
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    // Target the outer wrapper (which also contains the tooltip overlay)
    // rather than the map's own container — the Fullscreen API only renders
    // the requested element's subtree, so if only containerRef were sent
    // fullscreen, the tooltip (a sibling, not a descendant, of the map
    // container) would be invisible while in fullscreen mode.
    map.addControl(
      new mapboxgl.FullscreenControl({ container: wrapperRef.current ?? undefined }),
      "top-right",
    );
    // Observe container size changes — fires when the flex layout resolves
    // a non-zero height, even if the container was 0×0 at map creation time.
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    map.on("load", () => {
      // Also force resize once the style is ready
      map.resize();

      map.addSource("domains", { type: "geojson", data: geojsonRef.current });

      // NOTE: The heatmap-density layer + its layer-toggle button have been
      // temporarily disabled (points-only view). To re-enable, restore the
      // "domains-heat" heatmap layer and the LayerToggleControl removed here.

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
        let categories: TooltipCategoryCount[] = [];
        try {
          const parsed = JSON.parse(String(props.categoriesJson ?? "[]"));
          if (Array.isArray(parsed)) categories = parsed;
        } catch {
          categories = [];
        }
        if (categories.length === 0) {
          categories = [{ primary: "Uncategorized", count: 0 }];
        }
        setTooltip({
          domain:       String(props.domain ?? ""),
          isLive:       props.isLive === true || props.isLive === "true",
          categories,
          registrar:    String(props.registrar ?? ""),
          paymentLabel: String(props.paymentLabel ?? "No payment data"),
          city:         formatCityDisplay(String(props.city ?? "")),
          addressSource: formatAddressSource(
            (props.addressSource as "whois" | "web" | "" | undefined) || null,
          ),
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
    <div ref={wrapperRef} className="absolute inset-0 h-full">
      <div ref={containerRef} className="absolute inset-0 h-full" />

      {/* Category legend */}
      {legendEntries.length > 0 && (
        <div className="absolute z-20 bottom-3 left-3 bg-white/95 backdrop-blur rounded-lg shadow-md border border-slate-100 px-2.5 py-2 pointer-events-none">
          <div className="flex flex-col gap-1">
            {legendEntries.map(({ name, color }) => (
              <div key={name} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[10px] font-medium text-slate-600 whitespace-nowrap">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[10px] mb-2">
              <dt className="text-slate-400 self-start">Category</dt>
              <dd className="space-y-0.5">
                {tooltip.categories.map(({ primary, count }) => (
                  <div key={primary} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: categoryColor(primary) }}
                    />
                    <span className="font-medium truncate" style={{ color: categoryColor(primary) }}>
                      {primary}
                    </span>
                    {count > 1 && (
                      <span className="text-slate-400 text-[9px]">×{count}</span>
                    )}
                  </div>
                ))}
              </dd>
            </dl>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[10px]">
              <dt className="text-slate-400">Registrar</dt>
              <dd className="text-slate-700 truncate">{tooltip.registrar}</dd>
              <dt className="text-slate-400">Payment</dt>
              <dd className="text-slate-700 truncate">{tooltip.paymentLabel}</dd>
              {tooltip.addressSource && (
                <>
                  <dt className="text-slate-400">Location Source</dt>
                  <dd className="text-slate-700 truncate">{tooltip.addressSource}</dd>
                </>
              )}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
