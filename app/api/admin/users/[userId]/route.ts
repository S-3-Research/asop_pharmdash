import { NextResponse } from "next/server";

import { requireAnyRole, requireRole } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

type PatchBody = {
  role?: "admin" | "manager" | "viewer";
  status?: "active" | "disabled";
};

/**
 * Fetches the target profile and checks whether `actor` (with `role`) is
 * allowed to act on it. Admins can act on anyone; managers may only act on
 * viewers they personally invited. Returns the profile row on success, or
 * an error NextResponse to return immediately.
 */
async function loadManageableProfile(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  actor: string,
  role: "admin" | "manager" | "viewer",
) {
  const { data: profile } = await admin
    .from("profiles")
    .select("email, role, invited_by")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile) {
    return { ok: false as const, response: NextResponse.json({ message: "User not found" }, { status: 404 }) };
  }

  if (role === "manager" && (profile.invited_by !== actor || profile.role !== "viewer")) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: "Unauthorized" }, { status: 403 }),
    };
  }

  return { ok: true as const, profile };
}

/**
 * PATCH /api/admin/users/:userId
 *   body: { role?: "admin" | "manager" | "viewer", status?: "active" | "disabled" }
 *   -> updates an existing user's app role and/or bans/unbans their
 *      Supabase Auth account (status: "disabled" sets a long auth.users
 *      ban; "active" clears it). Managers may only toggle `status` on
 *      viewers they invited — never change any role.
 *
 * POST /api/admin/users/:userId  (action=resend)
 *   -> resends a set-password link for a user stuck in "invited" status.
 *      Uses `resetPasswordForEmail` (not `inviteUserByEmail`) because the
 *      auth.users row already exists at this point — `inviteUserByEmail`
 *      only works for emails that have never been registered before and
 *      fails with "already registered" on any resend.
 *
 *      Deliberately uses the PLAIN (implicit-flow, non-cookie) client from
 *      lib/supabase.ts here, NOT the cookie-based PKCE client from
 *      lib/supabase-server.ts. PKCE requires the code_verifier to be
 *      readable by whichever browser completes the exchange — fine for
 *      the user-initiated forgot-password flow (same person requests and
 *      later clicks the link, same browser), but broken here: the code
 *      would be written to *this admin's* browser cookies, while the
 *      invited user (a different person, different browser) is the one
 *      who actually clicks the emailed link, so they'd always hit "PKCE
 *      code verifier not found in storage". The implicit-flow client
 *      produces a hash-fragment link (`#access_token=...`) instead, which
 *      carries everything needed in the URL itself — no server-side state
 *      to share across browsers, and set-password/page.tsx already
 *      handles that format (used by the original invite email too).
 *
 * DELETE /api/admin/users/:userId
 *   -> permanently deletes the Supabase Auth user. `public.profiles` has
 *      `on delete cascade` on its `user_id` foreign key (see
 *      schema-reference/supabase_auth_profiles.sql), so the profile row is
 *      removed automatically — no separate cleanup needed.
 *      Admins may delete anyone (except themselves). Managers may only
 *      delete viewers they personally invited AND who are still
 *      `status: 'invited'` (never got around to setting a password) —
 *      this covers "I typo'd the email / invited the wrong person"
 *      without letting a manager remove an already-active teammate's
 *      account, which stays an admin-only, more deliberate action.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireAnyRole(["admin", "manager"]);
  if (!auth.ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const admin = getSupabaseAdmin();

  // Look up the target's email so we can block self-deletion by identity
  // (the auth session's own user id isn't directly exposed here, so we
  // compare emails via requireRole's `actor`, which is the caller's email).
  const { data: profile } = await admin
    .from("profiles")
    .select("email, role, invited_by, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile?.email && profile.email === auth.actor) {
    return NextResponse.json(
      { message: "You cannot delete your own account" },
      { status: 400 },
    );
  }

  if (auth.role === "manager") {
    if (
      !profile ||
      profile.invited_by !== auth.actor ||
      profile.role !== "viewer" ||
      profile.status !== "invited"
    ) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireAnyRole(["admin", "manager"]);
  if (!auth.ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const body = (await request.json()) as PatchBody;
  const admin = getSupabaseAdmin();

  // Managers may only toggle status (enable/disable) on viewers they
  // invited — never change anyone's role, including their own invitees'.
  if (auth.role === "manager" && body.role) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const gate = await loadManageableProfile(admin, userId, auth.actor, auth.role);
  if (!gate.ok) return gate.response;

  if (body.role) {
    if (body.role !== "admin" && body.role !== "manager" && body.role !== "viewer") {
      return NextResponse.json({ message: "Invalid role" }, { status: 400 });
    }
    const { error } = await admin.from("profiles").update({ role: body.role }).eq(
      "user_id",
      userId,
    );
    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
  }

  if (body.status) {
    if (body.status !== "active" && body.status !== "disabled") {
      return NextResponse.json({ message: "Invalid status" }, { status: 400 });
    }

    // `ban_duration` is Supabase Auth's mechanism for locking an account:
    // a far-future duration effectively disables login; "none" clears it.
    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: body.status === "disabled" ? "876000h" : "none",
    });
    if (authError) {
      return NextResponse.json({ message: authError.message }, { status: 500 });
    }

    const { error } = await admin
      .from("profiles")
      .update({ status: body.status })
      .eq("user_id", userId);
    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireAnyRole(["admin", "manager"]);
  if (!auth.ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string };

  if (body.action !== "resend") {
    return NextResponse.json({ message: "Unsupported action" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const gate = await loadManageableProfile(admin, userId, auth.actor, auth.role);
  if (!gate.ok) return gate.response;
  const profile = gate.profile;

  if (!profile?.email) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  const redirectTo = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/set-password`
    : undefined;

  if (!supabase) {
    return NextResponse.json({ message: "Supabase is not configured" }, { status: 500 });
  }
  const { error } = await supabase.auth.resetPasswordForEmail(profile.email, { redirectTo });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
