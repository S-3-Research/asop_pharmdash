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
 *   indefinitely (keyed by releaseId) — via a plain in-process Map, NOT
 *   `unstable_cache`. Next's Data Cache rejects any entry over 2MB, and
 *   real release payloads (gzip decompressed) and even the per-post social
 *   index can easily exceed that at production scale, which made every
 *   request silently fail to cache and re-download/re-parse the full
 *   payload (10-20s+ per request, sometimes surfacing as a 500). A simple
 *   module-scoped Map has no such size limit and is exactly the semantics
 *   we want here: memoize immutable-per-releaseId data for the lifetime of
 *   the server process.
 * - Channel pointers (`channels/*.json`) are tiny (KB-scale) and change
 *   infrequently but must reflect Promote/Rollback immediately, so they are
 *   read directly from Storage on every call — no caching layer needed.
 * - Promote and Rollback are the same operation: point a channel at a given
 *   releaseId, shifting the old `current` into `previous`.
 */

import "server-only";
import { gzip, ungzip } from "pako";

import { getSupabaseAdmin, DATA_BUCKET } from "@/lib/supabase-admin";
import {
  PharmDashReleaseDataSchema,
  type PharmDashReleaseData,
} from "@/lib/schemas/pharmdash";
import {
  buildSocialIndex,
  buildSocialAggregateTable,
  mapReleaseDomainsToListings,
  mapReleaseSocialToListings,
  convertReportPeriod,
  type SocialPostLite,
  type SocialAggregateTable,
} from "@/lib/release-mapping";
import type { Listing } from "@/app/dashboard/components/types";

// ---------------------------------------------------------------------------
// In-memory memoization (NOT Next's `unstable_cache` — see header comment:
// its Data Cache rejects entries over 2MB, which real release payloads and
// social indexes routinely exceed). Keyed by an arbitrary cache-name +
// releaseId; lives for the lifetime of the server process/instance, which
// is fine since every entry here is immutable per releaseId.
// ---------------------------------------------------------------------------

function memoizeByKey<T>(fn: (key: string) => Promise<T>): (key: string) => Promise<T> {
  const cache = new Map<string, Promise<T>>();
  return (key: string) => {
    let entry = cache.get(key);
    if (!entry) {
      entry = fn(key).catch((err) => {
        // Don't poison the cache with a rejected promise — allow retry on
        // the next call (e.g. transient Storage/network failure).
        cache.delete(key);
        throw err;
      });
      cache.set(key, entry);
    }
    return entry;
  };
}

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
  /** Human-facing label shown to end users instead of the internal
   *  `reportPeriod` code (e.g. "2026-RPT-01"). Manually set by an admin via
   *  the Data Releases admin page (`setReleaseDisplayName`) — optional, so
   *  releases created before this field existed simply fall back to the
   *  formatted `reportPeriod` code wherever it's consumed. */
  displayName?: string;
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

// ---------------------------------------------------------------------------
// Shared "active release" resolution — every data API route (top-products,
// domains, social-media, keyword-count, ...) needs the same handful of
// facts about whatever release is currently published to a channel:
// whether it's the mock release, the internal reportingPeriodId code, and
// the admin-configured display name for that period. Centralizing this
// here means each route no longer has to hand-roll its own
// readChannel → getManifest → convertReportPeriod → fallback chain, and
// any future field added to that resolution (e.g. more manifest metadata)
// only needs to be threaded through once.
// ---------------------------------------------------------------------------

export interface ActiveReleaseContext {
  /** Raw channel pointer, in case a caller still needs `previous` etc. */
  pointer: ChannelPointer;
  /** True when no release is published, or the built-in mock release is —
   *  callers should serve mock data in either case. */
  isMock: boolean;
  /** Empty string when `isMock` is true. */
  releaseId: string;
  /** Internal reporting-period code, e.g. "2026-RPT-01". Empty string when
   *  `isMock` is true. Used for grouping/filtering data — never shown to
   *  end users directly. */
  reportingPeriodId: string;
  /** Admin-configured, end-user-facing label for `reportingPeriodId` (see
   *  `setReleaseDisplayName`) — falls back to a formatted version of the
   *  code itself when unset. Empty string when `isMock` is true. */
  reportingPeriodDisplayName: string;
  /** Full manifest for the active release, or null when `isMock` is true. */
  manifest: ReleaseManifest | null;
}

/** "2026-RPT-01" -> "2026 RPT-01" — same formatting used by the dashboard's
 *  `formatRptPeriodLabel` (app/dashboard/components/subpages/top-products/
 *  config.ts), duplicated here (server-only lib) to avoid a cross-boundary
 *  import; both must be kept in sync if the label format ever changes. */
function formatReportingPeriodId(id: string): string {
  return id.replace("-", " ");
}

/**
 * Resolves everything a data API route needs to know about the release
 * currently published to `channel`, in one call — see `ActiveReleaseContext`.
 */
export async function getActiveReleaseContext(channel: ChannelName): Promise<ActiveReleaseContext> {
  const pointer = await readChannel(channel);

  if (!pointer.current || isMockRelease(pointer.current.releaseId)) {
    return {
      pointer,
      isMock: true,
      releaseId: "",
      reportingPeriodId: "",
      reportingPeriodDisplayName: "",
      manifest: null,
    };
  }

  const reportingPeriodId = convertReportPeriod(pointer.current.reportPeriod);
  const manifest = await getManifest(pointer.current.releaseId);
  const reportingPeriodDisplayName =
    manifest?.displayName || formatReportingPeriodId(reportingPeriodId);

  return {
    pointer,
    isMock: false,
    releaseId: pointer.current.releaseId,
    reportingPeriodId,
    reportingPeriodDisplayName,
    manifest,
  };
}

/**
 * Builds a map of every known release's internal reportingPeriodId code to
 * its display name (admin-configured `displayName`, falling back to the
 * formatted code) — used wherever multiple reporting periods must be
 * labeled at once (e.g. a multi-period trend chart's axis/tooltip), unlike
 * `getActiveReleaseContext` which only resolves the single currently-active
 * one. When a reportPeriod has multiple release versions (v1, v2, ...), the
 * most-recently-generated one wins.
 */
export async function getReportPeriodDisplayMap(): Promise<Record<string, string>> {
  const releases = await listReleases();
  const map: Record<string, string> = {};
  // `listReleases` is already sorted newest-first by generatedAt, and the
  // mock release is always last — so the first manifest seen per
  // reportingPeriodId is the most recent one; skip the mock entry (it has
  // no meaningful reportPeriod of its own).
  for (const m of releases) {
    if (isMockRelease(m.releaseId)) continue;
    const id = convertReportPeriod(m.reportPeriod);
    if (id in map) continue;
    map[id] = m.displayName || formatReportingPeriodId(id);
  }
  return map;
}

/**
 * Sets (or clears, via `displayName: null`) the admin-configured, end-user-
 * facing display name for a release's reporting period — e.g. showing
 * "Q1 2026" instead of the internal "2026-RPT-01" code everywhere the
 * dashboard surfaces that release's reporting period label.
 */
export async function setReleaseDisplayName(
  releaseId: string,
  displayName: string | null,
): Promise<ReleaseManifest> {
  if (isMockRelease(releaseId)) {
    throw new Error("Cannot set a display name on the built-in mock release");
  }
  const manifest = await getManifest(releaseId);
  if (!manifest) {
    throw new Error(`Release "${releaseId}" not found`);
  }
  const next: ReleaseManifest = {
    ...manifest,
    displayName: displayName?.trim() ? displayName.trim() : undefined,
  };
  await uploadJson(`${releasePrefix(releaseId)}/manifest.json`, next);
  return next;
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
      socialMediaSummary: data.keyword_stats.length,
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

  // Precompute the social-media aggregation table (every single-category x
  // single-platform combination) ONCE here at upload time, so the dashboard
  // never has to scan social_media rows on a live request — see
  // lib/release-mapping.ts `buildSocialAggregateTable` for what's covered
  // (and what falls back to on-demand filtering: multi-category selections).
  const socialIndex = buildSocialIndex(data.social_media);
  const aggregateTable = buildSocialAggregateTable(socialIndex, data.keyword_stats);
  await uploadJson(`${releasePrefix(releaseId)}/social-aggregates.json`, aggregateTable);

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
 * so memoized indefinitely (in-process) with no revalidation needed.
 */
export const fetchReleaseData = memoizeByKey(
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
);

/**
 * Builds (and memoizes, per releaseId) the lightweight per-post social-media
 * index used by the aggregation and samples-listing API routes — everything
 * needed for filtering/sorting/counting EXCEPT each post's `text` field, so
 * neither route has to map or transfer the full text of every row (100k+ at
 * real-world release sizes) just to compute platform tabs, metrics, or
 * paginate a sample list. See lib/release-mapping.ts `buildSocialIndex`.
 */
export const fetchSocialIndex = memoizeByKey(
  async (releaseId: string): Promise<SocialPostLite[]> => {
    const release = await fetchReleaseData(releaseId);
    return buildSocialIndex(release.social_media);
  },
);

/**
 * Loads the release's precomputed social-media aggregate table (every
 * single-category x single-platform combination — see lib/release-mapping.ts
 * `buildSocialAggregateTable`), written to Storage once at upload time by
 * `createRelease`. Memoized indefinitely (in-process) per releaseId, same as
 * the release data itself.
 *
 * Falls back to computing it on demand for releases uploaded before this
 * precomputation existed (the file will simply be missing in Storage).
 */
export const fetchSocialAggregateTable = memoizeByKey(
  async (releaseId: string): Promise<SocialAggregateTable> => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(DATA_BUCKET)
      .download(`${releasePrefix(releaseId)}/social-aggregates.json`);

    if (!error && data) {
      const text = await data.text();
      return JSON.parse(text) as SocialAggregateTable;
    }

    // Pre-existing release without a precomputed table — build it once here
    // (still memoized per releaseId afterwards, just paid on first access
    // instead of at upload time).
    const [release, index] = await Promise.all([fetchReleaseData(releaseId), fetchSocialIndex(releaseId)]);
    return buildSocialAggregateTable(index, release.keyword_stats);
  },
);

/**
 * Builds (and memoizes, per releaseId) the combined Top Products listings:
 * one Listing per domain product (source: "online") plus one Listing per
 * social_media[] row/matched-category (source: "social") — so the Social vs
 * Online stats reflect actual social signal volume, not merely whether a
 * domain happens to have a linked social profile. See
 * lib/release-mapping.ts `mapReleaseDomainsToListings` / `mapReleaseSocialToListings`.
 */
export const fetchTopProductsListings = memoizeByKey(
  async (releaseId: string): Promise<Listing[]> => {
    const release = await fetchReleaseData(releaseId);
    const manifest = await getManifest(releaseId);
    if (!manifest) {
      throw new Error(`Failed to load manifest for release "${releaseId}"`);
    }
    const reportPeriod = manifest.reportPeriod;
    return [
      ...mapReleaseDomainsToListings(release.domains, reportPeriod),
      ...mapReleaseSocialToListings(release.social_media, reportPeriod),
    ];
  },
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
