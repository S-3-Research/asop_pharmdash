import "server-only";
import { cookies } from "next/headers";

/**
 * Minimal auth guard shared by the admin data-release API routes.
 * Reuses the existing single-role dashboard auth cookie; returns the
 * logged-in username for audit-log "actor" attribution.
 */
export async function requireAuthenticatedActor(): Promise<
  { ok: true; actor: string } | { ok: false }
> {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.get("pharmdash_auth")?.value === "1";

  if (!isAuthenticated) {
    return { ok: false };
  }

  const actor = cookieStore.get("pharmdash_user")?.value || "unknown";
  return { ok: true, actor };
}
