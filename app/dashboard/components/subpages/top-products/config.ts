// ─── Shared constants & utilities for the Top-Products subpage ───────────────
// Single source of truth — imported by trend-chart.tsx, mock-data.ts,
// and the parent subpage component.

/** Current reporting CBU — update here to reflect across all cards */
export const CURRENT_PERIOD = "2026-CBU-02";

export const ALL_PRIMARY = ["GLP-1", "Cancer Med", "CNS Med", "Pain Med"] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  "GLP-1": "#3b82f6",
  "Cancer Med": "#10b981",
  "CNS Med": "#a855f7",
  "Pain Med": "#f59e0b",
};

// ── CBU helpers ───────────────────────────────────────────────────────────────
// CBU format: "YYYY-CBU-NN"  e.g. "2026-CBU-01"
// Each CBU is a rolling 3-month independent measurement window.
// 4 CBUs per year: 01, 02, 03, 04.

/** Parse "2026-CBU-01" → Date (used for chronological sorting only) */
export function parseCbuKey(key: string): Date {
  const [yearStr, , numStr] = key.split("-");
  const year = parseInt(yearStr, 10);
  const num  = parseInt(numStr, 10); // 1–4
  const month = (num - 1) * 3;       // 0, 3, 6, 9
  return new Date(year, month, 1);
}

/** "2026-CBU-01" → "2026 CBU-01" (chart axis label) */
export function formatCbuLabel(key: string): string {
  return key.replace("-", " ");
}

/** Returns the immediately preceding CBU key.
 *  "2026-CBU-02" → "2026-CBU-01"  |  "2026-CBU-01" → "2025-CBU-04" */
export function prevCbuKey(key: string): string {
  if (!key) return "";
  const [yearStr, , numStr] = key.split("-");
  const year = parseInt(yearStr, 10);
  const num  = parseInt(numStr, 10);
  if (num === 1) return `${year - 1}-CBU-04`;
  return `${year}-CBU-${String(num - 1).padStart(2, "0")}`;
}
