"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { supabaseBrowser } from "@/lib/supabase-browser";

type Status = "checking" | "ready" | "submitting" | "success" | "error";

/**
 * Lands here from two different kinds of email links, which use two
 * different Supabase Auth flows and must be handled separately:
 *
 * - Invite links (`type=invite`) use the implicit grant flow: the tokens
 *   arrive directly in the URL hash fragment
 *   (`#access_token=...&refresh_token=...`). We parse that ourselves and
 *   call `setSession()` on the plain (localStorage-based) client — no PKCE
 *   or cookies involved.
 * - Forgot-password links (`type=recovery`) use the PKCE flow: GoTrue
 *   redirects here with `?code=...`. The code_verifier for that flow was
 *   written to a cookie by the server (see
 *   app/api/auth/forgot-password/route.ts), so only the cookie-aware
 *   `supabaseBrowser` client (lib/supabase-browser.ts) can read it back.
 *   Its default `detectSessionInUrl: true` behavior exchanges the code for
 *   a session automatically — no manual `exchangeCodeForSession` call
 *   needed.
 *
 * Whichever path establishes the session, `onSubmit` below must reuse that
 * same client to call `updateUser({ password })`, since the two clients
 * don't share storage.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [activeClient, setActiveClient] = useState<SupabaseClient | null>(null);

  useEffect(() => {
    const establishSession = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        if (!supabase) {
          setStatus("error");
          setErrorMessage("Supabase is not configured");
          return;
        }
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        window.history.replaceState(window.history.state, "", window.location.pathname);
        if (error) {
          console.error("[set-password] setSession failed:", error.message);
          setStatus("error");
          setErrorMessage(
            "This invite link is invalid or has expired. Please ask an admin to resend it.",
          );
          return;
        }
        setActiveClient(supabase);
        setStatus("ready");
        return;
      }

      if (!supabaseBrowser) {
        setStatus("error");
        setErrorMessage("Supabase is not configured");
        return;
      }
      const { data } = await supabaseBrowser.auth.getSession();
      if (data.session) {
        setActiveClient(supabaseBrowser);
        setStatus("ready");
      } else {
        setStatus("error");
        setErrorMessage(
          "This link is invalid or has expired. Please request a new one.",
        );
      }
    };

    establishSession();
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeClient) return;

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

    const { error } = await activeClient.auth.updateUser({ password });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    // Explicitly tell our own backend this account's setup is done — see
    // app/api/auth/activate/route.ts for why this can't be inferred from
    // any auth.users column via a database trigger. Best-effort: don't
    // block the user from continuing to the dashboard if this call fails
    // (worst case, the admin Users page still shows "invited" and an
    // admin can nudge status manually — the account itself works fine
    // either way since the password is already set).
    const { data: sessionData } = await activeClient.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (accessToken) {
      try {
        await fetch("/api/auth/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken }),
        });
      } catch (activateError) {
        console.error("[set-password] activate call failed:", activateError);
      }
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
          <p className="mt-6 text-sm text-slate-500">Verifying link…</p>
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
