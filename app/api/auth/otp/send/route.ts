import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type SendBody = {
  email?: string;
};

/**
 * POST /api/auth/otp/send
 *   body: { email: string }
 *   -> sends an 8-digit one-time code to the given email via Supabase Auth
 *      (`shouldCreateUser: false` so this can't be used to sign up brand
 *      new accounts — only existing invited/active users can use
 *      passwordless login). Always returns 200 regardless of whether the
 *      email exists, to avoid leaking which emails have accounts.
 *
 *      EXCEPTION: accounts still in `profiles.status === 'invited'` (i.e.
 *      never finished /auth/set-password) are blocked here with an
 *      explicit message instead of sending a code. Reason: for these
 *      accounts, Supabase's OTP email is actually the "Confirm signup"
 *      template (GoTrue treats first-ever email confirmation and OTP
 *      login as the same underlying token type for an unconfirmed user),
 *      which only shows a confirmation link, not always the code the UI
 *      asks the user to type — and even where it does, completing it
 *      never sets a real password (auth.users still has the random
 *      placeholder password GoTrue wrote at invite time). Letting that
 *      happen would let an invited user "back into" a working session
 *      without ever setting a password, silently bypassing the intended
 *      invite completion step. Forcing them through the real invite link
 *      first (email/set-password) ensures every account has an actual
 *      user-chosen password before it can be used at all.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as SendBody;
  const email = body.email?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ message: "A valid email is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("status")
    .eq("email", email)
    .maybeSingle();

  if (profile?.status === "invited") {
    return NextResponse.json(
      {
        message:
          "This account hasn't finished setup yet. Please use the invite link in your email to set a password first.",
      },
      { status: 403 },
    );
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  // Don't reveal whether the email exists to the client, but always log the
  // real error server-side (rate limits, SMTP misconfiguration, etc. are
  // otherwise completely invisible since the client always sees `ok: true`).
  if (error) {
    console.error("[otp/send] signInWithOtp failed:", {
      email,
      status: error.status,
      message: error.message,
    });
  }

  if (error && error.status && error.status >= 500) {
    return NextResponse.json({ message: "Could not send code, please try again" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
