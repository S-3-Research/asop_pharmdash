import { NextRequest, NextResponse } from "next/server";

import { requireAuthenticatedActor } from "@/app/api/admin/_auth";
import { mockKwRawCounts } from "@/app/dashboard/components/mock-data";
import type { SocialKeywordCountPayload } from "@/app/dashboard/components/types";
import { getActiveChannel } from "@/lib/channel";
import { fetchReleaseData, getActiveReleaseContext } from "@/lib/releases";
import { lookupKeywordRawCounts } from "@/lib/release-mapping";

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedActor();
  if (!auth.ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const keywordsParam = searchParams.get("keywords") ?? "";
  const platform      = searchParams.get("platform") ?? "all";
  const categoriesParam = searchParams.get("categories");

  const keywords = keywordsParam.split(",").filter(Boolean);
  const selectedCategories = categoriesParam ? categoriesParam.split(",").filter(Boolean) : [];

  const channel = getActiveChannel();
  const ctx = await getActiveReleaseContext(channel);

  if (ctx.isMock) {
    const platformKey = platform === "all" ? "all" : platform;
    const results = keywords.map((keyword) => ({
      keyword,
      rawCount: mockKwRawCounts[keyword]?.[platformKey] ?? 0,
    }));

    const payload: SocialKeywordCountPayload = {
      platform,
      // Mock counts carry no release metadata; a real backend should return the
      // release's reporting-period id here (e.g. "2026-RPT-02").
      reportingPeriod: "",
      results,
    };
    return NextResponse.json(payload);
  }

  const release = await fetchReleaseData(ctx.releaseId);
  const results = lookupKeywordRawCounts(release.keyword_stats, keywords, selectedCategories, platform);

  const payload: SocialKeywordCountPayload = {
    platform,
    reportingPeriod: ctx.reportingPeriodId,
    results,
  };

  return NextResponse.json(payload);
}
