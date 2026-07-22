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

import type {
  CopilotContextValue,
  FilterAction,
  PageContext,
  PendingAction,
  SelectedWidget,
  WidgetDataEntry,
  WidgetDataPoint,
  WidgetSnapshot,
} from "./types";

// ── Defaults ──────────────────────────────────────────────────────────────────────

const defaultPageContext: PageContext = {
  page: "top-products",
  pageTitle: "Top Products",
  // Filled in by each subpage once its release data loads — never hardcoded.
  reportingPeriod: "",
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

  // Live widget data — cards report what they currently render; stored in a
  // ref (no re-renders) and read on demand when a message is sent.
  const widgetDataRef = useRef(new Map<string, WidgetDataEntry>());

  const reportWidgetData = useCallback(
    (widgetId: string, entry: WidgetDataEntry | null) => {
      if (entry) widgetDataRef.current.set(widgetId, entry);
      else widgetDataRef.current.delete(widgetId);
    },
    [],
  );

  const getWidgetData = useCallback(
    (widgetId: string) => widgetDataRef.current.get(widgetId),
    [],
  );

  const getAllWidgetData = useCallback(
    () =>
      [...widgetDataRef.current.entries()].map(([widgetId, entry]) => ({
        widgetId,
        ...entry,
      })),
    [],
  );

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
  const togglePanel = useCallback(() => {
    setIsPanelOpen((p) => {
      // Closing the panel also deselects any selected card.
      if (p) setSelectedWidget(null);
      return !p;
    });
  }, []);

  return (
    <CopilotCtx.Provider
      value={{
        pageContext,
        updatePageContext,
        selectedWidget,
        setSelectedWidget,
        reportWidgetData,
        getWidgetData,
        getAllWidgetData,
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

/**
 * Cards call this to publish the data they are currently rendering plus an
 * optional card-specific prompt fragment (what the card shows, where the
 * data comes from). The snapshot is looked up by widgetId when the user
 * sends a Copilot message, so the AI always receives the live values.
 */
export function useWidgetData(
  widgetId: string,
  dataPoints: WidgetDataPoint[],
  prompt?: string,
) {
  const { reportWidgetData } = useCopilot();
  const json = JSON.stringify(dataPoints);
  useEffect(() => {
    reportWidgetData(widgetId, {
      dataPoints: JSON.parse(json) as WidgetDataPoint[],
      prompt,
    });
    return () => reportWidgetData(widgetId, null);
  }, [widgetId, json, prompt, reportWidgetData]);
}
