import "server-only";

import type { ChannelName } from "@/lib/releases";

/**
 * Decides which data channel ("preview" | "production") the running app
 * instance should read from.
 *
 * This is intentionally decoupled from Vercel's deployment environment —
 * "preview"/"production" here refer to the PharmDash *data* channels
 * (channels/preview.json vs channels/production.json in Supabase Storage),
 * not which Vercel environment is serving the request. The two happen to
 * line up by default, but can be overridden independently.
 *
 * Resolution order:
 *   1. `PHARMDASH_CHANNEL` env var — explicit override. Use this to test
 *      the "production" data channel from a local `npm run dev` session,
 *      or to pin a specific Vercel deployment to a channel regardless of
 *      whether Vercel considers it a Preview or Production deployment.
 *   2. `VERCEL_ENV` — Vercel sets this automatically:
 *        "production" -> production channel
 *        "preview" | "development" -> preview channel
 *   3. Fallback: "preview" (safe default for local dev with no env vars
 *      set at all — you never accidentally read/write production data
 *      just by running `npm run dev`).
 */
export function getActiveChannel(): ChannelName {
  const override = process.env.PHARMDASH_CHANNEL;
  if (override === "preview" || override === "production") {
    return override;
  }

  if (process.env.VERCEL_ENV === "production") {
    return "production";
  }

  return "preview";
}
