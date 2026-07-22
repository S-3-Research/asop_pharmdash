import { NextResponse } from "next/server";

import { requireAuthenticatedActor } from "@/app/api/admin/_auth";
import { createRelease, listReleases, readChannel } from "@/lib/releases";
import { PharmDashReleaseDataSchema } from "@/lib/schemas/pharmdash";
import { runBusinessValidation } from "@/lib/release-validation";

/**
 * GET  /api/admin/releases
 *   -> list all releases + current preview/production channel pointers
 *
 * POST /api/admin/releases
 *   body: { reportPeriod: string, schemaVersion: string, data: <raw JSON> }
 *   -> validates (Zod + business rules), and if valid, creates an immutable
 *      release. Does NOT publish it to any channel.
 *
 *   `data` accepts two shapes for convenience:
 *     1. The full wrapped shape: { domains: [...], social_media: [...],
 *        social_media_summary: [...] }
 *     2. A bare array of domain records (as exported by the upstream
 *        scraper/Pydantic pipeline), which is normalized into
 *        { domains: <array>, social_media: [], social_media_summary: [] }.
 */

function normalizeReleasePayload(input: unknown): unknown {
  if (Array.isArray(input)) {
    return { domains: input, social_media: [], social_media_summary: [] };
  }
  return input;
}

export async function GET() {
  const auth = await requireAuthenticatedActor();
  if (!auth.ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const [releases, preview, production] = await Promise.all([
    listReleases(),
    readChannel("preview"),
    readChannel("production"),
  ]);

  return NextResponse.json({ releases, channels: { preview, production } });
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedActor();
  if (!auth.ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { reportPeriod, schemaVersion, data } = (body ?? {}) as {
    reportPeriod?: string;
    schemaVersion?: string;
    data?: unknown;
  };

  if (!reportPeriod || !/^[a-zA-Z0-9-]+$/.test(reportPeriod)) {
    return NextResponse.json(
      { message: "reportPeriod is required and must be alphanumeric/hyphen only" },
      { status: 400 },
    );
  }
  if (!schemaVersion) {
    return NextResponse.json({ message: "schemaVersion is required" }, { status: 400 });
  }

  // --- Layer 1: Zod schema validation (types, required, enums, nesting) ------
  const parseResult = PharmDashReleaseDataSchema.safeParse(normalizeReleasePayload(data));
  if (!parseResult.success) {
    return NextResponse.json(
      {
        message: "Schema validation failed",
        schemaErrors: parseResult.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 422 },
    );
  }

  // --- Layer 2: business-rule validation (duplicates, referential integrity) -
  const businessReport = runBusinessValidation(parseResult.data);
  if (!businessReport.ok) {
    return NextResponse.json(
      { message: "Business validation failed", validation: businessReport },
      { status: 422 },
    );
  }

  // --- Determine next version suffix for this report period -----------------
  const existingReleases = await listReleases();
  const versionsForPeriod = existingReleases
    .filter((m) => m.reportPeriod === reportPeriod)
    .map((m) => {
      const match = m.releaseId.match(/-v(\d+)$/);
      return match ? Number(match[1]) : 0;
    });
  const nextVersion = (versionsForPeriod.length > 0 ? Math.max(...versionsForPeriod) : 0) + 1;
  const releaseId = `${reportPeriod}-v${nextVersion}`;

  try {
    const manifest = await createRelease({
      releaseId,
      reportPeriod,
      schemaVersion,
      data: parseResult.data,
      actor: auth.actor,
    });

    return NextResponse.json({ manifest, validation: businessReport });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Failed to create release" },
      { status: 500 },
    );
  }
}
