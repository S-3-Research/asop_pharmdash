import { NextResponse } from "next/server";

import { requireRole } from "@/app/api/admin/_auth";
import { setChannelRelease, type ChannelName } from "@/lib/releases";

/**
 * POST /api/admin/releases/publish
 *   body: { releaseId: string, channel: "dev" | "preview" | "production" }
 *
 * Used for Publish-to-Dev, Publish-to-Preview, Promote-to-Production, AND
 * Rollback — all are the same underlying operation: point a channel at a
 * releaseId. The only difference is which releaseId the caller passes (new
 * upload vs. an older one for rollback) and which channel.
 *
 * A lightweight extra confirmation is required for "production" to reduce
 * the chance of an accidental promote from the UI.
 */
export async function POST(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { releaseId, channel } = (body ?? {}) as {
    releaseId?: string;
    channel?: ChannelName;
  };

  if (!releaseId) {
    return NextResponse.json({ message: "releaseId is required" }, { status: 400 });
  }
  if (channel !== "dev" && channel !== "preview" && channel !== "production") {
    return NextResponse.json(
      { message: 'channel must be "dev", "preview", or "production"' },
      { status: 400 },
    );
  }

  try {
    const pointer = await setChannelRelease(channel, releaseId, auth.actor);
    return NextResponse.json({ channel, pointer });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Failed to publish release" },
      { status: 500 },
    );
  }
}
