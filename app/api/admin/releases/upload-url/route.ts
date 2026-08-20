import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { requireRole } from "@/app/api/admin/_auth";
import { getSupabaseAdmin, DATA_BUCKET } from "@/lib/supabase-admin";

/**
 * POST /api/admin/releases/upload-url
 *
 * Issues a short-lived signed upload URL/token for a temp object under
 * `uploads/`, so the browser can PUT the (gzip-compressed) release payload
 * directly to Supabase Storage — bypassing Vercel's hard 4.5MB serverless-
 * function request body limit entirely (that limit only applies to
 * requests that go through a Vercel Function; browser -> Supabase Storage
 * does not). The main POST /api/admin/releases route then downloads the
 * object server-side (Supabase -> our function, not subject to the same
 * limit) using the returned `path`, and deletes it once read.
 */
export async function POST() {
  const auth = await requireRole("admin");
  if (!auth.ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const path = `uploads/${randomUUID()}.json.gz`;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(DATA_BUCKET).createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { message: error?.message ?? "Failed to create upload URL" },
      { status: 500 },
    );
  }

  // Return the bucket name we actually used (rather than having the client
  // maintain its own separate NEXT_PUBLIC_* copy of this value) — the
  // signed token's signature is bound to a specific bucket+path pair, so
  // any drift between a client-side bucket constant and this server-side
  // one causes Supabase Storage to reject the upload with "Invalid
  // signature" even though the token itself is otherwise valid.
  return NextResponse.json({ path: data.path, token: data.token, bucket: DATA_BUCKET });
}
