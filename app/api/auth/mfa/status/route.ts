import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Returns the current user's MFA enrollment status: which factors are
 * enrolled (verified) and whether the current session has completed the
 * MFA step (aal2) or still needs to (aal1 -> aal2 required).
 */
export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data: factorsData, error: factorsError } =
    await supabase.auth.mfa.listFactors();
  if (factorsError) {
    return NextResponse.json({ message: factorsError.message }, { status: 400 });
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  return NextResponse.json({
    factors: factorsData.totp,
    currentLevel: aal?.currentLevel ?? "aal1",
    nextLevel: aal?.nextLevel ?? "aal1",
  });
}
