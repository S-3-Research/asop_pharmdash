/**
 * Browser-side Supabase client that shares its auth storage (including the
 * PKCE `code_verifier`) via cookies with the server-side client in
 * lib/supabase-server.ts, instead of using localStorage like the plain
 * `createClient()` in lib/supabase.ts.
 *
 * This matters specifically for the forgot-password flow: a Route Handler
 * (server) calls `resetPasswordForEmail` in
 * app/api/auth/forgot-password/route.ts, which writes the PKCE
 * code_verifier to a cookie on that response. When the user later clicks
 * the emailed link and lands on /auth/set-password?code=..., this client's
 * default `detectSessionInUrl: true` behavior automatically reads that
 * cookie and exchanges the code for a session — no manual
 * `exchangeCodeForSession` call needed.
 *
 * NOTE: This client always runs in `flowType: "pkce"` (hardcoded by
 * @supabase/ssr, not overridable) and will reject implicit/hash-fragment
 * callbacks (e.g. Supabase's invite-email links, which use
 * `#access_token=...`, not `?code=...`). Use `lib/supabase.ts` for those.
 */

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseBrowser =
  supabaseUrl && supabasePublishableKey
    ? createBrowserClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          // Lets GoTrue embed the matching flow id in the PKCE callback
          // URL, so the SDK's automatic code exchange (detectSessionInUrl,
          // default true) can find the right verifier cookie even if more
          // than one PKCE flow is pending in this browser.
          experimental: { appendPkceFlowIdToRedirects: true },
        },
      })
    : null;
