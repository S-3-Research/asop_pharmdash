import type { ReactNode } from "react";
import { Lightbulb } from "lucide-react";

/**
 * Whether <KeyTakeaway> content is currently suppressed (see below). Call
 * sites that wrap a <KeyTakeaway> in a divider/footer element (either via
 * DashboardCard's `note` prop or a hand-rolled `border-t` wrapper div) MUST
 * check this flag and omit the wrapper entirely when true — otherwise the
 * wrapper still renders (and its divider still shows) even though
 * <KeyTakeaway> itself renders nothing, since the wrapper's own
 * conditional is based on whether *a note element was passed*, not on
 * whether that element renders visible content.
 */
export const KEY_TAKEAWAY_SUPPRESSED = true;

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
  // Suppressed for now across every card that uses it (top-products,
  // social-media, domain-insights) — the underlying copy is placeholder
  // "(example data)" text, not a real insight yet. Returning null here
  // (rather than removing every call site) keeps this a single toggle
  // point to re-enable once real takeaway copy/logic exists.
  //
  // NOTE: every call site must also skip its divider wrapper when
  // KEY_TAKEAWAY_SUPPRESSED is true (see comment above) — this component
  // returning null is not sufficient on its own to hide the divider.
  void children;
  return null;
}
