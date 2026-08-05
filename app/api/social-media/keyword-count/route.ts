import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { mockKwRawCounts } from "@/app/dashboard/components/mock-data";
import type { SocialKeywordCountPayload } from "@/app/dashboard/components/types";
import { getActiveChannel } from "@/lib/channel";
import { readChannel, fetchReleaseData, isMockRelease } from "@/lib/releases";
import { lookupKeywordRawCounts, convertReportPeriod } from "@/lib/release-mapping";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get("pharmdash_auth")?.value !== "1") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const keywordsParam = searchParams.get("keywords") ?? "";
  const platform      = searchParams.get("platform") ?? "all";

  const keywords = keywordsParam.split(",").filter(Boolean);

  const channel = getActiveChannel();
  const pointer = await readChannel(channel);

  if (!pointer.current || isMockRelease(pointer.current.releaseId)) {
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

  const release = await fetchReleaseData(pointer.current.releaseId);
  const results = lookupKeywordRawCounts(release.keyword_stats, keywords, platform);

  const payload: SocialKeywordCountPayload = {
    platform,
    reportingPeriod: convertReportPeriod(pointer.current.reportPeriod),
    results,
  };

  return NextResponse.json(payload);
}
