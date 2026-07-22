import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { mockDomains } from "@/app/dashboard/components/mock-data";
import { getActiveChannel } from "@/lib/channel";
import { readChannel, fetchReleaseData, isMockRelease } from "@/lib/releases";
import {
  mapReleaseDomains,
  buildCategoryRegistry,
  convertReportPeriod,
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
    // Either no release has been published to this channel yet, or the
    // built-in mock release is published — serve mock data.
    return NextResponse.json({ domains: mockDomains, reportingPeriodId: "" });
  }

  const release = await fetchReleaseData(pointer.current.releaseId);
  const domains = mapReleaseDomains(release.domains, pointer.current.reportPeriod);
  const categoryOptions = buildCategoryRegistry(release.domains);

  return NextResponse.json({
    domains,
    categoryOptions,
    // Straight from the channel pointer's release name — not derived from rows
    reportingPeriodId: convertReportPeriod(pointer.current.reportPeriod),
  });
}

