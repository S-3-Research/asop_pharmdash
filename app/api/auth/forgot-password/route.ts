import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

type ForgotPasswordBody = {
  email?: string;
};

/**
 * POST /api/auth/forgot-password
 *   body: { email: string }
 *   -> sends a password-reset email via Supabase Auth
 *      (`resetPasswordForEmail`). The link lands on the same
 *      /auth/set-password page used for invites — that page already just
 *      requires a valid (aal1) session and lets the user pick a new
 *      password, which is exactly what a password reset needs too.
 *
 *      Always returns the same generic success response regardless of
 *      whether the email exists, to avoid leaking which emails have
 *      accounts (same pattern as /api/auth/otp/send).
 */
export async function POST(request: Request) {
  const body = (await request.json()) as ForgotPasswordBody;
  const email = body.email?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ message: "A valid email is required" }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();

  const redirectTo = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/set-password`
    : undefined;

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  // Don't reveal whether the email exists to the client, but log the real
  // error server-side (rate limits, SMTP issues, etc. would otherwise be
  // completely invisible since the client always sees a generic success).
  if (error) {
    console.error("[forgot-password] resetPasswordForEmail failed:", {
      email,
      status: error.status,
      message: error.message,
    });
  }

  return NextResponse.json({
    ok: true,
    message: "If an account exists for that email, a reset link has been sent.",
  });
}
