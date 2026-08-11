import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

type VerifyBody = {
  email?: string;
  code?: string;
};

/**
 * POST /api/auth/otp/verify
 *   body: { email: string, code: string }
 *   -> verifies the 6-digit email OTP and, on success, persists a session
 *      cookie (same as password login). If the account has an enrolled
 *      TOTP factor, the resulting session is only "aal1" until that second
 *      factor is also verified — mirrors the password-login flow in
 *      /api/auth/login, so the client should follow up with
 *      /api/auth/mfa/verify when `mfaRequired` is true.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as VerifyBody;
  const email = body.email?.trim().toLowerCase();

  if (!email || !body.code) {
    return NextResponse.json({ message: "Email and code are required" }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: body.code,
    type: "email",
  });

  if (error || !data.session) {
    return NextResponse.json({ message: "Invalid or expired code" }, { status: 401 });
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const factorId = factorsData?.totp?.[0]?.id;
    return NextResponse.json({ ok: true, mfaRequired: true, factorId });
  }

  return NextResponse.json({ ok: true, mfaRequired: false });
}
