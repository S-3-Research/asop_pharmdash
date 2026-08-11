import { NextResponse } from "next/server";

import { requireRole } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type PatchBody = {
  role?: "admin" | "viewer";
  status?: "active" | "disabled";
};

/**
 * PATCH /api/admin/users/:userId
 *   body: { role?: "admin" | "viewer", status?: "active" | "disabled" }
 *   -> updates an existing user's app role and/or bans/unbans their
 *      Supabase Auth account (status: "disabled" sets a long auth.users
 *      ban; "active" clears it).
 *
 * POST /api/admin/users/:userId  (action=resend)
 *   -> resends the invite email for a user stuck in "invited" status.
 *
 * DELETE /api/admin/users/:userId
 *   -> permanently deletes the Supabase Auth user. `public.profiles` has
 *      `on delete cascade` on its `user_id` foreign key (see
 *      schema-reference/supabase_auth_profiles.sql), so the profile row is
 *      removed automatically — no separate cleanup needed.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireRole("admin");
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
    .select("email")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile?.email && profile.email === auth.actor) {
    return NextResponse.json(
      { message: "You cannot delete your own account" },
      { status: 400 },
    );
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
  const auth = await requireRole("admin");
  if (!auth.ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const body = (await request.json()) as PatchBody;
  const admin = getSupabaseAdmin();

  if (body.role) {
    if (body.role !== "admin" && body.role !== "viewer") {
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
  const auth = await requireRole("admin");
  if (!auth.ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string };

  if (body.action !== "resend") {
    return NextResponse.json({ message: "Unsupported action" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("email, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile?.email) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  const redirectTo = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/set-password`
    : undefined;

  const { error } = await admin.auth.admin.inviteUserByEmail(profile.email, {
    data: { role: profile.role },
    redirectTo,
  });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
