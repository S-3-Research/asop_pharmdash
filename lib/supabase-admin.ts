/**
 * Server-only Supabase client using the Service Role key.
 *
 * This bypasses RLS and can read/write any Storage object, so it must
 * NEVER be imported from client components or exposed to the browser.
 * Only import this from Route Handlers / Server Actions under app/api/**.
 */

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Prefer the new secret key (sb_secret_...); fall back to the legacy
// service_role JWT for projects that haven't migrated yet.
const secretKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

let cachedClient: SupabaseClient | null = null;

/**
 * Lazily creates (and memoizes) the admin Supabase client.
 * Throws only when actually called without proper env vars configured,
 * so importing this module never crashes builds where the feature is
 * unused yet.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (cachedClient) return cachedClient;

  if (!supabaseUrl || !secretKey) {
    throw new Error(
      "Supabase admin client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or the legacy SUPABASE_SERVICE_ROLE_KEY).",
    );
  }

  cachedClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cachedClient;
}

export const DATA_BUCKET = process.env.SUPABASE_DATA_BUCKET || "pharmdash-data";
