"use client";

import { isTextUIPart, isDynamicToolUIPart, type UIMessage } from "ai";
import { Loader2 } from "lucide-react";

const B = "#64D6D8";

// ── Tool call status ──────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  propose_filter_action: "Analyzing filters",
};

function ToolStatus({
  toolName,
  state,
}: {
  toolName: string;
  state: string;
}) {
  const label = TOOL_LABELS[toolName] ?? `Using ${toolName}`;
  const isDone = state === "output-available" || state === "output-error";

  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{
        background: isDone ? "rgba(0,0,0,0.04)" : `${B}14`,
        color: isDone ? "#94a3b8" : B,
        border: isDone ? "1px solid rgba(0,0,0,0.06)" : `1px solid ${B}30`,
      }}
    >
      {isDone ? (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-300" />
      ) : (
        <Loader2 className="h-3 w-3 animate-spin" style={{ color: B }} />
      )}
      {isDone ? `Done: ${label}` : `${label}…`}
    </div>
  );
}

// ── Minimal markdown renderer ─────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        if (line.startsWith("### "))
          return (
            <p key={i} className="mt-2 mb-0.5 text-[12px] font-semibold text-slate-800">
              {line.slice(4)}
            </p>
          );
        if (line.startsWith("## "))
          return (
            <p key={i} className="mt-2 mb-0.5 text-[12px] font-semibold text-slate-700">
              {line.slice(3)}
            </p>
          );
        if (line.startsWith("# "))
          return (
            <p key={i} className="mt-2 mb-0.5 text-[12px] font-bold text-slate-800">
              {line.slice(2)}
            </p>
          );
        if (line.startsWith("- ") || line.startsWith("* "))
          return (
            <div key={i} className="flex gap-1.5 text-[12px] leading-relaxed">
              <span className="mt-0.5 shrink-0 text-slate-300">•</span>
              <span className="text-slate-700">{renderInline(line.slice(2))}</span>
            </div>
          );
        if (line === "") return <div key={i} className="h-1.5" />;
        return (
          <p key={i} className="text-[12px] leading-relaxed text-slate-700">
            {renderInline(line)}
          </p>
        );
      })}
    </>
  );
}

// ── Message List ──────────────────────────────────────────────────────────────

interface MessageListProps {
  messages: UIMessage[];
  isStreaming?: boolean;
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  return (
    <div className="flex flex-col gap-3">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          {msg.role === "user" ? (
            <div
              className="max-w-[82%] rounded-2xl rounded-tr-md px-3.5 py-2.5 text-[12px] text-white leading-relaxed"
              style={{
                background: `linear-gradient(135deg, ${B} 0%, #4ecdd0 100%)`,
                boxShadow: `0 2px 12px ${B}40`,
              }}
            >
              {msg.parts
                .filter(isTextUIPart)
                .map((p) => p.text)
                .join("")}
            </div>
          ) : (
            <div className="max-w-[92%] space-y-1.5">
              {/* Tool call status badges */}
              {msg.parts.filter(isDynamicToolUIPart).map((part) => (
                <ToolStatus
                  key={part.toolCallId}
                  toolName={part.toolName}
                  state={part.state}
                />
              ))}

              {/* Text content */}
              {(() => {
                const textContent = msg.parts
                  .filter(isTextUIPart)
                  .map((p) => p.text)
                  .join("");
                return textContent ? (
                  <div
                    className="rounded-2xl rounded-tl-md px-3.5 py-2.5"
                    style={{
                      background: "rgba(255,255,255,0.85)",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      border: "1px solid rgba(0,0,0,0.06)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                    }}
                  >
                    <FormattedText text={textContent} />
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>
      ))}

      {/* Typing indicator */}
      {isStreaming && (
        <div className="flex justify-start">
          <div
            className="rounded-2xl rounded-tl-md px-4 py-3"
            style={{
              background: "rgba(255,255,255,0.85)",
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
            <div className="flex gap-1.5">
              {[0, 140, 280].map((delay) => (
                <span
                  key={delay}
                  className="inline-block h-1.5 w-1.5 animate-bounce rounded-full"
                  style={{ background: B, animationDelay: `${delay}ms`, opacity: 0.7 }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
