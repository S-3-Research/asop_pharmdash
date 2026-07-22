import type Highcharts from "highcharts";

export type SubPageKey =
  | "top-products"
  | "domain-insights"
  | "social-media-insights";

export type TrendDirection = "up" | "down" | "flat";

export type ListingSource = "online" | "social";

export interface Listing {
  id: string;
  detectedAt: Date;
  source: ListingSource;
  primaryCategory: string; // e.g., "GLP-1", "Cancer Med", "CNS Med", "Pain Med"
  secondaryCategory: string; // e.g., "Ozempic", "Olaparib"
  reportingPeriodId: string; // e.g., "2026-RPT-01" — Reporting Period (rolling 3-month window)
}

export interface ListingAggregation {
  totalListings: number;
  bySource: Record<ListingSource, number>;
  byPrimaryCategory: Record<string, number>;
  bySecondaryCategory: Record<string, number>;
  byPrimaryCategoryAndSource: Record<string, Record<ListingSource, number>>;
}

export interface PieChartNodeData {
  id: string;
  name: string;
  value: number;
  percentage: number;
  color?: string;
  isLeaf?: boolean;
  children?: PieChartNodeData[];
}

export interface SubPageNavItem {
  key: SubPageKey;
  label: string;
  description: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  isTop?: boolean;
  color?: string;
}

export interface MetricCardData {
  id: string;
  label: string;
  value: string;
  /** null = no prior period available */
  change: string | null;
  direction: TrendDirection | null;
  /** Replaces the 'vs prior rpt. period' footer label when set */
  changeLabel?: string;
}

export interface ChartCardData {
  id: string;
  title: string;
  subtitle?: string;
  options: Highcharts.Options;
}

export interface RankedItem {
  id: string;
  name: string;
  value: string;
  /** null = no prior period available */
  change: string | null;
  direction: TrendDirection | null;
}

/** Listing shape returned by the API (detectedAt omitted — not needed by UI) */
export type ApiListing = Omit<Listing, "detectedAt">;

// ── Domain types ──────────────────────────────────────────────────────────────

export type DomainType =
  | "rogue-pharmacy"
  | "social-media"
  | "counterfeit"
  | "unregistered";

export type DomainPlatform =
  | "Google"
  | "Bing"
  | "DuckDuckGo"
  | "Social"
  | "Manual Insert";

export interface SeoClickHistoryPoint {
  /** Month label as reported upstream, e.g. "Aug '24" */
  date: string;
  organicClicks: number;
  paidClicks: number;
}

export interface DomainWhois {
  registrar: string;         // e.g. "GoDaddy", "Namecheap"
  createdDate: string;       // yyyy-mm-dd
  expiryDate: string;        // yyyy-mm-dd
  registrant?: string;       // nullable
}

export interface DomainSem {
  keywords?: string[];
  adSpend?: number;
  impressions?: number;
}

export interface DomainGeoLocation {
  city: string;
  state?: string;
  country: string;
  lat: number;
  lng: number;
}

export interface DomainPaymentInfo {
  /** Raw payment type as reported upstream, e.g. "Credit Card", "Crypto Token",
   *  "Digital Wallets" — kept as-is (not collapsed into a fixed 3-value set)
   *  so the payment treemap can render the real two-level type -> option
   *  hierarchy straight from the schema. */
  type: string;
  /** Specific payment option/brand, e.g. "Visa", "Bitcoin" — null when the
   *  release data didn't report one (never falls back to a raw account
   *  string, to avoid leaking PII like wallet addresses into charts). */
  provider: string | null;
}

export interface DomainSocialProfile {
  /** Social media platform, e.g. "facebook", "instagram", "reddit" */
  platform: string;
  url: string;
}

export interface DomainCategoryPair {
  primary: string;
  secondary: string;
}

export interface Domain {
  domain: string;
  platforms: DomainPlatform[];
  resource: string;
  createDate: string;          // yyyy-mm-dd
  isLive: boolean;
  createTimestamp: number;     // 10-digit unix timestamp
  whois: DomainWhois;
  sem: DomainSem;
  /** Monthly click history (organic/paid) reported upstream via seo_info.history_click_us */
  seoClickHistory: SeoClickHistoryPoint[];
  primaryCategory: string;     // representative value (first product) — e.g. "GLP-1"
  secondaryCategory: string;   // representative value (first product) — e.g. "Ozempic"
  /** Full set of primary/secondary category pairs across all of this domain's products/listings */
  categories: DomainCategoryPair[];
  domainType: DomainType;
  paymentInfo: DomainPaymentInfo[];
  /** Social media presence for this domain, per whatever the release
   *  reports in social_media_profile_info — distinct from `platforms`,
   *  which is the search-engine platform the domain was discovered on. */
  socialProfiles: DomainSocialProfile[];
  geoLocation: DomainGeoLocation;
  associatedBusinessName: string | null;
  keyword: (string | null)[];
  products: Record<string, unknown>;
  reportingPeriodId: string;               // e.g. "2026-RPT-01"
}

/** Domain enriched with a per-filter category-intersection count, used to
 *  drive consistent "has any selected category" counting/weighting across
 *  all Domain Insights cards (see domain-insights-subpage.tsx). */
export type DomainWithMatch = Domain & { matchCount: number };

export interface DomainApiPayload {
  domains: Domain[];
  /** Dynamically derived from the underlying release data's product categories */
  categoryOptions?: CategoryOption[];
}

// ── Social Media types ────────────────────────────────────────────────────────

export interface SocialMediaPost {
  id: string;
  link: string;
  platform: string;
  text: string;
  /** External apps / services mentioned inside the post text (e.g. WhatsApp, Venmo) */
  mentions: string[];
  username: string;
  userlink: string;
  timestamp: string;          // ISO-8601
  status: "active" | "inactive";
  keywords: string[] | null;
  /** One or more drug-category associations. A post can match multiple drug classes. */
  categories: Array<{ primaryCategory: string; secondaryCategory: string }>;
}

export interface SocialPlatformTab {
  platform: string;
  count: number;
}

export interface SocialMetrics {
  totalPosts: number;
  uniqueAccounts: number;
  activeKeywords: number;
  activeCount: number;
}

export interface SocialKeywordRanking {
  keyword: string;
  /** Total occurrences in the filtered dataset's keywords[] arrays */
  signalCount: number;
  growthRate: number | null;
  color: string;
}

export interface SocialMentionByApp {
  app: string;
  count: number;
}

export interface SocialKeywordBubble {
  keyword: string;
  /** Total occurrences in filtered dataset's keywords[] — drives Y-axis and bubble size */
  signalCount: number;
  color: string;
}

export interface SocialMediaPayload {
  platformTabs: SocialPlatformTab[];
  metrics: SocialMetrics;
  keywordRankings: SocialKeywordRanking[];
  mentionsByApp: SocialMentionByApp[];
  keywordBubbles: SocialKeywordBubble[];
}

export interface SocialSamplesPayload {
  samples: SocialMediaPost[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SocialKeywordCountPayload {
  platform: string;
  /** ISO date range of the reporting period, e.g. "2026-04-01 ~ 2026-06-30" */
  reportingPeriod: string;
  /** rawCount = search-result count for each keyword in the reporting period */
  results: { keyword: string; rawCount: number }[];
}

export interface SubPageData {
  key: SubPageKey;
  title: string;
  summary: string;
  metrics: MetricCardData[];
  charts: ChartCardData[];
  rankedItems: RankedItem[];
  categories?: CategoryOption[];
  drillablePieData?: PieChartNodeData[];
  listings?: Listing[];
}
