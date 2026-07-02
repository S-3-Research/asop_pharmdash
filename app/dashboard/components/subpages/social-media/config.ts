import type { CategoryOption } from "../../types";

export const PLATFORM_COLORS: Record<string, string> = {
  Reddit:    "#ff4500",
  X:         "#1a1a1a",
  YouTube:   "#ef4444",
  Instagram: "#e1306c",
  TikTok:    "#2d2d2d",
  Telegram:  "#0088cc",
  Discord:   "#5865f2",
  Quora:     "#b92b27",
  default:   "#64748b",
};

/** Brand colors for external apps mentioned in post text (mentions[] field) */
export const APP_COLORS: Record<string, string> = {
  WhatsApp:  "#25d366",
  Telegram:  "#0088cc",
  Signal:    "#3a76f0",
  Snapchat:  "#f5c518",
  Venmo:     "#3d95ce",
  "Cash App": "#00d54b",
  Zelle:     "#6d1ed4",
  PayPal:    "#003087",
  Wickr:     "#e03c31",
  Kik:       "#82bc23",
  default:   "#94a3b8",
};

export const KEYWORD_COLORS = [
  "#ef4444", "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981",
  "#ec4899", "#f97316", "#06b6d4", "#84cc16", "#6366f1",
];

// IDs match primaryCategory values stored in posts (name-as-id, same pattern as domain-insights)
export const SOCIAL_PRIMARY_CATEGORIES: CategoryOption[] = [
  { id: "GLP-1",      name: "GLP-1",      color: "#3b82f6" },
  { id: "Cancer Med", name: "Cancer Med", color: "#10b981" },
  { id: "CNS Med",    name: "CNS Med",    color: "#a855f7" },
  { id: "Pain Med",   name: "Pain Med",   color: "#f59e0b" },
];
