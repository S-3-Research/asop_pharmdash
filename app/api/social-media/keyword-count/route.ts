import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { mockKwRawCounts } from "@/app/dashboard/components/mock-data";
import type { SocialKeywordCountPayload } from "@/app/dashboard/components/types";

// Current reporting period
const REPORTING_PERIOD_WINDOW = "2026-04-01 ~ 2026-06-30";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get("pharmdash_auth")?.value !== "1") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const keywordsParam = searchParams.get("keywords") ?? "";
  const platform      = searchParams.get("platform") ?? "all";

  const keywords = keywordsParam.split(",").filter(Boolean);

  const platformKey = platform === "all" ? "all" : platform;

  const results = keywords.map((keyword) => ({
    keyword,
    rawCount: mockKwRawCounts[keyword]?.[platformKey] ?? 0,
  }));

  const payload: SocialKeywordCountPayload = {
    platform,
    reportingPeriod: REPORTING_PERIOD_WINDOW,
    results,
  };

  return NextResponse.json(payload);
}
