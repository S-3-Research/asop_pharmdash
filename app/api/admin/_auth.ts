import "server-only";
import { NextResponse } from "next/server";
import { accessFailure } from "@/lib/account-access";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type Role = "admin" | "manager" | "viewer";

type AuthResult = { ok: true; actor: string; userId: string; accessExpiresAt: string | null; role: Role } | { ok: false; code?: string };

export function authError(auth: { code?: string }) {
  return NextResponse.json({ message: auth.code === "ACCOUNT_EXPIRED" ? "Account expired. Contact your administrator." : auth.code === "ACCESS_UNAVAILABLE" ? "Account access could not be checked. Please contact your administrator." : auth.code === "ACCOUNT_DISABLED" ? "Your account is disabled. Please contact your administrator." : auth.code === "ACCOUNT_NOT_ACTIVE" ? "Account setup is incomplete. Please contact your administrator." : "Access denied", code: auth.code ?? "UNAUTHORIZED" }, { status: auth.code === "ACCESS_UNAVAILABLE" ? 503 : auth.code ? 403 : 401, headers: { "Cache-Control": "no-store" } });
}

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
  const { data: profile, error } = await admin
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !profile) return { ok: false, code: "ACCESS_UNAVAILABLE" };
  // Rolling out code before the migration must not break local development.
  // Only an entirely legacy schema is accepted, only in dev with management off.
  // A partial migration or any production schema mismatch still fails closed.
  const hasExpiry = Object.hasOwn(profile, "access_expires_at");
  const hasPending = Object.hasOwn(profile, "access_setup_pending");
  const legacyDev = !hasExpiry && !hasPending && process.env.NODE_ENV === "development"
    && process.env.ACCOUNT_EXPIRY_MANAGEMENT_ENABLED !== "true";
  if ((!hasExpiry || !hasPending) && !legacyDev) {
    return { ok: false, code: "ACCESS_UNAVAILABLE" };
  }
  const accessProfile = legacyDev
    ? { ...profile, access_expires_at: null, access_setup_pending: false }
    : profile;
  const code = accessFailure(accessProfile);
  if (code) return { ok: false, code };

  const role: Role =
    profile?.role === "admin" || profile?.role === "manager" ? profile.role : "viewer";

  return { ok: true, actor: user.email ?? user.id, userId: user.id, accessExpiresAt: accessProfile.access_expires_at, role };
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
