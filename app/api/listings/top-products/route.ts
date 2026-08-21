import { NextResponse } from "next/server";

import { requireAuthenticatedActor } from "@/app/api/admin/_auth";
import { subPageDataMap, mockDomains } from "@/app/dashboard/components/mock-data";
import { getActiveChannel } from "@/lib/channel";
import { readChannel, fetchReleaseData, fetchTopProductsListings, isMockRelease } from "@/lib/releases";
import {
  buildCategoryRegistry,
  buildDrillablePieData,
  convertReportPeriod,
  mapReleaseDomain,
} from "@/lib/release-mapping";
import type { Domain } from "@/app/dashboard/components/types";

/** Aggregate the domain-alive / social-presence counts the Overview page's
 *  Overall Summary strip needs — always derived from the full domain set
 *  for the release (or the mock domain set), never from the listings-only
 *  payload, since "alive"/"has social profile" are Domain-level facts. */
function buildDomainSummary(domains: Domain[]) {
  const total = domains.length;
  const aliveCount = domains.filter((d) => d.isLive).length;
  const socialCount = domains.filter((d) => d.socialProfiles.length > 0).length;
  return { total, aliveCount, socialCount };
}

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
      domainSummary: buildDomainSummary(mockDomains),
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
  const reportingPeriodId = convertReportPeriod(pointer.current.reportPeriod);
  const mappedDomains = release.domains.map((d) => mapReleaseDomain(d, reportingPeriodId));
  const categoryOptions = buildCategoryRegistry(release.domains);
  const categories = [{ id: "all", name: "All Categories" }, ...categoryOptions];
  const drillablePieData = buildDrillablePieData(listings);

  return NextResponse.json({
    title: "Top Products",
    summary: "Track category volume, product trend and top-ranked products.",
    categories,
    drillablePieData,
    // Straight from the channel pointer's release name — not derived from rows
    reportingPeriodId,
    domainSummary: buildDomainSummary(mappedDomains),
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


