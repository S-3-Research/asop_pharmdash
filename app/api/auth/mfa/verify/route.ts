import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

type VerifyBody = {
  factorId?: string;
  code?: string;
};

/**
 * Verifies a 6-digit TOTP code against a factor. Used for two purposes:
 *  1. Completing enrollment (activates a freshly-enrolled factor).
 *  2. Completing the second login step for a factor that's already
 *     verified (elevates the session from aal1 to aal2).
 * In both cases, on success this elevates the current session to aal2 and
 * the SSR client persists the updated session cookie automatically.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as VerifyBody;

  if (!body.factorId || !body.code) {
    return NextResponse.json(
      { message: "factorId and code are required" },
      { status: 400 },
    );
  }

  const supabase = await getSupabaseServerClient();

  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId: body.factorId });
  if (challengeError || !challenge) {
    return NextResponse.json(
      { message: challengeError?.message ?? "Could not start challenge" },
      { status: 400 },
    );
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: body.factorId,
    challengeId: challenge.id,
    code: body.code,
  });

  if (verifyError) {
    return NextResponse.json({ message: "验证码不正确或已过期" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
