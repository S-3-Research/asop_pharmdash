import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Starts TOTP enrollment for the logged-in user. Returns a QR code (SVG),
 * the plaintext secret (for manual entry), and a factorId. The factor is
 * created in an "unverified" state — the user must call
 * POST /api/auth/mfa/verify with a code from their authenticator app to
 * activate it (see app/api/auth/mfa/verify/route.ts).
 */
export async function POST() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `pharmdash-${Date.now()}`,
  });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  return NextResponse.json({
    factorId: data.id,
    qrCodeSvg: data.totp.qr_code,
    secret: data.totp.secret,
  });
}
