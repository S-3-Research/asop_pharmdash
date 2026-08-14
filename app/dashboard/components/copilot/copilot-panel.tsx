"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import { ArrowUp, RotateCcw, Sparkles, X } from "lucide-react";

import { useCopilot } from "./copilot-context";
import { MessageList } from "./message-list";
import { PendingActionBanner } from "./pending-action-banner";
import { PromptButtons } from "./prompt-buttons";
import type { FilterAction, PendingAction } from "./types";

const B = "#64D6D8";

// ── Panel ─────────────────────────────────────────────────────────────────────

export function CopilotPanel() {
  const {
    pageContext,
    selectedWidget,
    setSelectedWidget,
    getWidgetData,
    getAllWidgetData,
    pendingAction,
    proposePendingAction,
    confirmPendingAction,
    cancelPendingAction,
    isPanelOpen,
    togglePanel,
  } = useCopilot();

  // Stable session ID for this panel mount
  const chatId = useMemo(() => crypto.randomUUID(), []);

  const { messages, status, sendMessage, setMessages } = useChat({
    id: chatId,
    transport: new DefaultChatTransport({ api: "/api/copilot/chat" }),
    onError: (err) => console.error("[copilot]", err),
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // ── Detect propose_filter_action tool results ──────────────────────────────
  const seenToolCallIds = useRef(new Set<string>());

  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      for (const part of msg.parts) {
        if (
          isToolUIPart(part) &&
          getToolName(part) === "propose_filter_action" &&
          part.state === "output-available" &&
          !seenToolCallIds.current.has(part.toolCallId)
        ) {
          seenToolCallIds.current.add(part.toolCallId);

          const output = part.output as
            | {
                status: "awaiting_confirmation";
                proposedAction: {
                  id: string;
                  actionType: string;
                  categories?: string[];
                  platform?: string;
                  description: string;
                };
              }
            | { status: "invalid"; reason: string };

          // Server-side validation (against the page's real available
          // filters) rejected this proposal — no banner, the model will see
          // `reason` and explain the mismatch in its next text response
          // instead of falsely claiming the filter was applied.
          if (output.status !== "awaiting_confirmation") continue;

          const pa = output.proposedAction;
          let action: FilterAction;

          if (pa.actionType === "set_categories" && pa.categories?.length) {
            action = { type: "SET_CATEGORIES", categories: pa.categories };
          } else if (pa.actionType === "set_platform" && pa.platform) {
            action = { type: "SET_PLATFORM", platform: pa.platform };
          } else {
            action = { type: "CLEAR_FILTERS" };
          }

          const pending: PendingAction = {
            id: pa.id,
            action,
            description: pa.description,
          };
          proposePendingAction(pending);
        }
      }
    }
  }, [messages, proposePendingAction]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // ── Sending helpers ────────────────────────────────────────────────────────
  const sendWithContext = useCallback(
    (text: string, opts?: { includeAllWidgets?: boolean; forceFilterTool?: boolean }) => {
      // Pull the freshest data snapshot for the selected widget at send time.
      const entry = selectedWidget
        ? getWidgetData(selectedWidget.widgetId)
        : undefined;
      const liveWidget = selectedWidget
        ? {
            ...selectedWidget,
            dataPoints: entry?.dataPoints ?? selectedWidget.dataPoints,
            dataNote: entry?.prompt ?? selectedWidget.dataNote,
          }
        : null;
      // Page-level suggested prompts (no widget selected) attach ALL mounted
      // cards' live data so the AI can actually summarize / spot anomalies.
      const widgetsSnapshot =
        opts?.includeAllWidgets && !selectedWidget ? getAllWidgetData() : undefined;
      console.log("[copilot:client] sending", {
        text,
        pageContext,
        selectedWidget: liveWidget,
        widgetsSnapshot,
        forceFilterTool: opts?.forceFilterTool,
      });
      void sendMessage(
        { text },
        {
          body: {
            pageContext,
            selectedWidget: liveWidget,
            widgetsSnapshot,
            forceFilterTool: opts?.forceFilterTool,
          },
        },
      );
    },
    [sendMessage, pageContext, selectedWidget, getWidgetData, getAllWidgetData],
  );

  const handleClearSession = useCallback(() => {
    setMessages([]);
    setSelectedWidget(null);
    seenToolCallIds.current.clear();
  }, [setMessages, setSelectedWidget]);

  // ── Input state ────────────────────────────────────────────────────────────
  const [input, setInput] = useState("");

  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || isStreaming) return;
      setInput("");
      sendWithContext(text);
    },
    [input, isStreaming, sendWithContext],
  );

  // ── Derived context labels ─────────────────────────────────────────────────
  const filterLabel =
    pageContext.filters.categories.length > 0
      ? pageContext.filters.categories.join(", ")
      : "All";
  const platformLabel = pageContext.filters.platform
    ? ` · ${pageContext.filters.platform}`
    : "";

  return (
    <div
      className={`flex shrink-0 flex-col overflow-hidden bg-white transition-all duration-300 ease-in-out ${
        isPanelOpen ? "w-[380px] opacity-100" : "w-0 opacity-0"
      }`}
      style={{
        borderLeft: isPanelOpen ? "1px solid rgba(0,0,0,0.07)" : "none",
        boxShadow: isPanelOpen ? "-6px 0 32px rgba(0,0,0,0.07)" : "none",
        borderTopLeftRadius: "0rem",
        borderBottomLeftRadius: "0rem",
      }}
    >
      <div
        className={`flex h-full w-[380px] min-w-[380px] flex-col transition-opacity duration-200 ${
          isPanelOpen ? "opacity-100 delay-100" : "pointer-events-none opacity-0"
        }`}
      >
      {/* ── Header ── */}
      <div className="flex h-14 shrink-0 items-center justify-between px-7">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${B} 0%, #4ecdd0 100%)`,
              boxShadow: `0 3px 10px ${B}50`,
            }}
          >
            <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={1.8} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight text-slate-800">
              Copilot
            </span>
            <span
              className="mt-0.5 text-[9px] font-bold tracking-wide"
              style={{ color: B }}
            >
              BETA
            </span>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleClearSession}
            title="Clear session"
            className="rounded-xl p-1.5 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={togglePanel}
            title="Close"
            className="rounded-xl p-1.5 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Context + Selected Widget (no dividers, unified row) ── */}
      <div className="shrink-0 px-7 pb-3">
        <p className="text-xs text-slate-600">
          {pageContext.pageTitle}
          {filterLabel !== "All" && (
            <span className="text-slate-500"> · {filterLabel}</span>
          )}
          {platformLabel && <span className="text-slate-500">{platformLabel}</span>}
          {selectedWidget && (
            <>
              <span className="mx-1.5 text-slate-200">·</span>
              <span
                className="inline-flex items-center gap-1 font-medium"
                style={{ color: B }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full animate-pulse shrink-0"
                  style={{ background: B }}
                />
                {selectedWidget.title}
              </span>
              <button
                type="button"
                onClick={() => setSelectedWidget(null)}
                className="ml-1 align-middle text-slate-300 hover:text-slate-500 transition-colors"
              >
                <X className="inline h-3 w-3" />
              </button>
            </>
          )}
        </p>
      </div>

      {/* ── Messages ── */}
      <div
        className="flex-1 overflow-y-auto px-6 py-6 [scrollbar-width:thin] [scrollbar-color:#e2e8f0_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-300"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)",
        }}
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{
                background: `linear-gradient(135deg, ${B}1A 0%, ${B}0A 100%)`,
                border: `1.5px solid ${B}25`,
              }}
            >
              <Sparkles className="h-6 w-6" style={{ color: B }} strokeWidth={1.6} />
            </div>
            <div>
              <p className="mb-1 text-sm font-semibold text-slate-700">How can I help?</p>
              <p className="text-xs leading-relaxed text-slate-400 max-w-[200px]">
                Tap a suggestion below or type a question.
              </p>
            </div>
          </div>
        ) : (
          <MessageList messages={messages} isStreaming={isStreaming} />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Pending Action Banner ── */}
      {pendingAction && (
        <PendingActionBanner
          action={pendingAction}
          onConfirm={confirmPendingAction}
          onCancel={cancelPendingAction}
        />
      )}

      {/* ── Prompt Buttons ── */}
      <div className="shrink-0">
        <PromptButtons
          pageContext={pageContext}
          selectedWidget={selectedWidget}
          onSelect={(prompt, opts) =>
            sendWithContext(prompt, { includeAllWidgets: true, forceFilterTool: opts?.forceFilterTool })
          }
          disabled={isStreaming}
        />
      </div>

      {/* ── Input ── */}
      <div className="shrink-0 px-6 pb-6 pt-3">
        <form
          onSubmit={handleFormSubmit}
          className="flex items-center gap-2 rounded-2xl px-4 py-3"
          style={{
            background: "#f5f5f7",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the dashboard…"
            disabled={isStreaming}
            className="flex-1 bg-transparent text-sm leading-relaxed text-slate-800 placeholder-slate-400 outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-25"
            style={{
              background: `linear-gradient(135deg, ${B} 0%, #4ecdd0 100%)`,
              boxShadow: `0 2px 8px ${B}60`,
            }}
          >
            <ArrowUp className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
          </button>
        </form>
      </div>
      </div>
    </div>
  );
}
