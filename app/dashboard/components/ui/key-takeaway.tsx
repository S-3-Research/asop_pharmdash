import type { ReactNode } from "react";
import { Lightbulb } from "lucide-react";

/**
 * Standard "Key takeaway" footer content for dashboard cards — pass this
 * into a card's `note` prop (DashboardCard / HighchartsCard both support
 * arbitrary ReactNode there) to get a consistent icon + label treatment.
 *
 * This does NOT replace the existing `note` mechanism — cards that already
 * pass their own custom footer content (e.g. the Listing Trend chart's
 * dashed-baseline legend) keep working unchanged. Use <KeyTakeaway> only
 * where a plain "insight" sentence is wanted.
 */
export function KeyTakeaway({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-xs text-slate-500">
      <Lightbulb aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-500" />
      <span>{children}</span>
    </p>
  );
}
