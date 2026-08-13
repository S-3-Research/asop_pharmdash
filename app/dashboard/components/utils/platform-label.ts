// Client-safe platform display-name helper. Mirrors the pattern of
// contactTypeAppLabel() in lib/release-mapping.ts (which is "server-only"
// and cannot be imported into client components), so social platform
// values (lowercase enum strings from the release schema, e.g. "facebook",
// "twitter") get a consistent, properly-cased display label everywhere
// they're rendered client-side (bubbles, tabs, sample cards, etc.).
const SOCIAL_PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  reddit: "Reddit",
  twitter: "X", // rebranded — display as "X" rather than "Twitter"
  threads: "Threads",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  tumblr: "Tumblr",
  pinterest: "Pinterest",
  quora: "Quora",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  snapchat: "Snapchat",
  "about.me": "about.me",
  kik: "Kik",
  myspace: "Myspace",
  venmo: "Venmo",
  signal: "Signal",
  discord: "Discord",
};

/** Case-insensitive lookup with a title-cased fallback for any platform not
 *  explicitly listed above, so new/unmapped platforms still display sanely
 *  instead of showing the raw lowercase enum value. */
export function socialPlatformLabel(platform: string): string {
  const known = SOCIAL_PLATFORM_LABELS[platform.toLowerCase()];
  if (known) return known;
  return platform
    .split(/[_.\s]+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
