import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { subPageDataMap } from "@/app/dashboard/components/mock-data";

export async function GET() {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.get("pharmdash_auth")?.value === "1";

  if (!isAuthenticated) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { title, summary, categories, drillablePieData, listings } =
    subPageDataMap["top-products"];

  return NextResponse.json({
    title,
    summary,
    categories,
    drillablePieData,
    // Strip detectedAt — not used by the UI, avoids Date serialisation ambiguity
    listings: (listings ?? []).map(
      ({ id, source, primaryCategory, secondaryCategory, cbuId }) => ({
        id,
        source,
        primaryCategory,
        secondaryCategory,
        cbuId,
      }),
    ),
  });
}
