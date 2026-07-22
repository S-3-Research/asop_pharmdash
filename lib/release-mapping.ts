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

import type { DomainData, PharmDashReleaseData, ProductInfoItem } from "@/lib/schemas/pharmdash";
import type {
  CategoryOption,
  Domain,
  DomainCategoryPair,
  DomainPaymentInfo,
  DomainPlatform,
  DomainSocialProfile,
  Listing,
  SeoClickHistoryPoint,
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
 *  fully derived from the data — no hardcoded "must be one of 4" cutoff. */
export function buildCategoryRegistry(domains: DomainData[]): CategoryOption[] {
  const labels = new Set<string>();
  for (const d of domains) {
    for (const p of d.product_info) {
      for (const raw of p.product_category ?? []) {
        labels.add(normalizeCategoryLabel(raw));
      }
    }
  }
  return Array.from(labels)
    .sort()
    .map((name) => ({
      id: name,
      name,
      color: getCategoryColor(name),
      isTop: name in FIXED_CATEGORY_COLORS,
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
          source: d.social_media_profile_info.length > 0 ? "social" : "online",
          primaryCategory: pair.primary,
          secondaryCategory: pair.secondary,
          reportingPeriodId,
        });
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
    listings: mapReleaseDomainsToListings(release.domains, reportPeriod),
    categoryOptions: buildCategoryRegistry(release.domains),
  };
}

// ---------------------------------------------------------------------------
// Drillable pie-chart data (Top Products subpage) — built dynamically from
// whatever categories/listings actually exist, no hardcoded secondary lists.
// ---------------------------------------------------------------------------

import type { PieChartNodeData } from "@/app/dashboard/components/types";

export function buildDrillablePieData(listings: Listing[]): PieChartNodeData[] {
  const total = listings.length;
  if (total === 0) return [];

  const byPrimary = new Map<string, Listing[]>();
  for (const l of listings) {
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

      const children = Array.from(bySecondary.entries()).map(([secondaryCat, count]) => ({
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

