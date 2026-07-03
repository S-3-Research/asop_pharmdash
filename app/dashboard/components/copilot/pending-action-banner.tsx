"use client";

import { CheckCircle, XCircle } from "lucide-react";

import type { PendingAction } from "./types";

const B = "#64D6D8";

interface PendingActionBannerProps {
  action: PendingAction;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PendingActionBanner({
  action,
  onConfirm,
  onCancel,
}: PendingActionBannerProps) {
  return (
    <div
      className="mx-3 my-2 rounded-2xl p-3.5"
      style={{
        background: `linear-gradient(135deg, ${B}0E 0%, rgba(255,255,255,0.7) 100%)`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: `1px solid ${B}30`,
        boxShadow: `0 4px 20px ${B}15`,
      }}
    >
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: B }}>
        <span
          className="flex h-4 w-4 items-center justify-center rounded-full text-white text-[10px]"
          style={{ background: B }}
        >
          ⚡
        </span>
        Proposed Filter Change
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-slate-600">
        {action.description}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold text-white transition-all active:scale-95"
          style={{ background: `linear-gradient(135deg, ${B} 0%, #4ecdd0 100%)`, boxShadow: `0 2px 8px ${B}40` }}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Apply
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition-all active:scale-95 hover:bg-black/5"
          style={{ borderColor: "rgba(0,0,0,0.1)", color: "#64748b", background: "rgba(255,255,255,0.6)" }}
        >
          <XCircle className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
}
