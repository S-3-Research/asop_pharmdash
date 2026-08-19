"use client";

import { isTextUIPart, isToolUIPart, getToolName, type UIMessage } from "ai";
import { Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

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

// ── Markdown renderer (GFM: tables, lists, headings, bold, etc.) ──────────────

const markdownComponents: Components = {
  h1: ({ children }) => (
    <p className="mt-2 mb-0.5 text-[12px] font-bold text-slate-900">{children}</p>
  ),
  h2: ({ children }) => (
    <p className="mt-2 mb-0.5 text-[12px] font-semibold text-slate-800">{children}</p>
  ),
  h3: ({ children }) => (
    <p className="mt-2 mb-0.5 text-[12px] font-semibold text-slate-900">{children}</p>
  ),
  h4: ({ children }) => (
    <p className="mt-1.5 mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
      {children}
    </p>
  ),
  p: ({ children }) => (
    <p className="text-[12px] leading-relaxed text-slate-800">{children}</p>
  ),
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  ul: ({ children }) => <ul className="my-1 list-disc space-y-0.5 pl-4 text-[12px] leading-relaxed text-slate-800">{children}</ul>,
  ol: ({ children }) => <ol className="my-1 list-decimal space-y-0.5 pl-4 text-[12px] leading-relaxed text-slate-800">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="underline" style={{ color: B }}>
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-black/[0.06] px-1 py-0.5 text-[11px] text-slate-800">{children}</code>
  ),
  hr: () => <hr className="my-2 border-black/[0.08]" />,
  table: ({ children }) => (
    <div className="my-1.5 overflow-x-auto rounded-lg border border-black/[0.07]">
      <table className="w-full border-collapse text-[11px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-black/[0.03]">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="even:bg-black/[0.015]">{children}</tr>,
  th: ({ children }) => (
    <th className="border-b border-black/[0.07] px-2 py-1.5 text-left font-semibold text-slate-700">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-black/[0.05] px-2 py-1.5 text-slate-800 last:border-b-0">
      {children}
    </td>
  ),
};

function FormattedText({ text }: { text: string }) {
  return (
    <div className="space-y-0.5">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

// ── Message List ──────────────────────────────────────────────────────────────

interface MessageListProps {
  messages: UIMessage[];
  isStreaming?: boolean;
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  return (
    <div className="flex flex-col gap-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          id={`copilot-msg-${msg.id}`}
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
              {msg.parts.filter(isToolUIPart).map((part) => (
                <ToolStatus
                  key={part.toolCallId}
                  toolName={getToolName(part)}
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
                      background: "#FeFeFe",
                      border: "1px solid rgba(0,0,0,0.09)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
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
              background: "#F5F5F5",
              border: "1px solid rgba(0,0,0,0.09)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
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
