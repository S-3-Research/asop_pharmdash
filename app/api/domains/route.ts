import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { mockDomains } from "@/app/dashboard/components/mock-data";

export async function GET() {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.get("pharmdash_auth")?.value === "1";

  if (!isAuthenticated) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ domains: mockDomains });
}
