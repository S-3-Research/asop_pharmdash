"use client";

import type { PageContext, SelectedWidget } from "./types";

interface PromptButtonsProps {
  pageContext: PageContext;
  selectedWidget: SelectedWidget | null;
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

interface PromptButton {
  id: string;
  label: string;
  prompt: string;
  icon: string;
}

function buildPrompts(
  page: PageContext,
  widget: SelectedWidget | null,
): PromptButton[] {
  // ── No widget selected: page-level prompts ──
  if (!widget) {
    const base: PromptButton[] = [
      {
        id: "summarize",
        label: "Summarize dashboard",
        prompt:
          "Please summarize the current dashboard state and highlight any notable trends or concerns.",
        icon: "📊",
      },
      {
        id: "suggest-filters",
        label: "Suggest filters",
        prompt:
          "Based on the current data, what filters would you suggest to focus the analysis on the most important signals?",
        icon: "🔍",
      },
      {
        id: "anomaly",
        label: "Any anomalies?",
        prompt:
          "Are there any anomalies or unusual patterns in the current data that warrant immediate investigation?",
        icon: "⚠️",
      },
    ];

    if (page.page === "social-media-insights") {
      base.push({
        id: "top-keywords",
        label: "Top keyword signals",
        prompt:
          "Which keywords are showing the strongest growth signals right now? Rank them and explain why.",
        icon: "🔑",
      });
    }

    if (page.page === "domain-insights") {
      base.push({
        id: "risky-domains",
        label: "Highest-risk domains",
        prompt:
          "Which domain types or registrars show the highest risk concentration? What patterns stand out?",
        icon: "🚨",
      });
    }

    if (page.page === "top-products") {
      base.push({
        id: "category-breakdown",
        label: "Category breakdown",
        prompt:
          "Break down the current listing distribution by category. Which categories are most active and why?",
        icon: "📦",
      });
    }

    return base;
  }

  // ── Widget selected: context-specific prompts ──
  const prompts: PromptButton[] = [
    {
      id: "explain",
      label: "Explain this card",
      prompt: `Explain the "${widget.title}" card — what it measures, what the current values mean, and what they imply.`,
      icon: "💡",
    },
    {
      id: "why-changed",
      label: "Why did this change?",
      prompt: `What factors might explain the current values in "${widget.title}"? Analyze the trend and suggest possible causes.`,
      icon: "❓",
    },
  ];

  if (widget.type === "metric-card") {
    prompts.push({
      id: "next-steps",
      label: "Suggest next steps",
      prompt: `Given the current value of "${widget.title}", what actions should the surveillance team prioritize?`,
      icon: "→",
    });
  }

  if (widget.type === "chart" || widget.type === "distribution") {
    prompts.push({
      id: "suggest-filter",
      label: "Suggest a filter",
      prompt: `Based on the "${widget.title}" chart, what filter change would help dig deeper into this data? Propose a specific filter.`,
      icon: "🔍",
    });
  }

  if (widget.type === "ranked-list") {
    prompts.push({
      id: "top-item",
      label: "Why is #1 leading?",
      prompt: `Why is the top item in the "${widget.title}" list leading? What makes it stand out from the others?`,
      icon: "🏆",
    });
  }

  // Always include email draft
  prompts.push({
    id: "email",
    label: "Draft email",
    prompt: `Draft a concise email summary about the "${widget.title}" for a stakeholder. Include the key numbers and 2–3 recommended actions.`,
    icon: "✉️",
  });

  return prompts;
}

export function PromptButtons({
  pageContext,
  selectedWidget,
  onSelect,
  disabled,
}: PromptButtonsProps) {
  const prompts = buildPrompts(pageContext, selectedWidget);

  return (
    <div className="flex flex-wrap gap-1.5 px-5 py-2">
      {prompts.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(p.prompt)}
          className="group flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-slate-500 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: "#f5f5f7",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#64D6D814";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#64D6D840";
            (e.currentTarget as HTMLButtonElement).style.color = "#64D6D8";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.65)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,0,0,0.08)";
            (e.currentTarget as HTMLButtonElement).style.color = "#475569";
          }}
        >
          <span role="img" aria-hidden className="text-[10px]">
            {p.icon}
          </span>
          {p.label}
        </button>
      ))}
    </div>
  );
}
