import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/auth/activate
 *   body: { accessToken: string }
 *   -> marks the session's own profile row as `status = 'active'`.
 *
 * Called once by app/auth/set-password/page.tsx immediately after
 * `auth.updateUser({ password })` succeeds — this is the only
 * deterministic signal that an invited user has actually finished setup.
 *
 * We deliberately do NOT infer this from any `auth.users` column via a
 * database trigger (see schema-reference/supabase_auth_profiles_invites.sql
 * history): `email_confirmed_at` flips as soon as the invite/recovery
 * token is verified (even if the user abandons the page, or an email
 * security scanner prefetches the link and burns the token before the
 * real user clicks it); `encrypted_password` is non-null from the moment
 * `inviteUserByEmail` is called (GoTrue writes a random placeholder
 * immediately); and `last_sign_in_at` is set the moment the invite/
 * recovery link's implicit-flow token is verified and a session is
 * established — before the user has typed a password at all. None of
 * those columns can distinguish "token was verified" from "user actually
 * finished setup", so only an explicit call from the one place that KNOWS
 * setup succeeded is reliable.
 *
 * Takes the access token directly in the request body (rather than
 * relying on cookies) because the invite flow's session lives in the
 * plain localStorage-based client (lib/supabase.ts), not the cookie-based
 * one — this route needs to work for both.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { accessToken?: string };
  const accessToken = body.accessToken;

  if (!accessToken) {
    return NextResponse.json({ message: "Missing access token" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error: userError } = await admin.auth.getUser(accessToken);

  if (userError || !data.user) {
    return NextResponse.json({ message: "Invalid session" }, { status: 401 });
  }

  const { error } = await admin
    .from("profiles")
    .update({ status: "active" })
    .eq("user_id", data.user.id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
