"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Shared loading / error placeholders for subpages that fetch their data via
 * SWR. Standardizes copy pattern ("Loading {label}…" / rose-500 error text)
 * and vertical rhythm across Top Products, Domain Insights, and Social Media
 * Insights, which previously each rolled their own slightly different
 * markup.
 *
 * Height is computed at runtime from the block's own position to the bottom
 * of the viewport (minus a little breathing room), rather than a hardcoded
 * pixel guess per page — so it naturally fills whatever's left below the
 * header/summary-strip/filter row on every page and every screen size,
 * without those pages needing to hand-tune a height constant. Falls back to
 * `minHeight` (default 320px) below that, so it never collapses to nothing
 * on very short viewports or before the initial measurement runs.
 */
export function PageLoadingState({
  label,
  minHeight = 320,
}: {
  label: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(minHeight);

  useEffect(() => {
    const BOTTOM_MARGIN = 24;

    function measure() {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      setHeight(Math.max(minHeight, window.innerHeight - top - BOTTOM_MARGIN));
    }

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [minHeight]);

  return (
    <div
      ref={ref}
      style={{ height }}
      className="relative flex items-center justify-center overflow-hidden rounded-2xl bg-slate-200"
    >
      <div className="absolute inset-0 -translate-x-full animate-skeleton-shimmer bg-gradient-to-r from-transparent via-white/80 to-transparent" />
      <span className="relative text-sm font-medium text-slate-500">Loading {label}…</span>
    </div>
  );
}

export function PageErrorState({ label }: { label: string }) {
  return (
    <div className="animate-fade-slide-in text-sm text-rose-500 text-center py-12">
      Failed to load {label}. Please try again.
    </div>
  );
}
