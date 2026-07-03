"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type {
  CopilotContextValue,
  FilterAction,
  PageContext,
  PendingAction,
  SelectedWidget,
} from "./types";
import { CBU_WINDOW } from "./types";

// ── Defaults ──────────────────────────────────────────────────────────────────

const defaultPageContext: PageContext = {
  page: "top-products",
  pageTitle: "Top Products",
  cbuWindow: CBU_WINDOW,
  filters: { categories: [] },
  stats: [],
};

// ── Context ───────────────────────────────────────────────────────────────────

const CopilotCtx = createContext<CopilotContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [pageContext, setPageContext] = useState<PageContext>(defaultPageContext);
  const [selectedWidget, setSelectedWidget] = useState<SelectedWidget | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // The active page's filter handler — updated each time a subpage mounts.
  const filterHandlerRef = useRef<((a: FilterAction) => void) | null>(null);

  const updatePageContext = useCallback((patch: Partial<PageContext>) => {
    setPageContext((prev) => ({ ...prev, ...patch }));
  }, []);

  const proposePendingAction = useCallback((a: PendingAction) => {
    setPendingAction(a);
    setIsPanelOpen(true); // auto-open so user sees the confirmation
  }, []);

  const confirmPendingAction = useCallback(() => {
    if (pendingAction && filterHandlerRef.current) {
      filterHandlerRef.current(pendingAction.action);
    }
    setPendingAction(null);
  }, [pendingAction]);

  const cancelPendingAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  const registerFilterHandler = useCallback(
    (handler: (a: FilterAction) => void) => {
      filterHandlerRef.current = handler;
    },
    [],
  );

  const openPanel = useCallback(() => setIsPanelOpen(true), []);
  const togglePanel = useCallback(() => setIsPanelOpen((p) => !p), []);

  return (
    <CopilotCtx.Provider
      value={{
        pageContext,
        updatePageContext,
        selectedWidget,
        setSelectedWidget,
        pendingAction,
        proposePendingAction,
        confirmPendingAction,
        cancelPendingAction,
        registerFilterHandler,
        isPanelOpen,
        openPanel,
        togglePanel,
      }}
    >
      {children}
    </CopilotCtx.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCopilot(): CopilotContextValue {
  const ctx = useContext(CopilotCtx);
  if (!ctx) throw new Error("useCopilot must be used inside <CopilotProvider>");
  return ctx;
}
