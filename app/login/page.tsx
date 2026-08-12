"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import AuthBackground from "@/app/auth/components/auth-background";

type LoginState = "idle" | "loading" | "error";
type Step = "credentials" | "mfa" | "otp-request" | "otp-code";
type Mode = "password" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [state, setState] = useState<LoginState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setStep(nextMode === "password" ? "credentials" : "otp-request");
    setErrorMessage("");
    setInfoMessage("");
    setState("idle");
  };

  const onSendOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState("loading");
    setErrorMessage("");

    const response = await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setState("error");
      setErrorMessage(data.message ?? "Could not send code");
      return;
    }

    setState("idle");
    setInfoMessage(`We sent a 8-digit code to ${email}. It expires shortly.`);
    setStep("otp-code");
  };

  const onVerifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState("loading");
    setErrorMessage("");

    const response = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: otpCode }),
    });

    const data = (await response.json()) as {
      message?: string;
      mfaRequired?: boolean;
      factorId?: string;
    };

    if (!response.ok) {
      setState("error");
      setErrorMessage(data.message ?? "Invalid or expired code");
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
        <h1 className="text-2xl font-semibold text-white">ASOP PharmDash</h1>
        <p className="mt-2 text-sm text-slate-400">
          {step === "credentials"
            ? "Sign in with your credentials"
            : step === "mfa"
              ? "Enter the 6-digit code from your authenticator app"
              : step === "otp-request"
                ? "Sign in with a one-time code sent to your email"
                : "Enter the 6-digit code we emailed you"}
        </p>

        {step === "credentials" || step === "otp-request" ? (
          <div className="mt-4 flex rounded-lg border border-white/10 bg-white/5 p-1 text-xs font-medium">
            <button
              type="button"
              className={`flex-1 rounded-md py-1.5 transition-colors ${
                mode === "password" ? "bg-white/10 text-white shadow" : "text-slate-400"
              }`}
              onClick={() => switchMode("password")}
            >
              Password
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md py-1.5 transition-colors ${
                mode === "otp" ? "bg-white/10 text-white shadow" : "text-slate-400"
              }`}
              onClick={() => switchMode("otp")}
            >
              Email code
            </button>
          </div>
        ) : null}

        {step === "credentials" ? (
          <form className="mt-6 space-y-4" onSubmit={onSubmitCredentials}>
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

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-400/60"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {state === "error" ? (
              <p className="text-sm text-red-400">{errorMessage}</p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-slate-500"
              disabled={state === "loading"}
            >
              {state === "loading" ? "Signing in..." : "Sign in"}
            </button>

            <Link
              href="/auth/forgot-password"
              className="block text-center text-xs text-slate-500 hover:text-slate-300"
            >
              Forgot your password?
            </Link>
          </form>
        ) : step === "otp-request" ? (
          <form className="mt-6 space-y-4" onSubmit={onSendOtp}>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300" htmlFor="otp-email">
                Email
              </label>
              <input
                id="otp-email"
                type="email"
                autoComplete="email"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-400/60"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            {state === "error" ? (
              <p className="text-sm text-red-400">{errorMessage}</p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-slate-500"
              disabled={state === "loading"}
            >
              {state === "loading" ? "Sending code..." : "Send code"}
            </button>
          </form>
        ) : step === "otp-code" ? (
          <form className="mt-6 space-y-4" onSubmit={onVerifyOtp}>
            {infoMessage ? <p className="text-xs text-slate-400">{infoMessage}</p> : null}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300" htmlFor="otp-code">
                One-time code
              </label>
              <input
                id="otp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-lg tracking-[0.3em] text-white outline-none focus:border-blue-400/60"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ""))}
                required
              />
            </div>

            {state === "error" ? (
              <p className="text-sm text-red-400">{errorMessage}</p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-slate-500"
              disabled={state === "loading" || otpCode.length < 6}
            >
              {state === "loading" ? "Verifying..." : "Verify"}
            </button>

            <button
              type="button"
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300"
              onClick={() => {
                setStep("otp-request");
                setOtpCode("");
                setErrorMessage("");
                setInfoMessage("");
                setState("idle");
              }}
            >
              ← Use a different email
            </button>
          </form>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmitCode}>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300" htmlFor="code">
                Authentication code
              </label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-lg tracking-[0.3em] text-white outline-none focus:border-blue-400/60"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                required
              />
            </div>

            {state === "error" ? (
              <p className="text-sm text-red-400">{errorMessage}</p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-slate-500"
              disabled={state === "loading" || code.length !== 6}
            >
              {state === "loading" ? "Verifying..." : "Verify"}
            </button>

            <button
              type="button"
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300"
              onClick={() => {
                setStep(mode === "otp" ? "otp-request" : "credentials");
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
    </AuthBackground>
  );
}
