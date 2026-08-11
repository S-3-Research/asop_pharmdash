import { NextResponse } from "next/server";

import { requireRole } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type InviteBody = {
  email?: string;
  role?: "admin" | "viewer";
};

/**
 * GET /api/admin/users
 *   -> list all app users (from public.profiles, which mirrors auth.users)
 *
 * POST /api/admin/users
 *   body: { email: string, role?: "admin" | "viewer" }
 *   -> invites a brand-new user via Supabase Auth. This sends the user an
 *      email (using the project's "Invite user" template) with a one-time
 *      link that lands on /auth/set-password to choose their password.
 *      No password is ever set by an admin — the invited user always
 *      chooses their own.
 */
export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .select("user_id, email, role, status, invited_by, invited_at, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  // `last_sign_in_at` lives on auth.users, not public.profiles, and Supabase
  // doesn't expose auth.users to PostgREST — the only way to read it is via
  // the Admin API's listUsers(). Fetch all pages and merge by id so the
  // Users table can show a "Last login" column.
  const lastSignInByUserId = new Map<string, string | null>();
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data: pageData, error: listError } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (listError) break;
    for (const u of pageData.users) {
      lastSignInByUserId.set(u.id, u.last_sign_in_at ?? null);
    }
    if (pageData.users.length < perPage) break;
    page += 1;
  }

  const users = (data ?? []).map((row) => ({
    ...row,
    last_sign_in_at: lastSignInByUserId.get(row.user_id) ?? null,
  }));

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const auth = await requireRole("admin");
  if (!auth.ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as InviteBody;
  const email = body.email?.trim().toLowerCase();
  const role = body.role === "admin" ? "admin" : "viewer";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ message: "A valid email is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const redirectTo = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/set-password`
    : undefined;

  // `role` is stamped into user_metadata so the `handle_new_user` DB trigger
  // (see schema-reference/supabase_auth_profiles_invites.sql) can seed the
  // profiles row with the intended role instead of always defaulting to
  // 'viewer'.
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { role },
    redirectTo,
  });

  if (error) {
    // Supabase returns a 422 with this message when the email already
    // has an account — surface it distinctly for a nicer client-side hint.
    const alreadyExists = /already been registered|already exists/i.test(error.message);
    return NextResponse.json(
      { message: alreadyExists ? "This email is already registered" : error.message },
      { status: alreadyExists ? 409 : 400 },
    );
  }

  // Trigger already inserts the profiles row on auth.users insert, but the
  // trigger fires within the same transaction as the admin API call, so it
  // should already be visible here. We still patch `invited_by` (not
  // available to the trigger) after the fact.
  await admin
    .from("profiles")
    .update({ invited_by: auth.actor })
    .eq("user_id", data.user.id);

  return NextResponse.json({ ok: true, userId: data.user.id });
}
