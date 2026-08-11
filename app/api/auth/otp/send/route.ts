import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

type SendBody = {
  email?: string;
};

/**
 * POST /api/auth/otp/send
 *   body: { email: string }
 *   -> sends a 6-digit one-time code to the given email via Supabase Auth
 *      (`shouldCreateUser: false` so this can't be used to sign up brand
 *      new accounts — only existing invited/active users can use
 *      passwordless login). Always returns 200 regardless of whether the
 *      email exists, to avoid leaking which emails have accounts.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as SendBody;
  const email = body.email?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ message: "A valid email is required" }, { status: 400 });
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
