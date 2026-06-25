"use client";

import Image from "next/image";

import type { SubPageKey, SubPageNavItem } from "./types";

type SidebarProps = {
  items: SubPageNavItem[];
  activeKey: SubPageKey;
  onChange: (key: SubPageKey) => void;
};

export function Sidebar({ items, activeKey, onChange }: SidebarProps) {
  return (
    <aside className="flex w-64 shrink-0 flex-col justify-between bg-[#0a1116] text-white shadow-xl">
      <div>
        <div className="flex h-14 items-center bg-[#0a1116] px-4 py-2">
          <Image
            src="/ASOP x S3.png"
            alt="ASOP x S3"
            width={176}
            height={28}
            className="h-10 w-auto"
            priority
          />
        </div>

        <nav className="mt-6 space-y-1 px-3">
          {items.map((item) => {
            const isActive = item.key === activeKey;

            return (
              <button
                type="button"
                key={item.key}
                onClick={() => onChange(item.key)}
                className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                  isActive
                    ? "bg-[#98b8c8] text-gray-900"
                    : "text-gray-300 hover:bg-[#1a252c]"
                }`}
              >
                <div className="text-sm font-semibold">{item.label}</div>
                <div className={`mt-0.5 text-xs ${isActive ? "text-gray-700" : "text-gray-500"}`}>
                  {item.description}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mb-2 flex items-center gap-3 p-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600 text-sm font-bold">
          M
        </div>
        <div>
          <div className="text-sm font-medium">Mingxiang Cai</div>
          <div className="text-xs text-gray-400">m.cai@s-3.io</div>
        </div>
      </div>
    </aside>
  );
}
