"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Check, X, Download as DownloadIcon, FlaskConical, Eye, Rocket } from "lucide-react";

import { LogoNav } from "@/app/dashboard/components/logo-nav";
import { supabaseBrowser } from "@/lib/supabase-browser";

// Stay safely under Vercel's hard 4.5MB serverless-function request body
// limit — payloads at or above this (post-gzip) size go via the direct-to-
// Supabase-Storage signed-upload path instead of straight through the
// function body. See `handleUpload` below and
// app/api/admin/releases/upload-url/route.ts.
const DIRECT_UPLOAD_THRESHOLD_BYTES = 3.5 * 1024 * 1024;

/**
 * Gzip-compresses a JSON-serializable value in the browser before upload.
 * Real release payloads (100k+ social_media rows) can exceed Vercel's
 * hard 4.5MB serverless-function request body limit when sent as raw JSON
 * (FUNCTION_PAYLOAD_TOO_LARGE). Gzip typically shrinks these payloads by
 * ~75-80%, so compressing client-side keeps uploads under that ceiling
 * without needing multi-part/chunked upload plumbing. Uses the standard
 * CompressionStream API (supported in all evergreen browsers).
 */
async function gzipJson(value: unknown): Promise<Blob> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob();
}

type ChannelRef = { releaseId: string; reportPeriod: string; promotedAt: string };
type ChannelPointer = { current: ChannelRef | null; previous: ChannelRef | null };

type ReleaseManifest = {
  releaseId: string;
  reportPeriod: string;
  schemaVersion: string;
  generatedAt: string;
  recordCounts: { domains: number; socialMedia: number; socialMediaSummary: number };
  /** Admin-configured, end-user-facing label for this release's reporting
   *  period (e.g. "Q1 2026") — shown across the dashboard instead of the
   *  internal reportPeriod code. Optional; falls back to the formatted
   *  code when unset. */
  displayName?: string;
};

type ValidationIssue = { level: "error" | "warning"; code: string; message: string; path?: string };
type ValidationReport = {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  issues: ValidationIssue[];
};

type AuditEntry = {
  time: string;
  actor: string;
  action: string;
  releaseId: string;
  channel?: string;
  details?: Record<string, unknown>;
};

export default function DataReleasesClient() {
  const [releases, setReleases] = useState<ReleaseManifest[]>([]);
  const [channels, setChannels] = useState<{ dev: ChannelPointer; preview: ChannelPointer; production: ChannelPointer } | null>(
    null,
  );
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();
  const YEAR_OPTIONS = [currentYear - 1, currentYear, currentYear + 1];
  const RPT_OPTIONS = ["01", "02", "03", "04"] as const;

  const [reportYear, setReportYear] = useState<number>(currentYear);
  const [reportRptNum, setReportRptNum] = useState<string>("01");
  // Canonical, dashboard-matching release name — e.g. "2026-RPT-03". This is
  // the single source of truth used both as the release's reportPeriod and
  // (unchanged) as the reportingPeriodId shown on every dashboard card.
  const reportPeriod = `${reportYear}-RPT-${reportRptNum}`;
  const [schemaVersion, setSchemaVersion] = useState("1");
  const [jsonText, setJsonText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [schemaErrors, setSchemaErrors] = useState<{ path: string; message: string }[] | null>(
    null,
  );

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  // Draft display-name text per releaseId, keyed so each row's input is
  // independent and only diverges from the saved manifest value while the
  // admin is actively editing it.
  const [displayNameDrafts, setDisplayNameDrafts] = useState<Record<string, string>>({});
  const [savingDisplayNameId, setSavingDisplayNameId] = useState<string | null>(null);
  // Which release row currently has its inline display-name editor open
  // (lives in the Actions column, toggled by the pencil icon button) — only
  // one row can be in edit mode at a time.
  const [editingDisplayNameId, setEditingDisplayNameId] = useState<string | null>(null);

  const saveDisplayName = async (releaseId: string) => {
    const draft = displayNameDrafts[releaseId] ?? "";
    setSavingDisplayNameId(releaseId);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/admin/releases/${encodeURIComponent(releaseId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: draft.trim() || null }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Failed to save display name");
      }
      const body = (await res.json()) as { manifest: ReleaseManifest };
      setReleases((prev) => prev.map((r) => (r.releaseId === releaseId ? body.manifest : r)));
      setActionMessage(`Display name updated for "${releaseId}".`);
      setEditingDisplayNameId(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save display name");
    } finally {
      setSavingDisplayNameId(null);
    }
  };
  const [fileName, setFileName] = useState<string | null>(null);
  // Lightweight summary shown in place of the file's raw content — the full
  // text is NEVER stored in React state (see `parsedFilePayloadRef` below).
  const [fileSizeBytes, setFileSizeBytes] = useState<number | null>(null);
  // Holds the already-parsed object for a file-based upload, so (a) the
  // potentially tens-of-MB raw text never has to sit in a controlled
  // <textarea>'s value (re-setting that on every unrelated re-render — e.g.
  // `submitting`/`validationReport` changing during upload — was causing the
  // sluggishness: browsers are slow to diff/reflow a huge textarea value on
  // every render), and (b) JSON.parse only runs ONCE per file instead of
  // once in handleFileChange (sanity check) and again in handleUpload.
  // A ref (not state) because the parsed object itself never needs to
  // trigger a re-render — only the lightweight fileName/fileSizeBytes
  // summary above does.
  const parsedFilePayloadRef = useRef<unknown>(null);

  const clearFile = () => {
    parsedFilePayloadRef.current = null;
    setFileName(null);
    setFileSizeBytes(null);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSubmitError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text); // parsed ONCE, reused directly on submit
      parsedFilePayloadRef.current = parsed;
      setJsonText(""); // switch out of "paste" mode — file takes precedence
      setFileName(file.name);
      setFileSizeBytes(file.size);
    } catch {
      setSubmitError(`File "${file.name}" is not valid JSON.`);
      clearFile();
    }
    // Allow re-selecting the same file later.
    event.target.value = "";
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    const [releasesRes, auditRes] = await Promise.all([
      fetch("/api/admin/releases"),
      fetch("/api/admin/audit-log"),
    ]);

    if (releasesRes.ok) {
      const data = (await releasesRes.json()) as {
        releases: ReleaseManifest[];
        channels: { dev: ChannelPointer; preview: ChannelPointer; production: ChannelPointer };
      };
      setReleases(data.releases);
      setChannels(data.channels);
    }

    if (auditRes.ok) {
      const data = (await auditRes.json()) as { entries: AuditEntry[] };
      setAuditEntries(data.entries);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setValidationReport(null);
    setSchemaErrors(null);

    let parsedData: unknown;
    if (fileName && parsedFilePayloadRef.current !== null) {
      // File path: already parsed once in handleFileChange — reuse it
      // instead of re-parsing a potentially tens-of-MB string.
      parsedData = parsedFilePayloadRef.current;
    } else {
      try {
        parsedData = JSON.parse(jsonText);
      } catch {
        setSubmitError("Pasted content is not valid JSON.");
        setSubmitting(false);
        return;
      }
    }

    if (
      Array.isArray(parsedData) ||
      typeof parsedData !== "object" ||
      parsedData === null ||
      !("domains" in parsedData)
    ) {
      setSubmitError(
        'JSON must be the full shape: { "domains": [], "social_media": [], "keyword_stats": [] }.',
      );
      setSubmitting(false);
      return;
    }

    const gzipped = await gzipJson({ reportPeriod, schemaVersion, data: parsedData });

    let res: Response;
    if (gzipped.size >= DIRECT_UPLOAD_THRESHOLD_BYTES) {
      // Large payload: upload the gzip blob directly to Supabase Storage
      // via a signed URL, bypassing Vercel's serverless-function body
      // limit entirely, then hand the server just the storage path.
      if (!supabaseBrowser) {
        setSubmitError("Supabase browser client is not configured.");
        setSubmitting(false);
        return;
      }

      const urlRes = await fetch("/api/admin/releases/upload-url", { method: "POST" });
      const urlBody = await urlRes.json();
      if (!urlRes.ok) {
        setSubmitError(urlBody.message ?? "Failed to prepare upload");
        setSubmitting(false);
        return;
      }

      // Use the bucket the server actually issued the signed token for —
      // the token's signature is bound to a specific bucket+path pair, so
      // uploading against a different (e.g. stale/default) bucket name
      // fails with "Invalid signature" even though the token is valid.
      const { error: uploadError } = await supabaseBrowser.storage
        .from(urlBody.bucket)
        .uploadToSignedUrl(urlBody.path, urlBody.token, gzipped, {
          contentType: "application/gzip",
        });

      if (uploadError) {
        setSubmitError(`Direct upload to storage failed: ${uploadError.message}`);
        setSubmitting(false);
        return;
      }

      res = await fetch("/api/admin/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportPeriod, schemaVersion, storagePath: urlBody.path }),
      });
    } else {
      res = await fetch("/api/admin/releases", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream", "Content-Encoding": "gzip" },
        body: gzipped,
      });
    }

    const body = await res.json();

    if (!res.ok) {
      setSubmitError(body.message ?? "Upload failed");
      if (body.schemaErrors) setSchemaErrors(body.schemaErrors);
      if (body.validation) setValidationReport(body.validation);
      setSubmitting(false);
      return;
    }

    setValidationReport(body.validation ?? null);
    setActionMessage(`Release "${body.manifest.releaseId}" created.`);
    setJsonText("");
    clearFile();
    setSubmitting(false);
    refresh();
  };

  const publish = async (releaseId: string, channel: "dev" | "preview" | "production") => {
    if (channel === "production") {
      const ok = window.confirm(
        `Promote release "${releaseId}" to PRODUCTION? This immediately affects live users.`,
      );
      if (!ok) return;
    }

    const res = await fetch("/api/admin/releases/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ releaseId, channel }),
    });

    const body = await res.json();
    if (!res.ok) {
      setActionMessage(`Error: ${body.message}`);
      return;
    }

    setActionMessage(`Release "${releaseId}" published to ${channel}.`);
    refresh();
  };

  const downloadRelease = async (releaseId: string) => {
    setActionMessage(null);
    const res = await fetch(`/api/admin/releases/${encodeURIComponent(releaseId)}/download`);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setActionMessage(`Error: ${body?.message ?? "Failed to download release"}`);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${releaseId}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f3f7f9]">
      <LogoNav />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 p-8 text-slate-900">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Data Releases</h1>
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">
          ← Back to dashboard
        </Link>
      </div>

      {actionMessage ? (
        <p className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-800">{actionMessage}</p>
      ) : null}

      {/* Channel status */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(["dev", "preview", "production"] as const).map((channel) => {
          const pointer = channels?.[channel];
          return (
            <div key={channel} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {channel}
              </h2>
              <p className="mt-2 text-lg font-medium text-slate-900">
                {pointer?.current?.releaseId ?? "— none published —"}
              </p>
              {pointer?.previous ? (
                <p className="mt-1 text-xs text-slate-400">
                  previous: {pointer.previous.releaseId}
                </p>
              ) : null}
            </div>
          );
        })}
      </section>

      {/* Upload form */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Upload new release</h2>
        <form className="mt-4 space-y-4" onSubmit={handleUpload}>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Reporting period
              </label>
              <div className="flex gap-2">
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={reportYear}
                  onChange={(e) => setReportYear(Number(e.target.value))}
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={reportRptNum}
                  onChange={(e) => setReportRptNum(e.target.value)}
                >
                  {RPT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      RPT-{n}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Release name: <span className="font-mono">{reportPeriod}</span> — matches the
                label shown on dashboard cards exactly, no separate conversion needed.
              </p>
            </div>
            <div className="w-40">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Schema version
              </label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={schemaVersion}
                onChange={(e) => setSchemaVersion(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Data JSON — full shape{" "}
              {"{ domains: [], social_media: [], keyword_stats: [] }"}
            </label>
            <div className="mb-2 flex items-center gap-3">
              <label className="cursor-pointer rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
                Upload JSON file…
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              {fileName ? (
                <span className="text-xs text-slate-500">
                  Loaded: <span className="font-mono">{fileName}</span>
                  {fileSizeBytes != null ? (
                    <span className="text-slate-400"> ({(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB)</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={clearFile}
                    className="ml-2 text-slate-400 hover:text-slate-700 underline"
                  >
                    Clear
                  </button>
                </span>
              ) : (
                <span className="text-xs text-slate-400">or paste JSON below</span>
              )}
            </div>
            {fileName ? (
              // Deliberately NOT rendering the file's content into a
              // <textarea> here: for large releases (tens of MB) that made
              // every unrelated re-render during upload (submitting/
              // validationReport/etc. changing) re-diff a huge controlled
              // textarea value, which is what caused the browser to feel
              // sluggish. The parsed object already lives in
              // `parsedFilePayloadRef` and is used as-is on submit.
              <div className="flex h-48 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
                File loaded — content not displayed to keep the page responsive.
                Click &quot;Clear&quot; above to paste JSON instead.
              </div>
            ) : (
              <textarea
                className="h-48 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                }}
                placeholder='{"domains": [], "social_media": [], "keyword_stats": []}'
                required
              />
            )}
          </div>


          {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

          {schemaErrors ? (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-800">
              <p className="font-semibold">Schema errors:</p>
              <ul className="mt-1 list-disc pl-4">
                {schemaErrors.map((e, i) => (
                  <li key={i}>
                    {e.path}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {validationReport ? (
            <div
              className={`rounded-lg p-3 text-xs ${
                validationReport.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
              }`}
            >
              <p className="font-semibold">
                Validation: {validationReport.errorCount} error(s), {validationReport.warningCount}{" "}
                warning(s)
              </p>
              <ul className="mt-1 list-disc pl-4">
                {validationReport.issues.map((issue, i) => (
                  <li key={i}>
                    [{issue.level}] {issue.code}: {issue.message}
                    {issue.path ? ` (${issue.path})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {submitting ? "Validating & uploading…" : "Validate & upload"}
          </button>
        </form>
      </section>

      {/* Release history */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Release history</h2>
        {loading ? (
          <p className="mt-2 text-sm text-slate-500">Loading…</p>
        ) : (
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2">Release ID</th>
                <th>Report period</th>
                <th>Display name</th>
                <th>Generated</th>
                <th>Records</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {releases.map((r) => {
                const isMock = r.releaseId === "mock-data";
                const isEditingDisplayName = editingDisplayNameId === r.releaseId;
                return (
                  <tr key={r.releaseId} className="border-b border-slate-100">
                    <td className="py-2 font-mono text-xs">
                      {r.releaseId}
                      {isMock ? (
                        <span className="ml-2 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
                          MOCK
                        </span>
                      ) : null}
                    </td>
                    <td>{isMock ? "—" : r.reportPeriod}</td>
                    <td>
                      {isMock ? (
                        "—"
                      ) : isEditingDisplayName ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            type="text"
                            placeholder={r.reportPeriod}
                            value={displayNameDrafts[r.releaseId] ?? r.displayName ?? ""}
                            onChange={(e) =>
                              setDisplayNameDrafts((prev) => ({ ...prev, [r.releaseId]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveDisplayName(r.releaseId);
                              if (e.key === "Escape") setEditingDisplayNameId(null);
                            }}
                            className="w-32 rounded border border-slate-200 px-1.5 py-1 text-xs"
                          />
                          <button
                            className="rounded p-1 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                            disabled={savingDisplayNameId === r.releaseId}
                            onClick={() => saveDisplayName(r.releaseId)}
                            title="Save display name"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            className="rounded p-1 text-slate-400 hover:bg-slate-100"
                            onClick={() => setEditingDisplayNameId(null)}
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-700">{r.displayName || "—"}</span>
                      )}
                    </td>
                    <td>{isMock ? "built-in" : new Date(r.generatedAt).toLocaleString()}</td>
                    <td>
                      {isMock
                        ? "—"
                        : r.recordCounts.domains +
                          r.recordCounts.socialMedia +
                          r.recordCounts.socialMediaSummary}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!isMock ? (
                          <>
                            <button
                              className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                              onClick={() =>
                                setEditingDisplayNameId(isEditingDisplayName ? null : r.releaseId)
                              }
                              title="Edit display name"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                              onClick={() => downloadRelease(r.releaseId)}
                              title="Download release JSON"
                            >
                              <DownloadIcon size={15} />
                            </button>
                          </>
                        ) : null}
                        <button
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          onClick={() => publish(r.releaseId, "dev")}
                          title="Publish → Dev"
                        >
                          <FlaskConical size={15} />
                        </button>
                        <button
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          onClick={() => publish(r.releaseId, "preview")}
                          title="Publish → Preview"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          className="rounded p-1.5 text-amber-700 hover:bg-amber-50"
                          onClick={() => publish(r.releaseId, "production")}
                          title="Promote → Production"
                        >
                          <Rocket size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {releases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-400">
                    No releases yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </section>


      {/* Audit log */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Audit log</h2>
        <table className="mt-4 w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2">Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Release</th>
              <th>Channel</th>
            </tr>
          </thead>
          <tbody>
            {auditEntries.map((entry, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2">{new Date(entry.time).toLocaleString()}</td>
                <td>{entry.actor}</td>
                <td>{entry.action}</td>
                <td className="font-mono">{entry.releaseId}</td>
                <td>{entry.channel ?? "—"}</td>
              </tr>
            ))}
            {auditEntries.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-slate-400">
                  No audit entries yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
      </main>
    </div>
  );
}
