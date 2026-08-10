"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type LoginState = "idle" | "loading" | "error";
type Step = "credentials" | "mfa";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [state, setState] = useState<LoginState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const onSubmitCredentials = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState("loading");
    setErrorMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = (await response.json()) as {
      message?: string;
      mfaRequired?: boolean;
      factorId?: string;
    };

    if (!response.ok) {
      setState("error");
      setErrorMessage(data.message ?? "Login failed");
      return;
    }

    if (data.mfaRequired && data.factorId) {
      setFactorId(data.factorId);
      setState("idle");
      setStep("mfa");
      return;
    }

    setState("idle");
    router.push("/dashboard");
    router.refresh();
  };

  const onSubmitCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!factorId) return;
    setState("loading");
    setErrorMessage("");

    const response = await fetch("/api/auth/mfa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ factorId, code }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setState("error");
      setErrorMessage(data.message ?? "Invalid code");
      return;
    }

    setState("idle");
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg shadow-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900">ASOP PharmDash</h1>
        <p className="mt-2 text-sm text-slate-500">
          {step === "credentials"
            ? "Sign in with your credentials"
            : "Enter the 6-digit code from your authenticator app"}
        </p>

        {step === "credentials" ? (
          <form className="mt-6 space-y-4" onSubmit={onSubmitCredentials}>
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

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {state === "error" ? (
              <p className="text-sm text-red-600">{errorMessage}</p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={state === "loading"}
            >
              {state === "loading" ? "Signing in..." : "Sign in"}
            </button>
          </form>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmitCode}>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="code">
                Authentication code
              </label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.3em] outline-none focus:border-blue-500"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                required
              />
            </div>

            {state === "error" ? (
              <p className="text-sm text-red-600">{errorMessage}</p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={state === "loading" || code.length !== 6}
            >
              {state === "loading" ? "Verifying..." : "Verify"}
            </button>

            <button
              type="button"
              className="w-full text-center text-xs text-slate-400 hover:text-slate-600"
              onClick={() => {
                setStep("credentials");
                setCode("");
                setErrorMessage("");
                setState("idle");
              }}
            >
              ← Back to sign in
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
