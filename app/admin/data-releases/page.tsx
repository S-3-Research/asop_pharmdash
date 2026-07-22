"use client";

import { useCallback, useEffect, useState } from "react";

type ChannelRef = { releaseId: string; reportPeriod: string; promotedAt: string };
type ChannelPointer = { current: ChannelRef | null; previous: ChannelRef | null };

type ReleaseManifest = {
  releaseId: string;
  reportPeriod: string;
  schemaVersion: string;
  generatedAt: string;
  recordCounts: { domains: number; socialMedia: number; socialMediaSummary: number };
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

export default function DataReleasesAdminPage() {
  const [releases, setReleases] = useState<ReleaseManifest[]>([]);
  const [channels, setChannels] = useState<{ preview: ChannelPointer; production: ChannelPointer } | null>(
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
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSubmitError(null);
    try {
      const text = await file.text();
      JSON.parse(text); // early sanity check
      setJsonText(text);
      setFileName(file.name);
    } catch {
      setSubmitError(`File "${file.name}" is not valid JSON.`);
      setFileName(null);
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
        channels: { preview: ChannelPointer; production: ChannelPointer };
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
    try {
      parsedData = JSON.parse(jsonText);
    } catch {
      setSubmitError("Pasted content is not valid JSON.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/admin/releases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportPeriod, schemaVersion, data: parsedData }),
    });

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
    setFileName(null);
    setSubmitting(false);
    refresh();
  };

  const publish = async (releaseId: string, channel: "preview" | "production") => {
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

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Data Releases</h1>

      {actionMessage ? (
        <p className="rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-800">{actionMessage}</p>
      ) : null}

      {/* Channel status */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(["preview", "production"] as const).map((channel) => {
          const pointer = channels?.[channel];
          return (
            <div key={channel} className="rounded-xl border border-slate-200 p-4">
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
      <section className="rounded-xl border border-slate-200 p-4">
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
              Data JSON — either a bare array of domain records, or the full shape{" "}
              {"{ domains: [], social_media: [], social_media_summary: [] }"}
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
                </span>
              ) : (
                <span className="text-xs text-slate-400">or paste JSON below</span>
              )}
            </div>
            <textarea
              className="h-48 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                setFileName(null);
              }}
              placeholder='[{"domain": "https://example.com", ...}] or {"domains": [], "social_media": [], "social_media_summary": []}'
              required
            />
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
      <section className="rounded-xl border border-slate-200 p-4">
        <h2 className="text-lg font-semibold text-slate-900">Release history</h2>
        {loading ? (
          <p className="mt-2 text-sm text-slate-500">Loading…</p>
        ) : (
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2">Release ID</th>
                <th>Report period</th>
                <th>Generated</th>
                <th>Records</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {releases.map((r) => {
                const isMock = r.releaseId === "mock-data";
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
                    <td>{isMock ? "built-in" : new Date(r.generatedAt).toLocaleString()}</td>
                    <td>
                      {isMock
                        ? "—"
                        : r.recordCounts.domains +
                          r.recordCounts.socialMedia +
                          r.recordCounts.socialMediaSummary}
                    </td>
                    <td className="space-x-2 py-2 text-right">
                      <button
                        className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
                        onClick={() => publish(r.releaseId, "preview")}
                      >
                        Publish → Preview
                      </button>
                      <button
                        className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-900 hover:bg-amber-200"
                        onClick={() => publish(r.releaseId, "production")}
                      >
                        Promote → Production
                      </button>
                    </td>
                  </tr>
                );
              })}
              {releases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-400">
                    No releases yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </section>

      {/* Audit log */}
      <section className="rounded-xl border border-slate-200 p-4">
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
  );
}
