import { NextResponse } from "next/server";

import { requireAuthenticatedActor } from "@/app/api/admin/_auth";
import { mockDomains } from "@/app/dashboard/components/mock-data";
import { getActiveChannel } from "@/lib/channel";
import { fetchReleaseData, getActiveReleaseContext, getReportPeriodDisplayMap } from "@/lib/releases";
import { mapReleaseDomains, buildCategoryRegistry } from "@/lib/release-mapping";

export async function GET() {
  const auth = await requireAuthenticatedActor();

  if (!auth.ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const channel = getActiveChannel();
  const ctx = await getActiveReleaseContext(channel);

  if (ctx.isMock) {
    // Either no release has been published to this channel yet, or the
    // built-in mock release is published — serve mock data.
    return NextResponse.json({
      domains: mockDomains,
      reportingPeriodId: "",
      reportingPeriodDisplayName: "",
      reportingPeriodLabels: {},
    });
  }

  const release = await fetchReleaseData(ctx.releaseId);
  const domains = mapReleaseDomains(release.domains, ctx.pointer.current!.reportPeriod);
  const categoryOptions = buildCategoryRegistry(release.domains);
  // Full internal-code -> display-name map across ALL known releases — the
  // Total Domain trend chart and Domain Examples' expanded detail both need
  // to label historical reporting periods, not just the currently-active one.
  const reportingPeriodLabels = await getReportPeriodDisplayMap();

  return NextResponse.json({
    domains,
    categoryOptions,
    // Straight from the channel pointer's release name — not derived from rows
    reportingPeriodId: ctx.reportingPeriodId,
    // Admin-configured, end-user-facing label (see lib/releases.ts
    // `setReleaseDisplayName`) — falls back to a formatted version of the
    // code when unset.
    reportingPeriodDisplayName: ctx.reportingPeriodDisplayName,
    reportingPeriodLabels,
  });
}

