"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { SubPageKey, SubPageNavItem } from "./types";
import { UserMenu } from "./user-menu";

type SidebarProps = {
  items: SubPageNavItem[];
  activeKey: SubPageKey;
  onChange: (key: SubPageKey) => void;
  /** Whether the sidebar is rendered in its narrow, icon-only state. This can
   *  be true either because the user manually collapsed it, or because the
   *  Copilot panel is open and temporarily forced it narrow (see
   *  dashboard-shell.tsx) — either way the sidebar itself doesn't need to
   *  know why, just how to render. */
  collapsed: boolean;
  /** Only wired to the manual toggle button — Copilot-driven collapse has no
   *  user-facing toggle (it un-collapses automatically when the panel closes). */
  onToggleCollapsed: () => void;
};

export function Sidebar({ items, activeKey, onChange, collapsed, onToggleCollapsed }: SidebarProps) {
  return (
    <aside
      className={`relative flex shrink-0 flex-col justify-between overflow-visible bg-[#0a1116] text-white shadow-xl ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      <div>
        {/* Header slot: fixed h-14 height regardless of collapse state, but
            the Logo inside is absolutely positioned at its full expanded
            size and never shrinks/gets clipped — when the sidebar narrows
            to w-16, the Logo simply overflows past the sidebar's right
            edge (aside has overflow-visible) and floats above main's
            top-left corner instead of resizing or getting cut off.
            NOTE: this div (the Image's absolute-positioning containing
            block) must keep a fixed width matching the *expanded* sidebar
            width — Tailwind Preflight's `img { max-width: 100% }` reset is
            resolved against the containing block's width, so if this div
            were left to shrink to the collapsed w-16 (64px) it would clamp
            the Logo down to 64px too, even with w-auto set. */}
        <div className="relative h-14 w-56">
          <Image
            src="/ASOP Global x S3.png"
            alt="ASOP Global x S3"
            width={176}
            height={28}
            className="absolute left-3 top-1/2 z-10 h-10 w-auto max-w-none -translate-y-1/2"
            priority
          />
        </div>

        <div className="mx-3 border-t border-white/5" />

        <nav className="mt-3 space-y-1 px-3 ">
          {items.map((item) => {
            const isActive = item.key === activeKey;
            const Icon = item.icon;

            return (
              <button
                type="button"
                key={item.key}
                onClick={() => onChange(item.key)}
                title={collapsed ? item.label : undefined}
                className={`group relative w-full rounded-lg text-left transition-colors ${
                  collapsed ? "flex justify-center px-0 py-2.5" : "px-3 py-2.5"
                } ${
                  isActive
                    ? "bg-[#98b8c8] text-gray-900"
                    : "text-gray-300 hover:bg-[#1a252c]"
                }`}
              >
                {collapsed ? (
                  <>
                    <Icon size={18} />
                    {/* Simple CSS tooltip — no extra JS/positioning library needed */}
                    <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#1a252c] px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                      {item.label}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className={`mt-0.5 text-xs ${isActive ? "text-gray-700" : "text-gray-500"}`}>
                      {item.description}
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Collapse/expand toggle — deliberately styled as a secondary,
            "settings-like" action rather than a page-nav item: a divider
            separates it from the 3 subpage buttons above, and it uses a
            smaller/dimmer text style with no active-state background, so
            it doesn't read as a 4th navigation destination. */}
        <div className="mx-3 mt-3 border-t border-white/5 pt-3">
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex w-full items-center gap-2 rounded-lg py-2 text-xs font-medium text-gray-500 transition-colors hover:bg-[#1a252c] hover:text-gray-300 ${
              collapsed ? "justify-center px-0" : "px-3"
            }`}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </div>

      <UserMenu collapsed={collapsed} />
    </aside>
  );
}
