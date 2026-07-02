import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { mockSocialPosts } from "@/app/dashboard/components/mock-data";
import type {
  SocialKeywordBubble,
  SocialKeywordRanking,
  SocialMediaPayload,
  SocialMentionByApp,
  SocialPlatformTab,
} from "@/app/dashboard/components/types";

const KEYWORD_COLORS = [
  "#ef4444", "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981",
  "#ec4899", "#f97316", "#06b6d4", "#84cc16", "#6366f1",
];

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get("pharmdash_auth")?.value !== "1") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const categoriesParam = searchParams.get("categories");
  const platformParam   = searchParams.get("platform");

  const selectedCategories = categoriesParam
    ? categoriesParam.split(",").filter(Boolean)
    : [];

  // ── Category-filtered (used for platform tabs + all panels) ──────────────
  const catFiltered =
    selectedCategories.length > 0
      ? mockSocialPosts.filter((p) =>
          p.categories.some((c) => selectedCategories.includes(c.primaryCategory)),
        )
      : mockSocialPosts;

  // ── Platform tabs — derived from category-filtered data only ─────────────
  const platformCountMap = new Map<string, number>();
  for (const post of catFiltered) {
    platformCountMap.set(post.platform, (platformCountMap.get(post.platform) ?? 0) + 1);
  }
  const platformTabs: SocialPlatformTab[] = [...platformCountMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([platform, count]) => ({ platform, count }));

  // ── Full filter (category AND platform) ──────────────────────────────────
  const filtered =
    platformParam && platformParam !== "all"
      ? catFiltered.filter((p) => p.platform === platformParam)
      : catFiltered;

  // ── Metrics ───────────────────────────────────────────────────────────────
  const uniqueAccounts = new Set(filtered.map((p) => p.username)).size;
  const allKeywords    = filtered.flatMap((p) => p.keywords ?? []);
  const uniqueKeywords = new Set(allKeywords).size;
  const activeCount    = filtered.filter((p) => p.status === "active").length;

  // ── Keyword rankings ──────────────────────────────────────────────────────
  const kwCountMap = new Map<string, number>();
  for (const kw of allKeywords) {
    kwCountMap.set(kw, (kwCountMap.get(kw) ?? 0) + 1);
  }
  const keywordRankings: SocialKeywordRanking[] = [...kwCountMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([keyword, signalCount], i) => ({
      keyword,
      signalCount,
      growthRate: null,
      color: KEYWORD_COLORS[i % KEYWORD_COLORS.length],
    }));

  // ── Mentions by app ───────────────────────────────────────────────────────
  const mentionMap = new Map<string, number>();
  for (const post of filtered) {
    for (const app of post.mentions) {
      mentionMap.set(app, (mentionMap.get(app) ?? 0) + 1);
    }
  }
  const mentionsByApp: SocialMentionByApp[] = [...mentionMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([app, count]) => ({ app, count }));

  // ── Keyword bubbles (performance chart) ──────────────────────────────────
  // rawCount is fetched client-side via /api/social-media/keyword-count
  const keywordBubbles: SocialKeywordBubble[] = [...kwCountMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([keyword, signalCount], i) => ({
      keyword,
      signalCount,
      color: KEYWORD_COLORS[i % KEYWORD_COLORS.length],
    }));

  const payload: SocialMediaPayload = {
    platformTabs,
    metrics: { totalPosts: filtered.length, uniqueAccounts, activeKeywords: uniqueKeywords, activeCount },
    keywordRankings,
    mentionsByApp,
    keywordBubbles,
  };

  return NextResponse.json(payload);
}
