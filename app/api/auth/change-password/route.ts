import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

type ChangePasswordBody = {
  currentPassword?: string;
  newPassword?: string;
  mfaCode?: string;
};

/**
 * Changes the logged-in user's password. Re-authenticates with the current
 * password first (Supabase's `updateUser` doesn't require it by default),
 * so a hijacked-but-not-fully-verified session can't silently change the
 * password without knowing the current one.
 *
 * Supabase requires an "aal2" session to update email/password when the
 * user has MFA enrolled — `signInWithPassword` alone only restores "aal1",
 * so for MFA users we also need a TOTP code to elevate the session before
 * calling `updateUser`. If no code was supplied yet, we tell the client to
 * prompt for one (mirrors the login flow in /api/auth/login).
 */
export async function POST(request: Request) {
  const body = (await request.json()) as ChangePasswordBody;

  if (!body.currentPassword || !body.newPassword) {
    return NextResponse.json(
      { message: "Please enter your current password and a new password" },
      { status: 400 },
    );
  }

  if (body.newPassword.length < 8) {
    return NextResponse.json(
      { message: "New password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: body.currentPassword,
  });
  if (reauthError) {
    return NextResponse.json({ message: "Current password is incorrect" }, { status: 401 });
  }

  // Re-authenticating above resets the session to aal1. If this user has
  // an enrolled TOTP factor, Supabase requires aal2 to update the password.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needsMfa = aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";

  if (needsMfa) {
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const factorId = factorsData?.totp?.[0]?.id;

    if (!body.mfaCode) {
      return NextResponse.json({ ok: true, mfaRequired: true, factorId });
    }

    if (!factorId) {
      return NextResponse.json(
        { message: "No MFA factor found for this account" },
        { status: 400 },
      );
    }

    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      return NextResponse.json(
        { message: challengeError?.message ?? "Could not start MFA challenge" },
        { status: 400 },
      );
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: body.mfaCode,
    });
    if (verifyError) {
      return NextResponse.json({ message: "Invalid or expired code" }, { status: 401 });
    }
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: body.newPassword,
  });
  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, mfaRequired: false });
}
