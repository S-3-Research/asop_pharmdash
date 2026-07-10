import type { SubPageKey, TrendDirection } from "../types";

export const REPORTING_PERIOD_WINDOW = "2026-04-01 ~ 2026-06-30";

// ── Page Context ──────────────────────────────────────────────────────────────

export interface PageFilters {
  /** Primary category names that are currently selected, e.g. ["GLP-1", "Cancer Med"] */
  categories: string[];
  /** Social-media platform filter; undefined means "all" */
  platform?: string;
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
  reportingPeriod: string;
  filters: PageFilters;
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

export interface SelectedWidget {
  widgetId: string;
  title: string;
  type: WidgetType;
  description?: string;
  dataPoints?: WidgetDataPoint[];
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
  togglePanel: () => void;
}
