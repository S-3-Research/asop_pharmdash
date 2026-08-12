"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useState } from "react";

import AuthBackground from "@/app/auth/components/auth-background";

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
    <AuthBackground>
      <section className="auth-glass-card w-full rounded-2xl p-8">
        <div className="mb-4">
          <Image
            src="/ASOP x S3.png"
            alt="ASOP PharmDash"
            width={140}
            height={56}
            className="object-contain"
            priority
          />
        </div>
        <h1 className="text-2xl font-semibold text-white">Reset your password</h1>
        <p className="mt-2 text-sm text-slate-400">
          Enter your account email and we&apos;ll send you a link to set a new password.
        </p>

        {status === "sent" ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              If an account exists for <span className="font-medium">{email}</span>, a reset
              link has been sent. Check your inbox.
            </p>
            <Link
              href="/login"
              className="block text-center text-sm text-slate-400 hover:text-slate-200"
            >
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-400/60"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            {status === "error" ? (
              <p className="text-sm text-red-400">{errorMessage}</p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-slate-500"
              disabled={status === "loading"}
            >
              {status === "loading" ? "Sending..." : "Send reset link"}
            </button>

            <Link
              href="/login"
              className="block text-center text-xs text-slate-500 hover:text-slate-300"
            >
              ← Back to sign in
            </Link>
          </form>
        )}
      </section>
    </AuthBackground>
  );
}
