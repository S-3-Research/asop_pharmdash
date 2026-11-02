import { NextResponse } from "next/server";

import { authError, requireAuthenticatedActor } from "@/app/api/admin/_auth";

/**
 * Returns the current logged-in user's basic profile info (email + role),
 * used by client components like the sidebar user menu that can't call
 * server-only helpers directly.
 */
export async function GET() {
  const auth = await requireAuthenticatedActor();

  if (!auth.ok) {
    return authError(auth);
  }

  return NextResponse.json({ email: auth.actor, role: auth.role, access_expires_at: auth.accessExpiresAt }, { headers: { "Cache-Control": "no-store" } });
}
