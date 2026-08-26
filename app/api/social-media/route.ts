import { NextRequest, NextResponse } from "next/server";

import { requireAuthenticatedActor } from "@/app/api/admin/_auth";
import { mockSocialPosts } from "@/app/dashboard/components/mock-data";
import type {
  SocialKeywordBubble,
  SocialKeywordRanking,
  SocialMediaPayload,
  SocialProductSignalCount,
} from "@/app/dashboard/components/types";
import { getActiveChannel } from "@/lib/channel";
import { fetchSocialIndex, fetchSocialAggregateTable, fetchReleaseData, getActiveReleaseContext } from "@/lib/releases";
import { buildSocialAggregates, buildKeywordRankingsFromStats, buildKeywordBubblesFromStats } from "@/lib/release-mapping";
import { SOCIAL_PRIMARY_CATEGORIES } from "@/app/dashboard/components/subpages/social-media/config";

const CATEGORY_ALL_KEY = "__all__";
const PLATFORM_ALL_KEY = "all";
const KEYWORD_COLORS = [
  "#ef4444", "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981",
  "#ec4899", "#f97316", "#06b6d4", "#84cc16", "#6366f1",
];

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedActor();
  if (!auth.ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const categoriesParam = searchParams.get("categories");
  const platformParam   = searchParams.get("platform");

  const selectedCategories = categoriesParam
    ? categoriesParam.split(",").filter(Boolean)
    : [];

  // ── Source data: real published release, or built-in mock ────────────────
  const channel = getActiveChannel();
  const ctx = await getActiveReleaseContext(channel);

  let platformTabs: SocialMediaPayload["platformTabs"];
  let metrics: SocialMediaPayload["metrics"];
  let mentionsByApp: SocialMediaPayload["mentionsByApp"];
  let keywordRankings: SocialKeywordRanking[];
  let keywordBubbles: SocialKeywordBubble[];
  let categoryOptions: SocialMediaPayload["categoryOptions"];
  let productSignalCounts: SocialProductSignalCount[];
  let totalRawCount = 0;

  if (ctx.isMock) {
    // ── Mock data path (unchanged) ──────────────────────────────────────────
    const catFiltered =
      selectedCategories.length > 0
        ? mockSocialPosts.filter((p) =>
            p.categories.some((c) => selectedCategories.includes(c.primaryCategory)),
          )
        : mockSocialPosts;

    const platformCountMap = new Map<string, number>();
    for (const post of catFiltered) {
      platformCountMap.set(post.platform, (platformCountMap.get(post.platform) ?? 0) + 1);
    }
    platformTabs = [...platformCountMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([platform, count]) => ({ platform, count }));

    const filtered =
      platformParam && platformParam !== "all"
        ? catFiltered.filter((p) => p.platform === platformParam)
        : catFiltered;

    const uniqueAccounts = new Set(filtered.map((p) => p.username)).size;
    const allKeywords    = filtered.flatMap((p) => p.keywords ?? []);
    const uniqueKeywords = new Set(allKeywords).size;
    const activeCount    = filtered.filter((p) => p.status === "active").length;
    const numInteractions = filtered.reduce((sum, p) => sum + (p.numComments ?? 0) + (p.numLikes ?? 0), 0);
    metrics = { totalPosts: filtered.length, uniqueAccounts, activeKeywords: uniqueKeywords, activeCount, totalRawCount: 0, numInteractions };

    const kwCountMap = new Map<string, number>();
    for (const kw of allKeywords) {
      kwCountMap.set(kw, (kwCountMap.get(kw) ?? 0) + 1);
    }
    keywordRankings = [...kwCountMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([keyword, signalCount], i) => ({
        keyword,
        signalCount,
        growthRate: null,
        color: KEYWORD_COLORS[i % KEYWORD_COLORS.length],
      }));
    keywordBubbles = [...kwCountMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([keyword, signalCount], i) => ({
        keyword,
        signalCount,
        color: KEYWORD_COLORS[i % KEYWORD_COLORS.length],
      }));

    const mentionMap = new Map<string, number>();
    for (const post of filtered) {
      for (const app of post.mentions) {
        mentionMap.set(app, (mentionMap.get(app) ?? 0) + 1);
      }
    }
    mentionsByApp = [...mentionMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([app, count]) => ({ app, count }));

    // Mock posts already carry {primaryCategory, secondaryCategory} pairs
    // (same shape as the real-release path) — group selling posts/comments
    // by product name (secondaryCategory), respecting the category filter.
    const productCountMap = new Map<string, number>();
    for (const post of filtered) {
      for (const pair of post.categories) {
        if (selectedCategories.length > 0 && !selectedCategories.includes(pair.primaryCategory)) continue;
        if (pair.secondaryCategory === "Unknown") continue;
        productCountMap.set(pair.secondaryCategory, (productCountMap.get(pair.secondaryCategory) ?? 0) + 1);
      }
    }
    productSignalCounts = [...productCountMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
    // No keyword_stats[] on the built-in mock release, so there's no raw
    // search-hit volume to sum — leave at 0 (declared above).

    // Mock release has no product_info-derived category registry — fall
    // back to the fixed list.
    categoryOptions = SOCIAL_PRIMARY_CATEGORIES;
  } else {
    // ── Real release path ─────────────────────────────────────────────────
    // Fast path (0 or 1 selected category): every combination was
    // precomputed at release-upload time — pure O(1) table lookup, no
    // per-request scan of the release's social-media rows at all.
    //
    // Slow-ish fallback (2+ selected categories): categories are a
    // multi-select OR filter, and precomputing every subset (2^N) isn't
    // practical, so this rare case filters the cached text-free index
    // on demand instead (still no `text`/`link` fields touched).
    const releaseId = ctx.releaseId;
    const table = await fetchSocialAggregateTable(releaseId);
    const platformKey = platformParam && platformParam !== PLATFORM_ALL_KEY ? platformParam : PLATFORM_ALL_KEY;

    let aggregates: { platformTabs: SocialMediaPayload["platformTabs"]; metrics: { totalPosts: number; uniqueAccounts: number; activeCount: number; numInteractions: number }; mentionsByApp: SocialMediaPayload["mentionsByApp"]; productSignalCounts: SocialProductSignalCount[] };

    if (selectedCategories.length <= 1) {
      const categoryKey = selectedCategories.length === 0 ? CATEGORY_ALL_KEY : selectedCategories[0];
      const precomputed = table.byCategory[categoryKey]?.[platformKey] ?? table.byCategory[CATEGORY_ALL_KEY]?.[PLATFORM_ALL_KEY];
      aggregates = precomputed;
    } else {
      const index = await fetchSocialIndex(releaseId);
      aggregates = buildSocialAggregates(index, selectedCategories, platformParam);
    }

    platformTabs = aggregates.platformTabs;
    mentionsByApp = aggregates.mentionsByApp;
    // Same backward-compat concern as totalRawCount above — older
    // precomputed aggregate tables predate this field.
    productSignalCounts = aggregates.productSignalCounts ?? [];

    // Keyword rankings/bubbles: as of the 2026-08-12 schema, KeywordStat
    // carries `product_category` directly, so these now respect the same
    // category filter as everything else — single-category (or none)
    // selections hit the precomputed table below; 2+ selected categories
    // (rare multi-select case) fall back to filtering keyword_stats on
    // demand, mirroring the platformTabs/metrics fallback above.
    let keywordAgg: { uniqueKeywordCount: number; keywordRankings: SocialKeywordRanking[]; keywordBubbles: SocialKeywordBubble[]; totalRawCount: number };
    if (selectedCategories.length <= 1) {
      const categoryKey = selectedCategories.length === 0 ? CATEGORY_ALL_KEY : selectedCategories[0];
      keywordAgg =
        table.byCategoryKeywords[categoryKey]?.[platformKey] ??
        table.byCategoryKeywords[CATEGORY_ALL_KEY]?.[PLATFORM_ALL_KEY];
    } else {
      const release = await fetchReleaseData(releaseId);
      const keywordRankings = buildKeywordRankingsFromStats(release.keyword_stats, selectedCategories, platformParam, 25, KEYWORD_COLORS);
      const keywordBubbles = buildKeywordBubblesFromStats(release.keyword_stats, selectedCategories, platformParam, 15, KEYWORD_COLORS);
      const relevantStats =
        platformParam && platformParam !== PLATFORM_ALL_KEY
          ? release.keyword_stats.filter(
              (s) => s.socialmedia_platform === platformParam && s.product_category && selectedCategories.includes(s.product_category),
            )
          : release.keyword_stats.filter((s) => s.product_category && selectedCategories.includes(s.product_category));
      keywordAgg = {
        uniqueKeywordCount: new Set(relevantStats.map((s) => s.keyword)).size,
        keywordRankings,
        keywordBubbles,
        totalRawCount: relevantStats.reduce((sum, s) => sum + (s.raw_num ?? 0), 0),
      };
    }

    metrics = {
      totalPosts: aggregates.metrics.totalPosts,
      uniqueAccounts: aggregates.metrics.uniqueAccounts,
      activeKeywords: keywordAgg.uniqueKeywordCount,
      activeCount: aggregates.metrics.activeCount,
      // `totalRawCount` was added after some releases' aggregate tables were
      // precomputed and persisted to Storage (see buildSocialAggregateTable
      // in lib/release-mapping.ts) — older cached tables won't have this
      // field, so fall back to 0 instead of crashing StatsRow's
      // `.toLocaleString()` call.
      totalRawCount: keywordAgg.totalRawCount ?? 0,
      // Same backward-compat concern: older cached aggregate tables predate
      // `numInteractions` (added with the 2026-08-25 schema's num_comments/
      // num_likes fields).
      numInteractions: aggregates.metrics.numInteractions ?? 0,
    };
    keywordRankings = keywordAgg.keywordRankings;
    keywordBubbles = keywordAgg.keywordBubbles;
    categoryOptions = table.categoryOptions;
  }

  const payload: SocialMediaPayload = {
    platformTabs,
    metrics,
    keywordRankings,
    mentionsByApp,
    keywordBubbles,
    productSignalCounts,
    categoryOptions,
  };

  return NextResponse.json(payload);
}
