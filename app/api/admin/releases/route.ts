import { gunzipSync } from "node:zlib";

import { NextResponse } from "next/server";

import { requireRole } from "@/app/api/admin/_auth";
import { createRelease, listReleases, readChannel } from "@/lib/releases";
import { getSupabaseAdmin, DATA_BUCKET } from "@/lib/supabase-admin";
import { PharmDashReleaseDataSchema } from "@/lib/schemas/pharmdash";
import { runBusinessValidation } from "@/lib/release-validation";

/**
 * GET  /api/admin/releases
 *   -> list all releases + current preview/production channel pointers
 *
 * POST /api/admin/releases
 *   body: { reportPeriod: string, schemaVersion: string, data: <raw JSON> }
 *     -> legacy/small-payload path: raw (optionally gzip Content-Encoding)
 *        body sent straight through this function. Subject to Vercel's
 *        hard 4.5MB serverless-function request body limit.
 *   body: { reportPeriod: string, schemaVersion: string, storagePath: string }
 *     -> large-payload path: client already gzip-uploaded the payload
 *        directly to Supabase Storage via a signed URL from
 *        POST /api/admin/releases/upload-url (see that route). We download
 *        it from Storage here instead — that transfer is between this
 *        function and Supabase, not through Vercel's edge proxy, so it
 *        isn't subject to the 4.5MB limit. The temp object is deleted once
 *        read, regardless of what happens next.
 *
 *   `data` (decoded, either way) must be the full wrapped shape:
 *     { domains: [...], social_media: [...], keyword_stats: [...] }
 */

export async function GET() {
  const auth = await requireRole("admin");
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
  const auth = await requireRole("admin");
  if (!auth.ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let reportPeriod: string | undefined;
  let schemaVersion: string | undefined;
  let data: unknown;
  let tempStoragePath: string | null = null;

  try {
    // Release uploads are gzip-compressed client-side (see
    // app/admin/data-releases/data-releases-client.tsx `gzipJson`) to
    // shrink payloads. Small ones are still sent straight through this
    // function; large ones go via Supabase Storage instead (storagePath
    // path below) to dodge Vercel's hard 4.5MB request body limit entirely.
    if (request.headers.get("content-encoding") === "gzip") {
      const compressed = Buffer.from(await request.arrayBuffer());
      const decompressed = gunzipSync(compressed);
      const parsed = JSON.parse(decompressed.toString("utf-8"));
      reportPeriod = parsed.reportPeriod;
      schemaVersion = parsed.schemaVersion;
      data = parsed.data;
    } else {
      const body = (await request.json()) as {
        reportPeriod?: string;
        schemaVersion?: string;
        data?: unknown;
        storagePath?: string;
      };
      reportPeriod = body.reportPeriod;
      schemaVersion = body.schemaVersion;

      if (body.storagePath) {
        tempStoragePath = body.storagePath;
        const supabase = getSupabaseAdmin();
        const { data: file, error } = await supabase.storage
          .from(DATA_BUCKET)
          .download(body.storagePath);
        if (error || !file) {
          return NextResponse.json(
            { message: `Failed to retrieve uploaded file: ${error?.message ?? "not found"}` },
            { status: 400 },
          );
        }
        const compressed = Buffer.from(await file.arrayBuffer());
        const decompressed = gunzipSync(compressed);
        // The client's gzipJson() compresses the *whole* wrapper object
        // ({ reportPeriod, schemaVersion, data }), same as the
        // Content-Encoding: gzip branch above — not just the `data`
        // payload by itself. Unwrap `.data` here too, otherwise `data`
        // ends up one level too deep (its actual `domains`/`social_media`/
        // `keyword_stats` arrays are nested under `data.data.*`), which
        // silently validates as an empty release (all three arrays fall
        // back to their Zod `.default([])`) instead of erroring.
        const parsed = JSON.parse(decompressed.toString("utf-8"));
        data = parsed.data;
      } else {
        data = body.data;
      }
    }
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  } finally {
    // Best-effort cleanup of the temp Storage object — it's already been
    // fully read into memory above by this point either way.
    if (tempStoragePath) {
      void getSupabaseAdmin().storage.from(DATA_BUCKET).remove([tempStoragePath]);
    }
  }

  if (!reportPeriod || !/^[a-zA-Z0-9-]+$/.test(reportPeriod)) {
    return NextResponse.json(
      { message: "reportPeriod is required and must be alphanumeric/hyphen only" },
      { status: 400 },
    );
  }
  if (!schemaVersion) {
    return NextResponse.json({ message: "schemaVersion is required" }, { status: 400 });
  }

  if (Array.isArray(data) || typeof data !== "object" || data === null) {
    return NextResponse.json(
      {
        message:
          'data must be the full shape: { "domains": [], "social_media": [], "keyword_stats": [] }',
      },
      { status: 400 },
    );
  }

  // --- Layer 1: Zod schema validation (types, required, enums, nesting) ------
  const parseResult = PharmDashReleaseDataSchema.safeParse(data);
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
