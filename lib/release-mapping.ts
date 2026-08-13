/**
 * Maps validated PharmDash release data (see lib/schemas/pharmdash.ts) into
 * the dashboard's existing view-model types (app/dashboard/components/types.ts).
 *
 * Key mapping decisions (confirmed with product owner):
 *  1. `domainType` has no release-data equivalent yet — hardcoded placeholder
 *     "rogue-pharmacy" for every mapped domain.
 *  2. `primaryCategory` / `secondaryCategory` are derived from each product's
 *     `product_category` (array) and `product_name`. A release domain can
 *     have many products, each with its own category pair — so `Domain`
 *     carries the full set in `categories[]`, plus a "representative" pair
 *     (`primaryCategory`/`secondaryCategory`, taken from the first product)
 *     for cards/visuals that only show a single category.
 *  3. `reportingPeriodId` is converted from the release's report-period
 *     naming ("2026-rp3") into the dashboard's existing "2026-RPT-03" format.
 *  4. `paymentInfo` is an array on both sides now (release's `payment_info[]`
 *     maps 1:1).
 *  5. Each release domain's product_info[] fans out into one Listing per
 *     product (for the Top Products subpage), each carrying its own
 *     primary/secondary category pair.
 *
 * Category taxonomy: rather than a hand-maintained lookup table, the set of
 * selectable categories is rebuilt from whatever `product_category` values
 * actually appear in the release (see `buildCategoryRegistry`). Known/legacy
 * short-codes get a nicer display label; anything unrecognized still shows
 * up (title-cased) rather than being dropped or forced into an existing
 * bucket.
 */

import "server-only";

import type {
  ContactInfoItem,
  DomainData,
  KeywordStat,
  PharmDashReleaseData,
  ProductInfoItem,
  SocialMediaData,
} from "@/lib/schemas/pharmdash";
import type {
  CategoryOption,
  Domain,
  DomainCategoryPair,
  DomainPaymentInfo,
  DomainPlatform,
  DomainSocialProfile,
  Listing,
  SeoClickHistoryPoint,
  SocialKeywordBubble,
  SocialKeywordRanking,
  SocialMediaPost,
  SocialMentionByApp,
  SocialPlatformTab,
} from "@/app/dashboard/components/types";

// ---------------------------------------------------------------------------
// Category registry — built dynamically from release data
// ---------------------------------------------------------------------------

/** Known short-code -> nice display label. Anything not listed here falls
 *  back to a generic title-case transform, so new categories introduced by
 *  upstream data automatically show up without code changes. */
const KNOWN_CATEGORY_LABELS: Record<string, string> = {
  "glp-1": "GLP-1",
  glp1: "GLP-1",
  cancer: "Cancer Med",
  "cancer med": "Cancer Med",
  "cancer medication": "Cancer Med",
  "cancer drug": "Cancer Med",
  cns: "CNS Med",
  "cns med": "CNS Med",
  pain: "Pain Med",
  "pain med": "Pain Med",
  "pain medication": "Pain Med",
};

const FALLBACK_PALETTE = [
  "#3b82f6",
  "#10b981",
  "#a855f7",
  "#f59e0b",
  "#ef4444",
  "#0ea5e9",
  "#84cc16",
  "#ec4899",
  "#14b8a6",
  "#8b5cf6",
];

function titleCase(raw: string): string {
  return raw
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

/** Normalizes a raw `product_category` value into a stable display label. */
export function normalizeCategoryLabel(raw: string): string {
  const key = raw.trim().toLowerCase();
  return KNOWN_CATEGORY_LABELS[key] ?? titleCase(raw);
}

/** Deterministic color for a category label — stable across reloads since
 *  it's derived from the label string itself, not array order. */
function hashColor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

const FIXED_CATEGORY_COLORS: Record<string, string> = {
  "GLP-1": "#3b82f6",
  "Cancer Med": "#10b981",
  "CNS Med": "#a855f7",
  "Pain Med": "#f59e0b",
};

export function getCategoryColor(label: string): string {
  return FIXED_CATEGORY_COLORS[label] ?? hashColor(label);
}

/** Builds the full set of selectable category options present in a release,
 *  fully derived from the data — no hardcoded "must be one of 4" cutoff.
 *  `isTop` marks whichever category has the highest product count (ties
 *  broken by name), not a fixed whitelist — so exactly one option is ever
 *  flagged "TOP 1". */
export function buildCategoryRegistry(domains: DomainData[]): CategoryOption[] {
  const counts = new Map<string, number>();
  for (const d of domains) {
    for (const p of d.product_info) {
      for (const raw of p.product_category ?? []) {
        const label = normalizeCategoryLabel(raw);
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
  }
  let topName: string | null = null;
  for (const [name, count] of counts) {
    if (topName === null || count > (counts.get(topName) ?? 0)) topName = name;
  }
  return Array.from(counts.keys())
    .sort()
    .map((name) => ({
      id: name,
      name,
      color: getCategoryColor(name),
      isTop: name === topName,
    }));
}

// ---------------------------------------------------------------------------
// Reporting period conversion: "2026-rp3" -> "2026-RPT-03"
// ---------------------------------------------------------------------------

export function convertReportPeriod(reportPeriod: string): string {
  const match = /^(\d{4})-rp(\d+)$/i.exec(reportPeriod.trim());
  if (!match) {
    // Already in dashboard format, or unrecognized — pass through untouched
    // rather than throwing, so unexpected upstream formats don't 500 the API.
    return reportPeriod;
  }
  const [, year, num] = match;
  return `${year}-RPT-${num.padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Per-product category-pair + Listing derivation
// ---------------------------------------------------------------------------

function productCategoryPairs(product: ProductInfoItem): DomainCategoryPair[] {
  const rawCategories = product.product_category ?? [];
  const secondary = product.product_name ?? product.product_title;
  if (rawCategories.length === 0) {
    return [{ primary: "Uncategorized", secondary }];
  }
  return rawCategories.map((raw) => ({
    primary: normalizeCategoryLabel(raw),
    secondary,
  }));
}

// ---------------------------------------------------------------------------
// Domain mapping
// ---------------------------------------------------------------------------

const PLATFORM_MAP: Record<string, DomainPlatform> = {
  Google: "Google",
  Bing: "Bing",
  DuckDuckGo: "DuckDuckGo",
  Yahoo: "Bing", // no direct dashboard equivalent — bucket into closest existing option
  Baidu: "Manual Insert",
};

function mapPlatforms(platforms: DomainData["platforms"]): DomainPlatform[] {
  if (!platforms || platforms.length === 0) return ["Manual Insert"];
  return platforms.map((p) => PLATFORM_MAP[p] ?? "Manual Insert");
}

function mapPaymentInfo(payments: DomainData["payment_info"]): DomainPaymentInfo[] {
  if (!payments || payments.length === 0) return [];
  // Faithful two-level mapping straight from the schema: `type` (Credit
  // Card / Crypto Token / Bank Transfer / etc.) -> `paymentoption` (Visa,
  // Bitcoin, ...). No collapsing into a fixed 3-bucket taxonomy, and no
  // falling back to the raw `account` field (which can contain wallet
  // addresses / other PII) when `paymentoption` is absent.
  return payments.map((p) => ({
    type: p.type,
    provider: p.paymentoption ?? null,
  }));
}

function mapSocialProfiles(
  profiles: DomainData["social_media_profile_info"],
): DomainSocialProfile[] {
  if (!profiles) return [];
  return profiles.map((p) => ({
    platform: p.socialmedia_platform,
    url: p.socialmedia_url,
  }));
}

function normalizeRegistrar(raw: string | null | undefined): string {
  if (!raw) return "Unknown";
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "n/a") return "Unknown";
  return trimmed;
}

function mapSeoClickHistory(
  history: DomainData["seo_info"]["history_click_us"],
): SeoClickHistoryPoint[] {
  if (!history) return [];
  return history.map((h) => ({
    date: h.date,
    organicClicks: h.organic_clicks,
    paidClicks: h.paid_clicks,
  }));
}

function safeDate(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString().slice(0, 10);
}

export function mapReleaseDomain(
  d: DomainData,
  reportingPeriodId: string,
): Domain {
  const categories = d.product_info.flatMap(productCategoryPairs);
  const representative = categories[0] ?? { primary: "Uncategorized", secondary: "Unknown" };
  const now = Math.floor(Date.now() / 1000);
  const createTimestamp = d.captured_time ?? d.last_seen ?? now;
  const createDate = safeDate(
    new Date(createTimestamp * 1000).toISOString(),
    new Date().toISOString().slice(0, 10),
  );

  return {
    domain: d.domain,
    platforms: mapPlatforms(d.platforms),
    resource: d.resources ?? "search_result",
    createDate,
    isLive: d.is_live ?? true,
    createTimestamp,
    whois: {
      registrar: normalizeRegistrar(d.whois_info.registrar_name),
      createdDate: safeDate(d.whois_info.domain_create_date, createDate),
      expiryDate: safeDate(d.whois_info.domain_expiry_date, createDate),
      registrant: d.whois_info.registrant_name ?? undefined,
    },
    sem: {
      keywords: d.product_label ?? undefined,
    },
    seoClickHistory: mapSeoClickHistory(d.seo_info?.history_click_us),
    primaryCategory: representative.primary,
    secondaryCategory: representative.secondary,
    categories: categories.length > 0 ? categories : [representative],
    domainType: "rogue-pharmacy",
    paymentInfo: mapPaymentInfo(d.payment_info),
    socialProfiles: mapSocialProfiles(d.social_media_profile_info),
    geoLocation: {
      city: d.city ?? "Unknown",
      state: d.state ?? undefined,
      country: d.country ?? "Unknown",
      lat: d.latitude ?? 0,
      lng: d.longitude ?? 0,
    },
    associatedBusinessName: d.business_affiliation ?? null,
    keyword: d.product_label ?? [],
    products: { productInfo: d.product_info },
    reportingPeriodId,
  };
}

export function mapReleaseDomains(
  domains: DomainData[],
  reportPeriod: string,
): Domain[] {
  const reportingPeriodId = convertReportPeriod(reportPeriod);
  return domains.map((d) => mapReleaseDomain(d, reportingPeriodId));
}

// ---------------------------------------------------------------------------
// Listing mapping (one Listing per product, for the Top Products subpage)
// ---------------------------------------------------------------------------

export function mapReleaseDomainsToListings(
  domains: DomainData[],
  reportPeriod: string,
): Listing[] {
  const reportingPeriodId = convertReportPeriod(reportPeriod);
  const listings: Listing[] = [];

  domains.forEach((d, domainIdx) => {
    d.product_info.forEach((product, productIdx) => {
      const pairs = productCategoryPairs(product);
      pairs.forEach((pair, pairIdx) => {
        listings.push({
          id: `${d.domain}-${domainIdx}-${productIdx}-${pairIdx}`,
          detectedAt: new Date((d.captured_time ?? d.last_seen ?? Math.floor(Date.now() / 1000)) * 1000),
          source: "online",
          primaryCategory: pair.primary,
          secondaryCategory: pair.secondary,
          reportingPeriodId,
        });
      });
    });
  });

  return listings;
}

/**
 * Maps release social_media[] rows into Listings (one Listing per post per
 * resolved category pair, source: "social") so the Top Products subpage's
 * "Social" stat reflects actual social signal volume rather than merely
 * whether a domain happens to have linked social profiles. Categories come
 * directly from each row's product_list[].product_category (see
 * resolveSocialCategories), so counts stay consistent with the Social Media
 * Insights page.
 */
export function mapReleaseSocialToListings(
  socialMedia: SocialMediaData[],
  reportPeriod: string,
): Listing[] {
  const reportingPeriodId = convertReportPeriod(reportPeriod);
  const listings: Listing[] = [];

  socialMedia.forEach((post, postIdx) => {
    const categories = resolveSocialCategories(post);
    const detectedAt = new Date(
      safeIsoTimestamp(post.create_date, post.create_timestamp) ?? 0,
    );
    categories.forEach((pair, pairIdx) => {
      listings.push({
        id: `social-${postIdx}-${pairIdx}`,
        detectedAt,
        source: "social",
        primaryCategory: pair.primaryCategory,
        secondaryCategory: pair.secondaryCategory,
        reportingPeriodId,
      });
    });
  });

  return listings;
}

// ---------------------------------------------------------------------------
// Top-level convenience: full release -> dashboard payload
// ---------------------------------------------------------------------------

export interface MappedDashboardData {
  domains: Domain[];
  listings: Listing[];
  categoryOptions: CategoryOption[];
}

export function mapReleaseData(
  release: PharmDashReleaseData,
  reportPeriod: string,
): MappedDashboardData {
  return {
    domains: mapReleaseDomains(release.domains, reportPeriod),
    listings: [
      ...mapReleaseDomainsToListings(release.domains, reportPeriod),
      ...mapReleaseSocialToListings(release.social_media, reportPeriod),
    ],
    categoryOptions: buildCategoryRegistry(release.domains),
  };
}


// ---------------------------------------------------------------------------
// Drillable pie-chart data (Top Products subpage) — built dynamically from
// whatever categories/listings actually exist, no hardcoded secondary lists.
// ---------------------------------------------------------------------------

import type { PieChartNodeData } from "@/app/dashboard/components/types";

export function buildDrillablePieData(listings: Listing[]): PieChartNodeData[] {
  // Uncategorized listings (no product_category resolved) are excluded from
  // the sunburst entirely — they still count in table/ranking totals
  // elsewhere, but shouldn't appear as a fake "category" slice here.
  const categorized = listings.filter((l) => l.primaryCategory !== "Uncategorized");
  const total = categorized.length;
  if (total === 0) return [];

  const byPrimary = new Map<string, Listing[]>();
  for (const l of categorized) {
    const arr = byPrimary.get(l.primaryCategory) ?? [];
    arr.push(l);
    byPrimary.set(l.primaryCategory, arr);
  }

  return Array.from(byPrimary.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([primaryCat, primaryListings]) => {
      const primaryCount = primaryListings.length;
      const primaryPercentage = Math.round((primaryCount / total) * 100);
      const color = getCategoryColor(primaryCat);

      const bySecondary = new Map<string, number>();
      for (const l of primaryListings) {
        bySecondary.set(l.secondaryCategory, (bySecondary.get(l.secondaryCategory) ?? 0) + 1);
      }

      // Sort children by count descending too, so the outer ring's arc
      // order matches the inner ring's convention (largest segment first)
      // instead of following arbitrary Map-insertion order.
      const children = Array.from(bySecondary.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([secondaryCat, count]) => ({
          id: `${primaryCat}-${secondaryCat}`,
          name: secondaryCat,
          value: count,
          percentage: count > 0 ? Math.round((count / primaryCount) * 100) : 0,
          color,
        }));

      return {
        id: primaryCat.replace(/\s+/g, "-"),
        name: primaryCat,
        value: primaryCount,
        percentage: primaryPercentage,
        color,
        children,
      };
    });
}

// ---------------------------------------------------------------------------
// Social Media mapping — SocialMediaData[] / KeywordStat[] (release payload)
// -> SocialMediaPost[] / keyword rankings & bubbles (dashboard view models).
//
// The release schema has no explicit "category" field on social posts —
// only `product_name: string[]` (drug/product names matched in the post
// text). Categories are recovered by looking those names up against the
// product_name -> product_category mapping built from domains[].product_info
// (the same source Domain Insights / Top Products use), so a single
// category taxonomy stays consistent across all three subpages.
// ---------------------------------------------------------------------------

/** contact_type -> nice display label for the mentions-by-app chart. Anything
 *  not listed here falls back to a title-cased version of the raw value. */
const CONTACT_TYPE_APP_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  venmo: "Venmo",
  wechat: "WeChat",
  signal: "Signal",
  kik: "Kik",
  wickr: "Wickr",
  snapchat: "Snapchat",
  instagram: "Instagram",
  discord: "Discord",
  facebook: "Facebook",
  twitter: "Twitter",
  threads: "Threads",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  tumblr: "Tumblr",
  pinterest: "Pinterest",
  quora: "Quora",
  "about.me": "about.me",
  myspace: "Myspace",
};

function contactTypeAppLabel(contactType: string): string {
  return (
    CONTACT_TYPE_APP_LABELS[contactType] ??
    contactType
      .split(/[_.\s]+/)
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ")
  );
}

/** Third-party app/service "mentions" for a social post are now derived from
 *  its structured `contact_info[]` (one entry per contact_type actually
 *  present on the row), rather than scanning free-text for known app names
 *  — more accurate and no longer dependent on the post's `text` field. */
function extractMentions(contactInfo: ContactInfoItem[] | null | undefined): string[] {
  if (!contactInfo || contactInfo.length === 0) return [];
  const found = new Set<string>();
  for (const c of contactInfo) {
    found.add(contactTypeAppLabel(c.contact_type));
  }
  return Array.from(found);
}

function safeIsoTimestamp(
  createDate: string | null | undefined,
  createTimestamp: number | null | undefined,
): string | null {
  if (createDate) {
    const parsed = new Date(createDate);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  if (createTimestamp) {
    return new Date(createTimestamp * 1000).toISOString();
  }
  return null;
}

function usernameToHandle(userUrl: string, userName: string): string {
  return userName.trim() || userUrl;
}

/**
 * Resolves a single release social_media[] row's category pairs. As of the
 * 2026-08-05 schema, social_media rows carry their own product_category
 * directly (via `product_list[].product_category`) — no longer inferred by
 * looking the row's product names up against domains[].product_info.
 */
function resolveSocialCategories(
  post: SocialMediaData,
): { primaryCategory: string; secondaryCategory: string }[] {
  const productList = post.product_list ?? [];
  const categories = productList
    .map((item) => ({
      primaryCategory: item.product_category ? normalizeCategoryLabel(item.product_category) : "Uncategorized",
      secondaryCategory: item.product_name,
    }))
    .filter(
      (pair, i, arr) =>
        arr.findIndex((p) => p.primaryCategory === pair.primaryCategory && p.secondaryCategory === pair.secondaryCategory) === i,
    );
  return categories.length > 0 ? categories : [{ primaryCategory: "Uncategorized", secondaryCategory: "Unknown" }];
}

/**
 * Maps a single release social_media[] row (plus its original array index)
 * into a full SocialMediaPost, including the (potentially large) `text`
 * field. Used only for the small, already-paginated slice of rows that
 * actually need to be displayed — see mapReleaseSocialPosts/samples route.
 */
function mapSocialRow(
  post: SocialMediaData,
  originalIndex: number,
): SocialMediaPost {
  const productNames = (post.product_list ?? []).map((p) => p.product_name);
  return {
    id: `social-${originalIndex}`,
    link: post.link,
    platform: post.socialmedia_platform,
    text: post.text ?? "",
    mentions: extractMentions(post.contact_info),
    username: usernameToHandle(post.user_url, post.user_name),
    userlink: post.user_url,
    timestamp: safeIsoTimestamp(post.create_date, post.create_timestamp),
    status: (post.is_live ?? true) ? "active" : "inactive",
    keywords: productNames.length > 0 ? productNames : null,
    categories: resolveSocialCategories(post),
  };
}

/**
 * Maps release social_media[] rows into the dashboard's SocialMediaPost[]
 * view model. `domains` supplies the product_name -> category lookup used
 * to derive `categories` (release data itself carries no category field).
 *
 * NOTE: this maps every row (including the full `text` field) and is
 * therefore relatively expensive at real-world release sizes (100k+ rows).
 * Prefer `buildSocialIndex` + `mapSocialRow` for a specific slice when you
 * don't need every row's text up front (see the samples/aggregation API
 * routes).
 */
export function mapReleaseSocialPosts(
  socialMedia: SocialMediaData[],
): SocialMediaPost[] {
  return socialMedia.map((post, index) => mapSocialRow(post, index));
}

// ---------------------------------------------------------------------------
// Lightweight social index — everything needed for filtering, sorting,
// platform tabs, metrics, and mention counts, WITHOUT carrying each post's
// (often large) `text` field around. This is what the aggregation endpoint
// (/api/social-media) and the samples endpoint's filter/sort/paginate step
// (/api/social-media/samples) should use instead of the full mapped array.
// ---------------------------------------------------------------------------

export interface SocialPostLite {
  /** Index into the release's original social_media[] array — used to look
   *  up the full row (with text) only for whatever page is actually shown. */
  originalIndex: number;
  platform: string;
  username: string;
  timestampMs: number;
  status: "active" | "inactive";
  mentions: string[];
  categories: { primaryCategory: string; secondaryCategory: string }[];
  keywordCount: number;
}

/**
 * Builds the lightweight per-post index described above. This is the
 * expensive-ish pass (category lookup + mention text-scan per row), so it's
 * wrapped in `unstable_cache` at the call site (see lib/releases.ts
 * `fetchSocialIndex`) keyed by releaseId — computed once per release, not
 * once per request.
 */
export function buildSocialIndex(
  socialMedia: SocialMediaData[],
): SocialPostLite[] {
  return socialMedia.map((post, originalIndex) => {
    const productList = post.product_list ?? [];
    return {
      originalIndex,
      platform: post.socialmedia_platform,
      username: usernameToHandle(post.user_url, post.user_name),
      timestampMs: new Date(safeIsoTimestamp(post.create_date, post.create_timestamp) ?? 0).getTime(),
      status: (post.is_live ?? true ? "active" : "inactive") as "active" | "inactive",
      mentions: extractMentions(post.contact_info),
      categories: resolveSocialCategories(post),
      keywordCount: productList.length,
    };
  });
}


/**
 * Aggregates keyword_stats[] (release's flattened KeywordStat rows — one
 * per keyword/platform pair) into the dashboard's keyword-ranking view
 * model. Sums `signal_num` across matching rows; optionally restricted to
 * a single platform (pass "all" or omit for every platform combined).
 */
export function buildKeywordRankingsFromStats(
  stats: KeywordStat[],
  platform: string | null | undefined,
  limit: number,
  colors: string[],
): SocialKeywordRanking[] {
  const filtered =
    platform && platform !== "all"
      ? stats.filter((s) => s.socialmedia_platform === platform)
      : stats;

  const totals = new Map<string, number>();
  for (const s of filtered) {
    totals.set(s.keyword, (totals.get(s.keyword) ?? 0) + (s.signal_num ?? 0));
  }

  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([keyword, signalCount], i) => ({
      keyword,
      signalCount,
      growthRate: null,
      color: colors[i % colors.length],
    }));
}

export function buildKeywordBubblesFromStats(
  stats: KeywordStat[],
  platform: string | null | undefined,
  limit: number,
  colors: string[],
): SocialKeywordBubble[] {
  return buildKeywordRankingsFromStats(stats, platform, limit, colors).map(
    ({ keyword, signalCount, color }) => ({ keyword, signalCount, color }),
  );
}

/**
 * Looks up raw_num (search-result counts) for a specific set of keywords,
 * summing across platforms when `platform` is "all"/omitted, matching a
 * single platform's rows otherwise.
 */
export function lookupKeywordRawCounts(
  stats: KeywordStat[],
  keywords: string[],
  platform: string | null | undefined,
): { keyword: string; rawCount: number }[] {
  const filtered =
    platform && platform !== "all"
      ? stats.filter((s) => s.socialmedia_platform === platform)
      : stats;

  const totals = new Map<string, number>();
  for (const s of filtered) {
    totals.set(s.keyword, (totals.get(s.keyword) ?? 0) + (s.raw_num ?? 0));
  }

  return keywords.map((keyword) => ({ keyword, rawCount: totals.get(keyword) ?? 0 }));
}

// ---------------------------------------------------------------------------
// Fast paths built on top of SocialPostLite (no text field) — used by the
// /api/social-media (aggregation) and /api/social-media/samples routes so
// neither one maps/carries the full 100k+ row array (with text) per request.
// ---------------------------------------------------------------------------

function filterSocialIndex(
  index: SocialPostLite[],
  selectedCategories: string[],
  platform: string | null | undefined,
): SocialPostLite[] {
  let result = index;
  if (selectedCategories.length > 0) {
    result = result.filter((p) =>
      p.categories.some((c) => selectedCategories.includes(c.primaryCategory)),
    );
  }
  if (platform && platform !== "all") {
    result = result.filter((p) => p.platform === platform);
  }
  return result;
}

export interface SocialAggregates {
  platformTabs: SocialPlatformTab[];
  metrics: { totalPosts: number; uniqueAccounts: number; activeCount: number };
  mentionsByApp: SocialMentionByApp[];
}

/**
 * Computes platform tabs, headline metrics, and mentions-by-app directly
 * from the lightweight index — no `text`/`link`/`userlink` fields are ever
 * materialized. Platform tabs reflect category-filtering only (matches the
 * previous /api/social-media behavior); metrics/mentions reflect category
 * AND platform filtering.
 */
export function buildSocialAggregates(
  index: SocialPostLite[],
  selectedCategories: string[],
  platform: string | null | undefined,
): SocialAggregates {
  const catFiltered = filterSocialIndex(index, selectedCategories, null);

  const platformCountMap = new Map<string, number>();
  for (const post of catFiltered) {
    platformCountMap.set(post.platform, (platformCountMap.get(post.platform) ?? 0) + 1);
  }
  const platformTabs: SocialPlatformTab[] = [...platformCountMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([p, count]) => ({ platform: p, count }));

  const filtered =
    platform && platform !== "all" ? catFiltered.filter((p) => p.platform === platform) : catFiltered;

  const uniqueAccounts = new Set(filtered.map((p) => p.username)).size;
  const activeCount = filtered.filter((p) => p.status === "active").length;

  const mentionMap = new Map<string, number>();
  for (const post of filtered) {
    for (const app of post.mentions) {
      mentionMap.set(app, (mentionMap.get(app) ?? 0) + 1);
    }
  }
  const mentionsByApp: SocialMentionByApp[] = [...mentionMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([app, count]) => ({ app, count }));

  return {
    platformTabs,
    metrics: { totalPosts: filtered.length, uniqueAccounts, activeCount },
    mentionsByApp,
  };
}

/**
 * Filters + sorts (newest first) + paginates the lightweight index, then
 * hydrates ONLY the resulting page's rows into full SocialMediaPost objects
 * (with `text`) by looking them back up in the release's raw social_media[]
 * array via `originalIndex`. The full-text mapping cost is paid for
 * `pageSize` rows instead of the entire release.
 */
export function paginateSocialPosts(
  index: SocialPostLite[],
  rawSocialMedia: SocialMediaData[],
  selectedCategories: string[],
  platform: string | null | undefined,
  page: number,
  pageSize: number,
): { samples: SocialMediaPost[]; total: number } {
  const filtered = filterSocialIndex(index, selectedCategories, platform);
  filtered.sort((a, b) => b.timestampMs - a.timestampMs);

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const pageSlice = filtered.slice(start, start + pageSize);

  const samples = pageSlice.map((lite) => mapSocialRow(rawSocialMedia[lite.originalIndex], lite.originalIndex));

  return { samples, total };
}

// ---------------------------------------------------------------------------
// Precomputed aggregate table — built ONCE at release-creation time (see
// lib/releases.ts `createRelease`) and stored to Storage, so the aggregation
// endpoint (/api/social-media) can serve every "no category filter" or
// "single category" + "any platform" combination via an O(1) lookup instead
// of scanning the release's social-media rows on every request.
//
// Only single-category (and no-category = "__all__") combinations are
// precomputed — categories are a multi-select filter (arbitrary subset, OR
// match), and the number of subsets is 2^N, which isn't practical to
// precompute for anything but a handful of categories. Multi-category
// selections (rare in practice) fall back to filtering the cached
// SocialPostLite[] index on demand — see the route's `else` branch.
//
// Keyword rankings/bubbles have no category dimension at all (KeywordStat
// carries no product/category field), so they're keyed by platform only —
// a single ~10-entry table covers every possible filter combination.
// ---------------------------------------------------------------------------

const CATEGORY_ALL_KEY = "__all__";
const PLATFORM_ALL_KEY = "all";

export interface SocialAggregateEntry {
  platformTabs: SocialPlatformTab[];
  metrics: { totalPosts: number; uniqueAccounts: number; activeCount: number };
  mentionsByApp: SocialMentionByApp[];
}

export interface SocialKeywordAggregateEntry {
  uniqueKeywordCount: number;
  keywordRankings: SocialKeywordRanking[];
  keywordBubbles: SocialKeywordBubble[];
}

export interface SocialAggregateTable {
  /** category label (or "__all__") -> platform label (or "all") -> precomputed entry */
  byCategory: Record<string, Record<string, SocialAggregateEntry>>;
  /** platform label (or "all") -> precomputed keyword rankings/bubbles (category-independent) */
  byPlatformKeywords: Record<string, SocialKeywordAggregateEntry>;
  /** Dynamically derived category filter options. As of the 2026-08-05
   *  schema, social_media rows carry their own product_category directly,
   *  so this is built from whatever categories actually occur across the
   *  release's social posts (see `buildSocialIndex`/`resolveSocialCategories`)
   *  — NOT from domains[].product_info, which can have a different/larger
   *  category set and would otherwise offer filter options that match zero
   *  social posts. Colors/known-label normalization are shared with the
   *  Domain Insights / Top Products registry (`getCategoryColor`,
   *  `normalizeCategoryLabel`) so the same category shows up with the same
   *  name/color everywhere, even though the *set* of options can differ. */
  categoryOptions: CategoryOption[];
}

function aggregateSubset(subset: SocialPostLite[], platform: string): SocialAggregateEntry {
  const platformCountMap = new Map<string, number>();
  for (const post of subset) {
    platformCountMap.set(post.platform, (platformCountMap.get(post.platform) ?? 0) + 1);
  }
  const platformTabs: SocialPlatformTab[] = [...platformCountMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([p, count]) => ({ platform: p, count }));

  const filtered = platform === PLATFORM_ALL_KEY ? subset : subset.filter((p) => p.platform === platform);

  const uniqueAccounts = new Set(filtered.map((p) => p.username)).size;
  const activeCount = filtered.filter((p) => p.status === "active").length;

  const mentionMap = new Map<string, number>();
  for (const post of filtered) {
    for (const app of post.mentions) {
      mentionMap.set(app, (mentionMap.get(app) ?? 0) + 1);
    }
  }
  const mentionsByApp: SocialMentionByApp[] = [...mentionMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([app, count]) => ({ app, count }));

  return {
    platformTabs,
    metrics: { totalPosts: filtered.length, uniqueAccounts, activeCount },
    mentionsByApp,
  };
}

const AGGREGATE_KEYWORD_COLORS = [
  "#ef4444", "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981",
  "#ec4899", "#f97316", "#06b6d4", "#84cc16", "#6366f1",
];

/** Builds category filter options from whatever categories actually occur
 *  across the release's social posts (already-normalized labels from
 *  `resolveSocialCategories`), rather than from domains[].product_info —
 *  see the SocialAggregateTable.categoryOptions doc comment for why. */
function buildSocialCategoryOptions(index: SocialPostLite[]): CategoryOption[] {
  const counts = new Map<string, number>();
  for (const post of index) {
    for (const c of post.categories) {
      if (c.primaryCategory !== "Uncategorized") {
        counts.set(c.primaryCategory, (counts.get(c.primaryCategory) ?? 0) + 1);
      }
    }
  }
  // `isTop` marks whichever category has the highest post count (matching
  // the same semantics as buildDomainCategoryOptions() in
  // app/dashboard/components/subpages/domain-insights/config.ts) — this
  // used to incorrectly check membership in FIXED_CATEGORY_COLORS, which
  // made every category that happened to be one of the 4 preset names bold
  // simultaneously instead of only the single most-frequent one.
  let topName: string | null = null;
  for (const [name, count] of counts) {
    if (topName === null || count > (counts.get(topName) ?? 0)) topName = name;
  }
  return Array.from(counts.keys())
    .sort()
    .map((name) => ({
      id: name,
      name,
      color: getCategoryColor(name),
      isTop: name === topName,
    }));
}

/**
 * Builds the full precomputed table: every (single-category-or-"__all__") x
 * (single-platform-or-"all") combination that actually occurs in the
 * release's data, plus the platform-only keyword rankings/bubbles table and
 * the category filter options. Meant to be called once per release (at
 * upload time), not per request.
 */
export function buildSocialAggregateTable(
  index: SocialPostLite[],
  keywordStats: KeywordStat[],
): SocialAggregateTable {
  const platformLabels = new Set<string>([PLATFORM_ALL_KEY]);
  const categoryLabels = new Set<string>([CATEGORY_ALL_KEY]);
  for (const post of index) {
    platformLabels.add(post.platform);
    for (const c of post.categories) categoryLabels.add(c.primaryCategory);
  }

  const byCategory: Record<string, Record<string, SocialAggregateEntry>> = {};
  for (const category of categoryLabels) {
    const subset =
      category === CATEGORY_ALL_KEY
        ? index
        : index.filter((p) => p.categories.some((c) => c.primaryCategory === category));

    const perPlatform: Record<string, SocialAggregateEntry> = {};
    for (const platform of platformLabels) {
      perPlatform[platform] = aggregateSubset(subset, platform);
    }
    byCategory[category] = perPlatform;
  }

  const byPlatformKeywords: Record<string, SocialKeywordAggregateEntry> = {};
  for (const platform of platformLabels) {
    const relevantStats =
      platform === PLATFORM_ALL_KEY
        ? keywordStats
        : keywordStats.filter((s) => s.socialmedia_platform === platform);
    byPlatformKeywords[platform] = {
      uniqueKeywordCount: new Set(relevantStats.map((s) => s.keyword)).size,
      keywordRankings: buildKeywordRankingsFromStats(keywordStats, platform, 25, AGGREGATE_KEYWORD_COLORS),
      keywordBubbles: buildKeywordBubblesFromStats(keywordStats, platform, 15, AGGREGATE_KEYWORD_COLORS),
    };
  }

  const categoryOptions = buildSocialCategoryOptions(index);

  return { byCategory, byPlatformKeywords, categoryOptions };
}
