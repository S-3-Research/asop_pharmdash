// ─── Shared constants & utilities for the Top-Products subpage ───────────────
// Single source of truth — imported by trend-chart.tsx, mock-data.ts,
// and the parent subpage component.

/** Current reporting period — update here to reflect across all cards */
export const CURRENT_PERIOD = "Q2 2026";

export const ALL_PRIMARY = ["GLP-1", "Cancer Med", "CNS Med", "Pain Med"] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  "GLP-1": "#3b82f6",
  "Cancer Med": "#10b981",
  "CNS Med": "#a855f7",
  "Pain Med": "#f59e0b",
};

/** Parse "April-2024" → Date (used for chronological sorting only, not display) */
export function parseMonthKey(key: string): Date {
  const dashIdx = key.lastIndexOf("-");
  return new Date(`${key.slice(0, dashIdx)} 1, ${key.slice(dashIdx + 1)}`);
}

/** "April-2024" → "Apr 2024" for chart axis labels */
export function formatMonthLabel(key: string): string {
  return parseMonthKey(key).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}
