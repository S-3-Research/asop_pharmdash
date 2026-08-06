import type { CategoryOption } from "../../types";

// Keys match the lowercase `socialmedia_platform` enum values coming from the
// release schema (see SocialMediaPlatform in lib/schemas/pharmdash.ts), NOT
// the platforms' display/brand names. Always look these up via
// platformColor() below, which lowercases the input, rather than indexing
// this map directly with a raw display-cased string.
export const PLATFORM_COLORS: Record<string, string> = {
  facebook:  "#1877f2",
  instagram: "#e1306c",
  reddit:    "#ff4500",
  twitter:   "#1a1a1a",
  threads:   "#000000",
  linkedin:  "#0a66c2",
  tiktok:    "#2d2d2d",
  youtube:   "#ef4444",
  tumblr:    "#35465c",
  pinterest: "#bd081c",
  quora:     "#b92b27",
  whatsapp:  "#25d366",
  telegram:  "#0088cc",
  snapchat:  "#f5c518",
  "about.me": "#00a98f",
  kik:       "#82bc23",
  myspace:   "#000000",
  venmo:     "#3d95ce",
  signal:    "#3a76f0",
  discord:   "#5865f2",
  default:   "#64748b",
};

/** Case-insensitive lookup so a display-cased or mis-cased platform value
 *  (e.g. "Facebook", "TikTok") still resolves to the right brand color
 *  instead of silently falling back to gray. */
export function platformColor(platform: string): string {
  return PLATFORM_COLORS[platform.toLowerCase()] ?? PLATFORM_COLORS.default;
}

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
