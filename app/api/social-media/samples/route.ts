import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { mockSocialPosts } from "@/app/dashboard/components/mock-data";
import type { SocialSamplesPayload } from "@/app/dashboard/components/types";
import { getActiveChannel } from "@/lib/channel";
import { readChannel, fetchReleaseData, fetchSocialIndex, isMockRelease } from "@/lib/releases";
import { paginateSocialPosts } from "@/lib/release-mapping";

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

  const channel = getActiveChannel();
  const pointer = await readChannel(channel);

  if (!pointer.current || isMockRelease(pointer.current.releaseId)) {
    let filtered =
      selectedCategories.length > 0
        ? mockSocialPosts.filter((p) =>
            p.categories.some((c) => selectedCategories.includes(c.primaryCategory)),
          )
        : [...mockSocialPosts];

    if (platformParam && platformParam !== "all") {
      filtered = filtered.filter((p) => p.platform === platformParam);
    }

    filtered.sort(
      (a, b) => (b.timestamp ? new Date(b.timestamp).getTime() : 0) -
                (a.timestamp ? new Date(a.timestamp).getTime() : 0),
    );

    const total  = filtered.length;
    const start  = (page - 1) * pageSize;
    const samples = filtered.slice(start, start + pageSize);

    const payload: SocialSamplesPayload = { samples, total, page, pageSize };
    return NextResponse.json(payload);
  }

  // ── Real release path — filter/sort/paginate the text-free index first,
  // then hydrate only the requested page's rows (with `text`) ──────────────
  const releaseId = pointer.current.releaseId;
  const [index, release] = await Promise.all([
    fetchSocialIndex(releaseId),
    fetchReleaseData(releaseId),
  ]);

  const { samples, total } = paginateSocialPosts(
    index,
    release.social_media,
    selectedCategories,
    platformParam,
    page,
    pageSize,
  );

  const payload: SocialSamplesPayload = { samples, total, page, pageSize };
  return NextResponse.json(payload);
}
