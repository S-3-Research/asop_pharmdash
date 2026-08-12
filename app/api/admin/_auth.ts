import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type Role = "admin" | "manager" | "viewer";

type AuthResult = { ok: true; actor: string; role: Role } | { ok: false };

/**
 * Resolves the currently logged-in Supabase user (from the session cookie)
 * plus their app-level role from `public.profiles`. Used to gate both API
 * routes and pages that require authentication.
 *
 * `actor` is the user's email, kept for audit-log "actor" attribution.
 */
export async function requireAuthenticatedActor(): Promise<AuthResult> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false };
  }

  // If this user has an enrolled TOTP factor, the session must have
  // completed that second step (aal2) to be considered fully authenticated.
  // A session stuck at aal1 for a user with MFA enrolled means the login
  // flow was interrupted before the code step — treat as logged out.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    return { ok: false };
  }

  // Query profiles with the service-role client so this doesn't depend on
  // (or get blocked by) RLS policies.
  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role: Role =
    profile?.role === "admin" || profile?.role === "manager" ? profile.role : "viewer";

  return { ok: true, actor: user.email ?? user.id, role };
}

/**
 * Same as `requireAuthenticatedActor`, but also requires the given role.
 * Use this to gate admin-only pages/API routes (e.g. data releases).
 */
export async function requireRole(role: Role): Promise<AuthResult> {
  const auth = await requireAuthenticatedActor();
  if (!auth.ok) return auth;
  if (auth.role !== role) return { ok: false };
  return auth;
}

/**
 * Same as `requireRole`, but accepts any of the given roles. Use this for
 * pages/routes shared between admin and manager (e.g. the Users page,
 * where managers get a restricted view of their own invited viewers).
 */
export async function requireAnyRole(roles: Role[]): Promise<AuthResult> {
  const auth = await requireAuthenticatedActor();
  if (!auth.ok) return auth;
  if (!roles.includes(auth.role)) return { ok: false };
  return auth;
}
