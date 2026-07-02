import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { mockSocialPosts } from "@/app/dashboard/components/mock-data";
import type { SocialSamplesPayload } from "@/app/dashboard/components/types";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  if (cookieStore.get("pharmdash_auth")?.value !== "1") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const categoriesParam = searchParams.get("categories");
  const platformParam   = searchParams.get("platform");
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "10", 10)));

  const selectedCategories = categoriesParam
    ? categoriesParam.split(",").filter(Boolean)
    : [];

  let filtered =
    selectedCategories.length > 0
      ? mockSocialPosts.filter((p) =>
          p.categories.some((c) => selectedCategories.includes(c.primaryCategory)),
        )
      : [...mockSocialPosts];

  if (platformParam && platformParam !== "all") {
    filtered = filtered.filter((p) => p.platform === platformParam);
  }

  // Sort newest first
  filtered.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const total  = filtered.length;
  const start  = (page - 1) * pageSize;
  const samples = filtered.slice(start, start + pageSize);

  const payload: SocialSamplesPayload = { samples, total, page, pageSize };
  return NextResponse.json(payload);
}
