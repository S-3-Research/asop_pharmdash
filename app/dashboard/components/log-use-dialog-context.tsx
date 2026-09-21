"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const LOG_USE_URL = "https://forms.gle/ThhJDSQnXFau5p3U8";

type ConfirmAction = (() => void | Promise<void>) | undefined;

type LogUseDialogContextValue = {
  /**
   * Opens the "Log Rx Watchdog Use" confirm dialog. If `onConfirm` is
   * provided, it runs *after* the log-use link is opened and the dialog is
   * closed (used by the logout flow to continue logging out). If the user
   * cancels, `onConfirm` never runs.
   */
  openLogUseDialog: (onConfirm?: ConfirmAction) => void;
};

const LogUseDialogContext = createContext<LogUseDialogContextValue | null>(null);

export function useLogUseDialog() {
  const ctx = useContext(LogUseDialogContext);
  if (!ctx) {
    throw new Error("useLogUseDialog must be used within a LogUseDialogProvider");
  }
  return ctx;
}

export function LogUseDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const onConfirmRef = useRef<ConfirmAction>(undefined);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const openLogUseDialog = useCallback((onConfirm?: ConfirmAction) => {
    onConfirmRef.current = onConfirm;
    setOpen(true);
  }, []);

  const handleCancel = () => {
    onConfirmRef.current = undefined;
    setOpen(false);
  };

  const handleConfirm = () => {
    window.open(LOG_USE_URL, "_blank", "noopener,noreferrer");
    setOpen(false);
    const onConfirm = onConfirmRef.current;
    onConfirmRef.current = undefined;
    onConfirm?.();
  };

  return (
    <LogUseDialogContext.Provider value={{ openLogUseDialog }}>
      {children}

      {mounted && open
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="log-use-dialog-title"
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
              onClick={handleCancel}
            >
              <div
                className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2
                  id="log-use-dialog-title"
                  className="text-base font-semibold text-[#0a1116]"
                >
                  Log Rx Watchdog Use
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Quickly log who used or requested Rx Watchdog data. No login, names, or sensitive information required.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="rounded-lg px-4 py-2 text-sm font-semibold bg-[#0a1116] text-white transition-opacity hover:opacity-90"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </LogUseDialogContext.Provider>
  );
}
