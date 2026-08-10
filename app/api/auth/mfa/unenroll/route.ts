import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

type UnenrollBody = {
  factorId?: string;
};

/**
 * Removes a TOTP factor (disables 2FA for that factor). Requires an aal2
 * session (i.e. the user must have already completed an MFA challenge in
 * the current session) — Supabase enforces this server-side.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as UnenrollBody;

  if (!body.factorId) {
    return NextResponse.json({ message: "factorId is required" }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId: body.factorId });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
