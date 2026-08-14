import { NextResponse } from "next/server";

import { requireRole } from "@/app/api/admin/_auth";
import { fetchReleaseData, getManifest, isMockRelease } from "@/lib/releases";

/**
 * GET /api/admin/releases/[releaseId]/download
 *   -> streams the full release payload (domains, social_media,
 *      keyword_stats) back as a downloadable JSON file, so admins can
 *      inspect or re-upload a previous release from the Data Releases page.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ releaseId: string }> },
) {
  const auth = await requireRole("admin");
  if (!auth.ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { releaseId } = await params;

  if (isMockRelease(releaseId)) {
    return NextResponse.json(
      { message: "The built-in mock release has no downloadable data file." },
      { status: 400 },
    );
  }

  const manifest = await getManifest(releaseId);
  if (!manifest) {
    return NextResponse.json({ message: `Release "${releaseId}" not found` }, { status: 404 });
  }

  try {
    const data = await fetchReleaseData(releaseId);
    const json = JSON.stringify(data, null, 2);

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${releaseId}.json"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Failed to load release data" },
      { status: 500 },
    );
  }
}
