"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Refresh existing screens too; authorization itself is always server-side. */
export function AccessSessionGuard() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname.startsWith("/dashboard") && !pathname.startsWith("/admin")) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      let delay = 30_000;
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const body = await response.json();
        if (cancelled) return;
        if (body.code === "ACCOUNT_EXPIRED") window.location.replace("/auth/expired");
        else if (response.status === 401 || response.status === 403) window.location.replace("/login");
        if (response.ok && body.access_expires_at) {
          delay = Math.max(1000, Math.min(delay, Date.parse(body.access_expires_at) - Date.now() + 100));
        }
      } catch { /* Retry; protected requests still fail closed on the server. */ }
      if (!cancelled) timer = setTimeout(check, delay);
    };
    void check();
    const focus = () => { clearTimeout(timer); void check(); };
    window.addEventListener("focus", focus);
    return () => { cancelled = true; clearTimeout(timer); window.removeEventListener("focus", focus); };
  }, [pathname]);
  return null;
}
