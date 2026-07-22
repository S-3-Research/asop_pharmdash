import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { subPageDataMap } from "@/app/dashboard/components/mock-data";
import { getActiveChannel } from "@/lib/channel";
import { readChannel, fetchReleaseData, isMockRelease } from "@/lib/releases";
import {
  buildCategoryRegistry,
  buildDrillablePieData,
  mapReleaseDomainsToListings,
} from "@/lib/release-mapping";

export async function GET() {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.get("pharmdash_auth")?.value === "1";

  if (!isAuthenticated) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const channel = getActiveChannel();
  const pointer = await readChannel(channel);

  if (!pointer.current || isMockRelease(pointer.current.releaseId)) {
    // No release published yet, or the built-in mock release is published
    // — serve mock data.
    const { title, summary, categories, drillablePieData, listings } =
      subPageDataMap["top-products"];

    return NextResponse.json({
      title,
      summary,
      categories,
      drillablePieData,
      listings: (listings ?? []).map(
        ({ id, source, primaryCategory, secondaryCategory, reportingPeriodId }) => ({
          id,
          source,
          primaryCategory,
          secondaryCategory,
          reportingPeriodId,
        }),
      ),
    });
  }

  const release = await fetchReleaseData(pointer.current.releaseId);
  const listings = mapReleaseDomainsToListings(release.domains, pointer.current.reportPeriod);
  const categoryOptions = buildCategoryRegistry(release.domains);
  const categories = [{ id: "all", name: "All Categories" }, ...categoryOptions];
  const drillablePieData = buildDrillablePieData(listings);

  return NextResponse.json({
    title: "Top Products",
    summary: "Track category volume, product trend and top-ranked products.",
    categories,
    drillablePieData,
    listings: listings.map(
      ({ id, source, primaryCategory, secondaryCategory, reportingPeriodId }) => ({
        id,
        source,
        primaryCategory,
        secondaryCategory,
        reportingPeriodId,
      }),
    ),
  });
}

