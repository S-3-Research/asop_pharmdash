import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type LoginBody = {
  username?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as LoginBody;

  const expectedUsername = process.env.DASHBOARD_LOGIN_USERNAME ?? "admin";
  const expectedPassword = process.env.DASHBOARD_LOGIN_PASSWORD ?? "123456";

  if (
    body.username !== expectedUsername ||
    body.password !== expectedPassword
  ) {
    return NextResponse.json(
      { message: "用户名或密码错误" },
      { status: 401 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set("pharmdash_auth", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  // Non-sensitive username, kept for audit-log "actor" attribution only.
  cookieStore.set("pharmdash_user", expectedUsername, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  return NextResponse.json({ ok: true });
}
