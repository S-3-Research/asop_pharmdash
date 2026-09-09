// ─── Shared category → color helper (client-safe) ────────────────────────────
// Extracted out of lib/release-mapping.ts (which has `import "server-only"`
// and therefore can't be imported from Client Components — see the map,
// samples card, and domain-insights config, which are all "use client").
// This is the SINGLE source of truth for category colors across the whole
// app (sunburst, treemap, dropdowns, map, map legend, samples chips) so the
// same category name always renders with the same color everywhere.

/** Deterministic color for a category label — stable across reloads since
 *  it's derived from the label string itself, not array order. Used only
 *  as a fallback for category names not in `FIXED_CATEGORY_COLORS` below
 *  (which should be exhaustive for every current `ProductCategory` enum
 *  value — see lib/release-mapping.ts `CATEGORY_DISPLAY_LABELS`). */
function hashColor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

const FALLBACK_PALETTE = [
  "#3b82f6",
  "#10b981",
  "#a855f7",
  "#f59e0b",
  "#ef4444",
  "#0ea5e9",
  "#84cc16",
  "#ec4899",
  "#14b8a6",
  "#8b5cf6",
];

// Hues chosen to be maximally spaced around the color wheel so no two
// categories are easily confused at small sizes (map dots, legend swatches,
// chips): blue / emerald / amber / purple.
const FIXED_CATEGORY_COLORS: Record<string, string> = {
  "GLP": "#3b82f6",
  "Cancer Med": "#10b981",
  "Emerging Molecules": "#f59e0b",
  "IND": "#a855f7",
};

/** Neutral, non-hued color for the "Uncategorized" placeholder (domains with
 *  no product_label at all) — explicitly pinned rather than left to fall
 *  through to hashColor(), whose palette-index-by-string-hash happened to
 *  collide with IND's fixed purple (#a855f7), making genuinely-uncategorized
 *  domains render (and appear in the map legend) as if they were IND. Same
 *  slate tone as heatmap-map-client's MULTI_CATEGORY_COLOR so both
 *  "not a single real category" cases read as visually de-emphasized/gray
 *  rather than any real category hue. */
const UNCATEGORIZED_COLOR = "#94a3b8";

export function getCategoryColor(label: string): string {
  if (label === "Uncategorized") return UNCATEGORIZED_COLOR;
  return FIXED_CATEGORY_COLORS[label] ?? hashColor(label);
}
