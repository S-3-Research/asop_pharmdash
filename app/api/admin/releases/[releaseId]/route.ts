import { NextResponse } from "next/server";

import { requireRole } from "@/app/api/admin/_auth";
import { setReleaseDisplayName } from "@/lib/releases";

/**
 * PATCH /api/admin/releases/[releaseId]
 *   body: { displayName: string | null }
 *     -> sets (or clears, with null/empty string) the admin-configured
 *        end-user-facing display name for this release's reporting period.
 *        This is the manual config point referenced across the dashboard:
 *        the internal `reportPeriod` code (e.g. "2026-RPT-01") stays as
 *        the immutable release identifier, while `displayName` is what
 *        gets shown to end users wherever a reporting-period label is
 *        surfaced (falls back to the formatted code if unset).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ releaseId: string }> },
) {
  const auth = await requireRole("admin");
  if (!auth.ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { releaseId } = await params;

  let displayName: string | null;
  try {
    const body = (await request.json()) as { displayName?: string | null };
    displayName = body.displayName ?? null;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  if (displayName !== null && typeof displayName !== "string") {
    return NextResponse.json({ message: "displayName must be a string or null" }, { status: 400 });
  }

  try {
    const manifest = await setReleaseDisplayName(releaseId, displayName);
    return NextResponse.json({ manifest });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Failed to update release" },
      { status: 400 },
    );
  }
}
