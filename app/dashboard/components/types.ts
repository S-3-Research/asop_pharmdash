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
  cbuId: string; // e.g., "2026-CBU-01" — Contract Baseline Unit (rolling 3-month window)
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
  /** Replaces the 'vs prior CBU' footer label when set */
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
  type: "Credit Card" | "Crypto" | "Bank Transfer";
  provider: string;          // e.g. "Visa", "BTC", "Wire"
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
  primaryCategory: string;     // e.g. "GLP-1"
  secondaryCategory: string;   // e.g. "Ozempic"
  domainType: DomainType;
  paymentInfo: DomainPaymentInfo;
  geoLocation: DomainGeoLocation;
  associatedBusinessName: string | null;
  keyword: (string | null)[];
  products: Record<string, unknown>;
  cbuId: string;               // e.g. "2026-CBU-01"
}

export interface DomainApiPayload {
  domains: Domain[];
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
  /** ISO date range of the CBU window, e.g. "2026-04-01 ~ 2026-06-30" */
  cbuWindow: string;
  /** rawCount = search-result count for each keyword in the CBU window */
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
