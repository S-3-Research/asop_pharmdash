"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { LogoNav } from "@/app/dashboard/components/logo-nav";

type Factor = { id: string; friendly_name?: string; status: string; created_at: string };

type EnrollState = {
  factorId: string;
  qrCodeSvg: string;
  secret: string;
} | null;

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitChange = async (codeOverride?: string) => {
    setSubmitting(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword,
        newPassword,
        mfaCode: codeOverride,
      }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.message ?? "Failed to update password");
      return;
    }

    if (data.mfaRequired) {
      // Password/current-password check already passed; now prompt for the
      // 2FA code needed to elevate the session before Supabase will allow
      // the actual password update.
      setMfaRequired(true);
      return;
    }

    setMessage("Password updated.");
    setMfaRequired(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMfaCode("");
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    await submitChange();
  };

  const onSubmitMfaCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    await submitChange(mfaCode);
  };

  if (mfaRequired) {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Change password</h2>
        <form className="mt-4 space-y-4" onSubmit={onSubmitMfaCode}>
          <p className="text-sm text-slate-600">
            Enter the 6-digit code from your authenticator app to confirm this change.
          </p>
          <input
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.3em]"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
            required
          />

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || mfaCode.length !== 6}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {submitting ? "Verifying…" : "Verify & update password"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
              onClick={() => {
                setMfaRequired(false);
                setMfaCode("");
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Change password</h2>

      <form className="mt-4 space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Current password
          </label>
          <input
            type="password"
            autoComplete="current-password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">New password</label>
          <input
            type="password"
            autoComplete="new-password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Confirm new password
          </label>
          <input
            type="password"
            autoComplete="new-password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>

        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {submitting ? "Updating…" : "Update password"}
        </button>
      </form>
    </section>
  );
}

function TwoFactorSection() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enroll, setEnroll] = useState<EnrollState>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const res = await fetch("/api/auth/mfa/status");
    if (res.ok) {
      const data = (await res.json()) as { factors: Factor[] };
      setFactors(data.factors);
    }
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const startEnroll = async () => {
    setError(null);
    setMessage(null);
    const res = await fetch("/api/auth/mfa/enroll", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? "Failed to start enrollment");
      return;
    }
    setEnroll(data);
  };

  const verifyEnroll = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!enroll) return;
    setError(null);
    const res = await fetch("/api/auth/mfa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ factorId: enroll.factorId, code }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? "验证码不正确");
      return;
    }
    setMessage("Two-factor authentication enabled.");
    setEnroll(null);
    setCode("");
    refresh();
  };

  const removeFactor = async (factorId: string) => {
    const ok = window.confirm("Disable two-factor authentication?");
    if (!ok) return;
    setError(null);
    const res = await fetch("/api/auth/mfa/unenroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ factorId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? "Failed to remove factor");
      return;
    }
    setMessage("Two-factor authentication disabled.");
    refresh();
  };

  const verifiedFactors = factors.filter((f) => f.status === "verified");

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Two-factor authentication</h2>

      {message ? (
        <p className="mt-2 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-800">{message}</p>
      ) : null}
      {error ? (
        <p className="mt-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      {loading ? (
        <p className="mt-2 text-sm text-slate-500">Loading…</p>
      ) : verifiedFactors.length > 0 ? (
        <div className="mt-3 space-y-2">
          {verifiedFactors.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
            >
              <span>Enabled{f.friendly_name ? ` — ${f.friendly_name}` : ""}</span>
              <button
                className="rounded bg-red-100 px-2 py-1 text-xs text-red-800 hover:bg-red-200"
                onClick={() => removeFactor(f.id)}
              >
                Disable
              </button>
            </div>
          ))}
        </div>
      ) : enroll ? (
        <form className="mt-4 space-y-4" onSubmit={verifyEnroll}>
          <p className="text-sm text-slate-600">
            Scan this QR code with an authenticator app (Google Authenticator, 1Password, etc.),
            then enter the 6-digit code it generates.
          </p>
          <div
            className="w-fit rounded-lg border border-slate-200 p-2"
            dangerouslySetInnerHTML={{ __html: enroll.qrCodeSvg }}
          />
          <p className="text-xs text-slate-500">
            Can&apos;t scan? Enter this code manually:{" "}
            <span className="font-mono">{enroll.secret}</span>
          </p>
          <input
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.3em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            required
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={code.length !== 6}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              Verify & enable
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
              onClick={() => {
                setEnroll(null);
                setCode("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-slate-500">
            Two-factor authentication is not enabled for your account.
          </p>
          <button
            className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            onClick={startEnroll}
          >
            Enable two-factor authentication
          </button>
        </div>
      )}
    </section>
  );
}

export default function SettingsClient() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f3f7f9]">
      <LogoNav />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-8 text-slate-900">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">
          ← Back to dashboard
        </Link>
      </div>

      <ChangePasswordSection />
      <TwoFactorSection />
      </main>
    </div>
  );
}
