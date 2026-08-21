import type { SubPageKey, TrendDirection } from "../types";

// ── Page Context ──────────────────────────────────────────────────────────────

export interface PageFilters {
  /** Primary category names that are currently selected, e.g. ["GLP-1", "Cancer Med"] */
  categories: string[];
  /** Social-media platform filter; undefined means "all" */
  platform?: string;
}

/**
 * The REAL set of filter options selectable on the current page, derived
 * live from whatever release data is loaded (never a hardcoded list) — the
 * Copilot must only ever suggest/apply values found here, since each page's
 * category taxonomy and single-vs-multi selection mode can differ (and can
 * change release to release).
 */
export interface AvailableFilters {
  /** Every selectable category name on this page right now */
  categories: string[];
  /** Whether this page's category filter allows one selection or many */
  categorySelectionMode: "single" | "multi";
  /** Every selectable platform value on this page right now; omitted/undefined
   *  on pages with no platform filter (e.g. Domain Insights) */
  platforms?: string[];
}

export interface PageStat {
  label: string;
  value: string | number;
  change?: string | null;
  direction?: TrendDirection | null;
}

export interface PageContext {
  page: SubPageKey;
  pageTitle: string;
  /** Reporting period identifier derived from the published data release,
   *  e.g. "2026-RPT-02" (2nd reporting period of 2026). Empty until data loads.
   *  No concrete dates are exposed. */
  reportingPeriod: string;
  filters: PageFilters;
  /** Real, live-derived filter options for this page — see AvailableFilters doc */
  availableFilters: AvailableFilters;
  /** Snapshot of visible metrics on the current page */
  stats: PageStat[];
}

// ── Selected Widget ───────────────────────────────────────────────────────────

export type WidgetType =
  | "metric-card"
  | "chart"
  | "ranked-list"
  | "table"
  | "map"
  | "distribution";

export interface WidgetDataPoint {
  label: string;
  value: string | number;
}

/** Live data + prompt metadata a card publishes to the Copilot registry */
export interface WidgetDataEntry {
  dataPoints: WidgetDataPoint[];
  /**
   * Card-specific prompt fragment: explains WHAT the card displays and WHERE
   * the data comes from (source, computation, caveats). Appended verbatim to
   * the system prompt when this widget is selected.
   */
  prompt?: string;
}

/** One card's registry entry paired with its id — used for page-level dumps */
export interface WidgetSnapshot extends WidgetDataEntry {
  widgetId: string;
}

export interface SelectedWidget {
  widgetId: string;
  title: string;
  type: WidgetType;
  description?: string;
  dataPoints?: WidgetDataPoint[];
  /** Card-provided prompt fragment describing content & data provenance */
  dataNote?: string;
}

// ── Filter Actions ────────────────────────────────────────────────────────────

export type FilterAction =
  | { type: "SET_CATEGORIES"; categories: string[] }
  | { type: "SET_PLATFORM"; platform: string }
  | { type: "CLEAR_FILTERS" };

export interface PendingAction {
  id: string;
  action: FilterAction;
  /** Human-readable description shown in the confirmation banner */
  description: string;
}

// ── Copilot Context ───────────────────────────────────────────────────────────

export interface CopilotContextValue {
  // ── Page state ──
  pageContext: PageContext;
  updatePageContext: (patch: Partial<PageContext>) => void;

  // ── Widget selection ──
  selectedWidget: SelectedWidget | null;
  setSelectedWidget: (w: SelectedWidget | null) => void;

  // ── Live widget data registry ──
  /**
   * Cards report the data they are currently rendering. The Copilot panel
   * pulls the latest snapshot by widgetId at send time, so no eager
   * aggregation or stale-selection syncing is needed.
   */
  reportWidgetData: (widgetId: string, entry: WidgetDataEntry | null) => void;
  getWidgetData: (widgetId: string) => WidgetDataEntry | undefined;
  /** Snapshot of every currently mounted card's live data (for page-level prompts) */
  getAllWidgetData: () => WidgetSnapshot[];

  // ── Filter actions ──
  pendingAction: PendingAction | null;
  proposePendingAction: (a: PendingAction) => void;
  confirmPendingAction: () => void;
  cancelPendingAction: () => void;
  /**
   * Each subpage registers its own handler so the Copilot can apply filter
   * changes to the currently visible page. Only the most recently registered
   * handler is retained (one page at a time).
   */
  registerFilterHandler: (handler: (a: FilterAction) => void) => void;

  // ── Panel visibility ──
  isPanelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
}
