"use client";

import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

import { useCopilot } from "../copilot/copilot-context";
import type { SelectedWidget } from "../copilot/types";

const B = "#64D6D8"; // Copilot brand color (matches panel header / top-nav button)

interface SelectableCardProps {
  widget: SelectedWidget;
  children: ReactNode;
  className?: string;
}

/**
 * Thin wrapper that makes any card selectable for Copilot.
 *
 * Selection is triggered ONLY by the Sparkles icon in the top-right corner —
 * clicks anywhere else in the card (charts, tabs, buttons…) are left alone so
 * chart interactions never accidentally open the Copilot panel.
 */
export function SelectableCard({
  widget,
  children,
  className,
}: SelectableCardProps) {
  const { selectedWidget, setSelectedWidget, openPanel } = useCopilot();
  const isSelected = selectedWidget?.widgetId === widget.widgetId;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelected) {
      setSelectedWidget(null);
    } else {
      setSelectedWidget(widget);
      openPanel();
    }
  };

  return (
    <div
      className={`group relative rounded-xl transition-all ${
        isSelected ? "ring-2 ring-offset-2" : ""
      } ${className ?? ""}`}
      style={
        isSelected
          ? ({ "--tw-ring-color": B } as React.CSSProperties)
          : undefined
      }
    >
      {children}

      {/* ── Copilot trigger icon (visible on hover, or when selected) ── */}
      <button
        type="button"
        onClick={handleToggle}
        title={isSelected ? "Deselect from Copilot" : "Ask Copilot about this card"}
        aria-pressed={isSelected}
        className={`absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-lg transition-all active:scale-95 ${
          isSelected
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        }`}
        style={
          isSelected
            ? {
                background: `linear-gradient(135deg, ${B} 0%, #4ecdd0 100%)`,
                boxShadow: `0 2px 8px ${B}50`,
              }
            : {
                background: "#ffffff",
                border: "1px solid rgba(0,0,0,0.08)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              }
        }
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.background = `${B}1A`;
            e.currentTarget.style.borderColor = `${B}60`;
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.background = "#ffffff";
            e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)";
          }
        }}
      >
        <Sparkles
          className="h-3.5 w-3.5"
          strokeWidth={1.8}
          style={{ color: isSelected ? "#ffffff" : B }}
        />
      </button>
    </div>
  );
}
