import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as LoginBody;

  if (!body.email || !body.password) {
    return NextResponse.json(
      { message: "Please enter your email and password" },
      { status: 400 },
    );
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });

  if (error || !data.session) {
    return NextResponse.json(
      { message: "Invalid email or password" },
      { status: 401 },
    );
  }

  // Password was correct, but if this user has an enrolled TOTP factor the
  // session is only "aal1" (partial) until a second factor is verified.
  // Tell the client to prompt for a code instead of treating login as done.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const factorId = factorsData?.totp?.[0]?.id;
    return NextResponse.json({ ok: true, mfaRequired: true, factorId });
  }

  // Supabase's SSR client already wrote the session cookies as a side
  // effect of `signInWithPassword` above (see lib/supabase-server.ts).
  return NextResponse.json({ ok: true, mfaRequired: false });
}
