/**
 * Release / channel management for the PharmDash data-publishing pipeline.
 *
 * Storage layout (Supabase Storage, bucket = DATA_BUCKET):
 *
 *   releases/{reportPeriod}-v{n}/data.json.gz
 *   releases/{reportPeriod}-v{n}/manifest.json
 *   channels/preview.json
 *   channels/production.json
 *   audit/log.jsonl
 *
 * Design notes:
 * - Release payloads are immutable once written, so they are safe to cache
 *   indefinitely (keyed by releaseId) via `unstable_cache`.
 * - Channel pointers (`channels/*.json`) are tiny (KB-scale) and change
 *   infrequently but must reflect Promote/Rollback immediately, so they are
 *   read directly from Storage on every call — no caching layer needed.
 * - Promote and Rollback are the same operation: point a channel at a given
 *   releaseId, shifting the old `current` into `previous`.
 */

import "server-only";
import { unstable_cache } from "next/cache";
import { gzip, ungzip } from "pako";

import { getSupabaseAdmin, DATA_BUCKET } from "@/lib/supabase-admin";
import {
  PharmDashReleaseDataSchema,
  type PharmDashReleaseData,
} from "@/lib/schemas/pharmdash";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChannelName = "preview" | "production";

export interface ChannelRef {
  releaseId: string;
  reportPeriod: string;
  promotedAt: string;
}

export interface ChannelPointer {
  current: ChannelRef | null;
  previous: ChannelRef | null;
}

export interface ReleaseManifest {
  releaseId: string;
  reportPeriod: string;
  schemaVersion: string;
  generatedAt: string;
  recordCounts: {
    domains: number;
    socialMedia: number;
    socialMediaSummary: number;
  };
}

export interface AuditLogEntry {
  time: string;
  actor: string;
  action: "upload" | "publish_preview" | "promote_production" | "rollback";
  releaseId: string;
  channel?: ChannelName;
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Built-in mock release
// ---------------------------------------------------------------------------

/**
 * A fixed, always-available pseudo-release backed by the in-repo mock data
 * (app/dashboard/components/mock-data.ts) instead of a Storage payload.
 * It can be published to preview/production like any real release; data
 * routes detect it via `isMockRelease` and serve mock data directly.
 */
export const MOCK_RELEASE_ID = "mock-data";

export function isMockRelease(releaseId: string | null | undefined): boolean {
  return releaseId === MOCK_RELEASE_ID;
}

export const MOCK_RELEASE_MANIFEST: ReleaseManifest = {
  releaseId: MOCK_RELEASE_ID,
  reportPeriod: "mock-data",
  schemaVersion: "mock",
  generatedAt: "2020-01-01T00:00:00.000Z",
  recordCounts: { domains: 0, socialMedia: 0, socialMediaSummary: 0 },
};

// ---------------------------------------------------------------------------
// Low-level Storage helpers
// ---------------------------------------------------------------------------

async function downloadJson<T>(path: string): Promise<T | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(DATA_BUCKET).download(path);

  if (error) {
    // "Object not found" is expected for a channel that hasn't been
    // published yet — treat as absent rather than throwing.
    if ("statusCode" in error && String((error as { statusCode?: unknown }).statusCode) === "404") {
      return null;
    }
    if (error.message?.toLowerCase().includes("not found")) {
      return null;
    }
    throw new Error(`Failed to download ${path}: ${error.message}`);
  }

  const text = await data.text();
  return JSON.parse(text) as T;
}

async function uploadJson(path: string, value: unknown): Promise<void> {
  const supabase = getSupabaseAdmin();
  const body = JSON.stringify(value, null, 2);
  const { error } = await supabase.storage
    .from(DATA_BUCKET)
    .upload(path, new Blob([body], { type: "application/json" }), {
      upsert: true,
      contentType: "application/json",
    });

  if (error) {
    throw new Error(`Failed to upload ${path}: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Channel pointers (Preview / Production)
// ---------------------------------------------------------------------------

function channelPath(channel: ChannelName): string {
  return `channels/${channel}.json`;
}

/** Always reads live from Storage — never cached. */
export async function readChannel(channel: ChannelName): Promise<ChannelPointer> {
  const pointer = await downloadJson<ChannelPointer>(channelPath(channel));
  return pointer ?? { current: null, previous: null };
}

/**
 * Points `channel` at `releaseId`, shifting the previous `current` into
 * `previous`. Used for both Promote and Rollback — they are the same
 * operation, just choosing a different target releaseId.
 */
export async function setChannelRelease(
  channel: ChannelName,
  releaseId: string,
  actor: string,
): Promise<ChannelPointer> {
  const manifest = await getManifest(releaseId);
  if (!manifest) {
    throw new Error(`Cannot point ${channel} at unknown release "${releaseId}"`);
  }

  const existing = await readChannel(channel);
  const now = new Date().toISOString();

  const next: ChannelPointer = {
    current: {
      releaseId: manifest.releaseId,
      reportPeriod: manifest.reportPeriod,
      promotedAt: now,
    },
    previous: existing.current,
  };

  await uploadJson(channelPath(channel), next);

  await appendAuditLog({
    time: now,
    actor,
    action: channel === "production" ? "promote_production" : "publish_preview",
    releaseId,
    channel,
  });

  return next;
}

// ---------------------------------------------------------------------------
// Releases (immutable payload + manifest)
// ---------------------------------------------------------------------------

function releasePrefix(releaseId: string): string {
  return `releases/${releaseId}`;
}

export async function getManifest(releaseId: string): Promise<ReleaseManifest | null> {
  if (isMockRelease(releaseId)) return MOCK_RELEASE_MANIFEST;
  return downloadJson<ReleaseManifest>(`${releasePrefix(releaseId)}/manifest.json`);
}

/**
 * Lists all known releases (newest first by generatedAt), by reading the
 * `releases/` prefix and fetching each manifest. Fine for the expected
 * scale (KB-sized payloads, a handful of releases per report period).
 */
export async function listReleases(): Promise<ReleaseManifest[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(DATA_BUCKET).list("releases");

  if (error || !data) return [];

  // `list("releases")` returns one pseudo-folder entry per releaseId
  // (Supabase represents these with `id: null` since they aren't real
  // objects, just prefix groupings). Real files like manifest.json live
  // one level deeper and are fetched individually below, so we don't
  // need to filter here — any entry that isn't a valid release folder
  // will simply fail to resolve a manifest and get dropped afterwards.
  const manifests = await Promise.all(data.map((entry) => getManifest(entry.name)));

  const real = manifests
    .filter((m): m is ReleaseManifest => m !== null)
    .filter((m) => !isMockRelease(m.releaseId))
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));

  // The built-in mock release is always listed (last), so it can be
  // published to preview/production from the admin UI at any time.
  return [...real, MOCK_RELEASE_MANIFEST];
}

/**
 * Uploads a new immutable release: gzip-compressed data payload + manifest.
 * Does NOT publish it to any channel — call `setChannelRelease` separately.
 */
export async function createRelease(params: {
  releaseId: string;
  reportPeriod: string;
  schemaVersion: string;
  data: PharmDashReleaseData;
  actor: string;
}): Promise<ReleaseManifest> {
  const { releaseId, reportPeriod, schemaVersion, data, actor } = params;

  const existing = await getManifest(releaseId);
  if (existing) {
    throw new Error(
      `Release "${releaseId}" already exists — releases are immutable. Use a new version suffix.`,
    );
  }

  const manifest: ReleaseManifest = {
    releaseId,
    reportPeriod,
    schemaVersion,
    generatedAt: new Date().toISOString(),
    recordCounts: {
      domains: data.domains.length,
      socialMedia: data.social_media.length,
      socialMediaSummary: data.social_media_summary.length,
    },
  };

  const supabase = getSupabaseAdmin();
  const json = JSON.stringify(data);
  const gzipped = gzip(json);

  const { error: dataError } = await supabase.storage
    .from(DATA_BUCKET)
    .upload(`${releasePrefix(releaseId)}/data.json.gz`, gzipped, {
      upsert: false,
      contentType: "application/gzip",
    });
  if (dataError) {
    throw new Error(`Failed to upload release data: ${dataError.message}`);
  }

  await uploadJson(`${releasePrefix(releaseId)}/manifest.json`, manifest);

  await appendAuditLog({
    time: manifest.generatedAt,
    actor,
    action: "upload",
    releaseId,
    details: { recordCounts: manifest.recordCounts },
  });

  return manifest;
}

/**
 * Fetches and validates a release's data payload. Immutable per releaseId,
 * so cached indefinitely with no revalidation/tags required.
 */
export const fetchReleaseData = unstable_cache(
  async (releaseId: string): Promise<PharmDashReleaseData> => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(DATA_BUCKET)
      .download(`${releasePrefix(releaseId)}/data.json.gz`);

    if (error || !data) {
      throw new Error(
        `Failed to download release "${releaseId}": ${error?.message ?? "not found"}`,
      );
    }

    const bytes = new Uint8Array(await data.arrayBuffer());
    const json = new TextDecoder().decode(ungzip(bytes));
    const parsed = PharmDashReleaseDataSchema.parse(JSON.parse(json));
    return parsed;
  },
  ["pharmdash-release-data"],
  { revalidate: false },
);

// ---------------------------------------------------------------------------
// Audit log (append-only JSONL)
// ---------------------------------------------------------------------------

const AUDIT_LOG_PATH = "audit/log.jsonl";

export async function appendAuditLog(entry: AuditLogEntry): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.storage.from(DATA_BUCKET).download(AUDIT_LOG_PATH);

  const existingText = existing ? await existing.text() : "";
  const nextText = existingText + JSON.stringify(entry) + "\n";

  const { error } = await supabase.storage
    .from(DATA_BUCKET)
    .upload(AUDIT_LOG_PATH, new Blob([nextText], { type: "application/x-ndjson" }), {
      upsert: true,
      contentType: "application/x-ndjson",
    });

  if (error) {
    // Audit logging failures should not silently disappear, but also
    // shouldn't block the primary operation that already succeeded.
    console.error("Failed to append audit log entry:", error.message);
  }
}

export async function readAuditLog(): Promise<AuditLogEntry[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(DATA_BUCKET).download(AUDIT_LOG_PATH);
  if (error || !data) return [];

  const text = await data.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AuditLogEntry);
}
