import { NextResponse } from "next/server";

import { authError, requireAnyRole } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type InviteBody = {
  email?: string;
  accessDays?: 7 | 30 | null;
  role?: "admin" | "manager" | "viewer";
};

/**
 * GET /api/admin/users
 *   -> list app users (from public.profiles, which mirrors auth.users).
 *      Admins see everyone. Managers only see the viewers *they*
 *      personally invited (matched by `invited_by = <manager's email>`
 *      and `role = 'viewer'`) — never other managers, admins, or
 *      viewers invited by someone else.
 *
 * POST /api/admin/users
 *   body: { email: string, role?: "admin" | "manager" | "viewer" }
 *   -> invites a brand-new user via Supabase Auth. This sends the user an
 *      email (using the project's "Invite user" template) with a one-time
 *      link that lands on /auth/set-password to choose their password.
 *      No password is ever set by an admin — the invited user always
 *      chooses their own.
 *      Managers may only invite `viewer`s, capped by their own
 *      `invite_quota` (default 5, counted as viewers they've invited so
 *      far, regardless of that viewer's current status).
 */
export async function GET() {
  const auth = await requireAnyRole(["admin", "manager"]);
  if (!auth.ok) {
    return authError(auth);
  }

  const admin = getSupabaseAdmin();
  let query = admin
    .from("profiles")
    .select("user_id, email, role, status, invited_by, invited_at, created_at, invite_quota, access_expires_at, access_setup_pending")
    .order("created_at", { ascending: false });

  // Managers only get their own invited viewers, not the full roster.
  if (auth.role === "manager") {
    query = query.eq("invited_by", auth.actor).eq("role", "viewer");
  }

  const { data, error } = await query;

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

  // Managers also need to know their remaining quota to render the invite
  // form correctly (disable it once exhausted).
  let inviteQuota: number | null = null;
  let inviteQuotaUsed: number | null = null;
  if (auth.role === "manager") {
    const { data: managerProfile } = await admin
      .from("profiles")
      .select("invite_quota")
      .eq("email", auth.actor)
      .maybeSingle();
    inviteQuota = managerProfile?.invite_quota ?? 5;
    inviteQuotaUsed = users.length;
  }

  return NextResponse.json({ users, inviteQuota, inviteQuotaUsed });
}

export async function POST(request: Request) {
  const auth = await requireAnyRole(["admin", "manager"]);
  if (!auth.ok) {
    return authError(auth);
  }

  const parsed: unknown = await request.json().catch(() => null);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }
  const body = parsed as InviteBody;
  if (body.accessDays !== undefined && process.env.ACCOUNT_EXPIRY_MANAGEMENT_ENABLED !== "true") {
    return NextResponse.json({ message: "Expiry management is not enabled" }, { status: 503 });
  }
  if (body.accessDays !== undefined && body.accessDays !== null && body.accessDays !== 7 && body.accessDays !== 30) {
    return NextResponse.json({ message: "Invalid duration" }, { status: 400 });
  }
  if (auth.role === "manager" && body.accessDays === null) {
    return NextResponse.json({ message: "Only admins can select unlimited access" }, { status: 403 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  // Managers can only ever invite plain viewers, regardless of what the
  // client sent — never trust the client for privilege escalation.
  const role: "admin" | "manager" | "viewer" =
    auth.role === "manager"
      ? "viewer"
      : body.role === "admin" || body.role === "manager"
        ? body.role
        : "viewer";

  if (role === "admin" && body.accessDays != null) {
    return NextResponse.json({ message: "Admin accounts do not expire" }, { status: 400 });
  }
  if (body.accessDays != null && auth.role === "manager") {
    const { data: actorProfile, error } = await getSupabaseAdmin().from("profiles")
      .select("access_expires_at").eq("user_id", auth.userId).single();
    if (error || (actorProfile.access_expires_at && Date.now() + body.accessDays * 86400000 > Date.parse(actorProfile.access_expires_at))) {
      return NextResponse.json({ message: "Duration exceeds your own access deadline" }, { status: 400 });
    }
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ message: "A valid email is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  if (auth.role === "manager") {
    const { data: managerProfile } = await admin
      .from("profiles")
      .select("invite_quota")
      .eq("email", auth.actor)
      .maybeSingle();
    const quota = managerProfile?.invite_quota ?? 5;

    const { count } = await admin
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("invited_by", auth.actor)
      .eq("role", "viewer");

    if ((count ?? 0) >= quota) {
      return NextResponse.json(
        { message: `Invite quota reached (${quota} viewers max)` },
        { status: 403 },
      );
    }
  }

  const redirectTo = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/set-password`
    : undefined;

  // `role` is stamped into user_metadata so the `handle_new_user` DB trigger
  // (see schema-reference/supabase_auth_profiles_invites.sql) can seed the
  // profiles row with the intended role instead of always defaulting to
  // 'viewer'.
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { role, access_setup_required: true },
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
  const { error: ownershipError } = await admin
    .from("profiles")
    .update({ invited_by: auth.actor })
    .eq("user_id", data.user.id);

  if (ownershipError) {
    return NextResponse.json({ message: "Invite created but setup failed. Account access is blocked; delete and re-invite.", userId: data.user.id }, { status: 500 });
  }
  const { error: expiryError } = await admin.rpc("change_account_access", {
    p_actor: auth.userId, p_target: data.user.id, p_action: "initialize",
    p_days: body.accessDays ?? null, p_request_id: crypto.randomUUID(),
  });
  if (expiryError) {
    return NextResponse.json({ message: "Invite created but expiry setup failed. Account access is blocked; delete and re-invite.", userId: data.user.id }, { status: 500 });
  }
  return NextResponse.json({ ok: true, userId: data.user.id });
}
