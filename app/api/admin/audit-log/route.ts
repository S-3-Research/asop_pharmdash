import { NextResponse } from "next/server";

import { requireRole } from "@/app/api/admin/_auth";
import { readAuditLog } from "@/lib/releases";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const entries = await readAuditLog();
  // Newest first.
  return NextResponse.json({ entries: entries.slice().reverse() });
}
