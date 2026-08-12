"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Me = { email: string; role: "admin" | "manager" | "viewer" } | null;

export function UserMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<Me>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setMe(data))
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const onLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const email = me?.email ?? "…";
  const initial = email.charAt(0).toUpperCase() || "?";
  const isAdmin = me?.role === "admin";
  const isManager = me?.role === "manager";

  return (
    <div ref={containerRef} className="relative mb-2 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-[#1a252c]"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-600 text-sm font-bold">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{email}</div>
        </div>
      </button>

      {open ? (
        <div className="absolute bottom-full left-4 right-4 mb-2 overflow-hidden rounded-lg border border-[#1f2a31] bg-[#0f1a20] shadow-xl">
          {isAdmin ? (
            <Link
              href="/admin/data-releases"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-gray-200 transition-colors hover:bg-[#1a252c]"
            >
              Data Releases
            </Link>
          ) : null}
          {isAdmin || isManager ? (
            <Link
              href="/admin/users"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-gray-200 transition-colors hover:bg-[#1a252c]"
            >
              Users
            </Link>
          ) : null}
          <Link
            href="/dashboard/settings"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-gray-200 transition-colors hover:bg-[#1a252c]"
          >
            Settings
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="block w-full px-4 py-2.5 text-left text-sm text-gray-200 transition-colors hover:bg-[#1a252c]"
          >
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
