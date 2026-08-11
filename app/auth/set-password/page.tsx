"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

type Status = "checking" | "ready" | "submitting" | "success" | "error";

/**
 * Lands here from the invite/recovery email link
 * (?redirectTo=.../auth/set-password). Supabase's browser client
 * automatically detects the `code`/token in the URL and exchanges it for a
 * session on load (detectSessionInUrl, enabled by default), so by the time
 * this component mounts, `supabase.auth.getSession()` should already
 * resolve to a valid (aal1) session for the invited user — we just need
 * them to set a password to finish account activation.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!supabase) {
      setStatus("error");
      setErrorMessage("Supabase is not configured");
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setStatus("ready");
      } else {
        setStatus("error");
        setErrorMessage(
          "This invite link is invalid or has expired. Please ask an admin to resend it.",
        );
      }
    });
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;

    if (password.length < 8) {
      setStatus("error");
      setErrorMessage("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setStatus("error");
      setErrorMessage("Passwords do not match");
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("success");
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1200);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg shadow-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900">Activate your account</h1>
        <p className="mt-2 text-sm text-slate-500">
          Choose a password to finish setting up your ASOP PharmDash account.
        </p>

        {status === "checking" ? (
          <p className="mt-6 text-sm text-slate-500">Verifying invite link…</p>
        ) : status === "success" ? (
          <p className="mt-6 text-sm text-green-600">
            Password set! Redirecting to your dashboard…
          </p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
                New password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={status === "error" && !!errorMessage && errorMessage.includes("invalid")}
                required
              />
            </div>

            <div>
              <label
                className="mb-1 block text-sm font-medium text-slate-700"
                htmlFor="confirmPassword"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </div>

            {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={status === "submitting"}
            >
              {status === "submitting" ? "Saving…" : "Set password & continue"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
