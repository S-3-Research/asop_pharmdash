import "server-only";

import type { ChannelName } from "@/lib/releases";

/**
 * Decides which data channel ("dev" | "preview" | "production") the running
 * app instance should read from.
 *
 * This is intentionally decoupled from Vercel's deployment environment —
 * "dev"/"preview"/"production" here refer to the PharmDash *data* channels
 * (channels/dev.json, channels/preview.json, channels/production.json in
 * Supabase Storage), not which Vercel environment is serving the request.
 *
 * Resolution order:
 *   1. `PHARMDASH_CHANNEL` env var — explicit override. Use this to test
 *      any specific data channel from a local `npm run dev` session, or to
 *      pin a specific Vercel deployment to a channel regardless of what
 *      its branch/environment would otherwise resolve to.
 *   2. `VERCEL_ENV` — Vercel sets this automatically:
 *        "production" -> production channel
 *        "preview" -> depends on the git branch (`VERCEL_GIT_COMMIT_REF`):
 *          - branch is literally "preview" -> preview channel (the one
 *            branch that gets real staging data, e.g. for client demos)
 *          - every other branch (feature branches, PR previews, etc.)
 *            -> dev channel (safe default so ad-hoc branch deployments
 *            never accidentally show staging/production data)
 *        unset (local `npm run dev`, no Vercel env at all) -> dev channel
 *   3. Fallback: "dev" (safe default for local dev with no env vars set at
 *      all — you never accidentally read/write preview or production data
 *      just by running `npm run dev`).
 */
export function getActiveChannel(): ChannelName {
  const override = process.env.PHARMDASH_CHANNEL;
  if (override === "dev" || override === "preview" || override === "production") {
    return override;
  }

  if (process.env.VERCEL_ENV === "production") {
    return "production";
  }

  if (process.env.VERCEL_ENV === "preview") {
    return process.env.VERCEL_GIT_COMMIT_REF === "preview" ? "preview" : "dev";
  }

  return "dev";
}

