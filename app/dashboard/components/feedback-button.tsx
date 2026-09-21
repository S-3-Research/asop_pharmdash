"use client";

import { ClipboardPen } from "lucide-react";

import { useLogUseDialog } from "./log-use-dialog-context";

/**
 * "Log Use" button, pinned to the bottom-right corner of the main content
 * panel (not the viewport) — rendered as the last child of the scrollable
 * <main>, using `sticky` rather than `fixed` so it never escapes main's
 * horizontal bounds and drifts over the adjacent Copilot panel when that's
 * open. Clicking opens the shared Log-Use confirm dialog (see
 * log-use-dialog-context.tsx); confirming opens the log-use link in a new
 * tab. The same dialog is also triggered from the Logout flow (UserMenu).
 */
export function FeedbackButton() {
  const { openLogUseDialog } = useLogUseDialog();

  return (
    <div className="pointer-events-none sticky bottom-2 z-40 flex justify-end pr-2">
      <button
        type="button"
        onClick={() => openLogUseDialog()}
        title="Log Use / Data Ask"
        className="pointer-events-auto flex items-center gap-2 border-1 border-slate-500 rounded-full px-5 py-2 text-sm font-semibold bg-[#0a1116] text-white shadow-xl transition-all hover:scale-105 hover:shadow-xl active:scale-95"
      >
        <ClipboardPen className="h-4 w-4" strokeWidth={1.5} />
        Log Use
      </button>
    </div>
  );
}
