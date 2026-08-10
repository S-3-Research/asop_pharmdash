import { NextResponse } from "next/server";

import { requireAuthenticatedActor } from "@/app/api/admin/_auth";
import { subPageDataMap } from "@/app/dashboard/components/mock-data";
import { getActiveChannel } from "@/lib/channel";
import { readChannel, fetchReleaseData, fetchTopProductsListings, isMockRelease } from "@/lib/releases";
import {
  buildCategoryRegistry,
  buildDrillablePieData,
  convertReportPeriod,
} from "@/lib/release-mapping";

export async function GET() {
  const auth = await requireAuthenticatedActor();

  if (!auth.ok) {
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
      reportingPeriodId: "",
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
  const listings = await fetchTopProductsListings(pointer.current.releaseId);
  const categoryOptions = buildCategoryRegistry(release.domains);
  const categories = [{ id: "all", name: "All Categories" }, ...categoryOptions];
  const drillablePieData = buildDrillablePieData(listings);

  return NextResponse.json({
    title: "Top Products",
    summary: "Track category volume, product trend and top-ranked products.",
    categories,
    drillablePieData,
    // Straight from the channel pointer's release name — not derived from rows
    reportingPeriodId: convertReportPeriod(pointer.current.reportPeriod),
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

