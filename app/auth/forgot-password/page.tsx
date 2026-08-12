"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type Status = "idle" | "loading" | "sent" | "error";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setStatus("error");
      setErrorMessage(data.message ?? "Something went wrong, please try again");
      return;
    }

    setStatus("sent");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg shadow-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900">Reset your password</h1>
        <p className="mt-2 text-sm text-slate-500">
          Enter your account email and we&apos;ll send you a link to set a new password.
        </p>

        {status === "sent" ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
              If an account exists for <span className="font-medium">{email}</span>, a reset
              link has been sent. Check your inbox.
            </p>
            <Link
              href="/login"
              className="block text-center text-sm text-slate-500 hover:text-slate-800"
            >
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            {status === "error" ? (
              <p className="text-sm text-red-600">{errorMessage}</p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={status === "loading"}
            >
              {status === "loading" ? "Sending..." : "Send reset link"}
            </button>

            <Link
              href="/login"
              className="block text-center text-xs text-slate-400 hover:text-slate-600"
            >
              ← Back to sign in
            </Link>
          </form>
        )}
      </section>
    </main>
  );
}
