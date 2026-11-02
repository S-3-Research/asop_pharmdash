"use client";

export default function ExpiredPage() {
  return <main className="m-auto max-w-lg space-y-5 p-8 text-slate-900">
    <h1 className="text-2xl font-semibold">Account access expired</h1>
    <p>Your account and data are retained. Contact your administrator to renew your access.</p>
    <a className="block text-blue-700 underline" href="/dashboard">Check access again</a>
    <button className="rounded-lg bg-slate-900 px-4 py-2 text-white" onClick={async () => {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (response.ok) window.location.assign("/login");
    }}>Sign out</button>
  </main>;
}
