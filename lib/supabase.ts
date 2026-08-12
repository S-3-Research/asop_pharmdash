import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Prefer the new publishable key (sb_publishable_...); fall back to the
// legacy anon JWT for projects that haven't migrated yet.
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          // Distinct storageKey from lib/supabase-browser.ts's
          // createBrowserClient. Both clients default to the same
          // `sb-<project-ref>-auth-token` key, which is also used as the
          // BroadcastChannel name GoTrue uses to sync auth state across
          // tabs/instances — sharing it causes "Multiple GoTrueClient
          // instances" warnings and can cross-wire onAuthStateChange
          // events between the two clients even though they use different
          // storage backends (localStorage here vs. cookies there).
          storageKey: "sb-implicit-auth-token",
        },
      })
    : null;
