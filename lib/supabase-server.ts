/**
 * Server-only Supabase client bound to the current request's cookies.
 *
 * Uses the publishable/anon key (respects RLS) and Next.js's cookie store
 * so that `supabase.auth.getUser()` / `signInWithPassword()` / `signOut()`
 * read and write the Supabase session cookies automatically.
 *
 * Import this from Route Handlers, Server Components, and Server Actions
 * only (it depends on `next/headers`).
 */

import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function getSupabaseServerClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or the legacy NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `setAll` is called from a Server Component in some cases (e.g.
          // during middleware-driven session refresh); cookies can't be
          // mutated there. Safe to ignore as long as middleware.ts also
          // refreshes the session on every request.
        }
      },
    },
  });
}
