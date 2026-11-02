import { NextResponse } from "next/server";

import { authError, requireRole } from "@/app/api/admin/_auth";
import { readAuditLog } from "@/lib/releases";

export async function GET() {
  const auth = await requireRole("admin");
  if (!auth.ok) {
    return authError(auth);
  }

  const entries = await readAuditLog();
  // Newest first.
  return NextResponse.json({ entries: entries.slice().reverse() });
}
