"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info, Sparkles } from "lucide-react";

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
  const { selectedWidget, setSelectedWidget, openPanel, pageContext } = useCopilot();
  const isSelected = selectedWidget?.widgetId === widget.widgetId;
  const [showInfo, setShowInfo] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const infoWrapRef = useRef<HTMLDivElement>(null);

  // NOTE: no snapshot syncing needed — the Copilot panel pulls live
  // dataPoints from the widget-data registry (useWidgetData) at send time.

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelected) {
      setSelectedWidget(null);
    } else {
      setSelectedWidget(widget);
      openPanel();
    }
  };

  // The Info tooltip shows the card's short, customer-facing `description`
  // (plain language, no data-source/pipeline detail) — a distinct, simpler
  // piece of copy from the longer technical `prompt` a card publishes via
  // useWidgetData() for Copilot's own reasoning.
  const infoText = widget.description;

  const reportingPeriod =
    pageContext.reportingPeriodDisplayName ||
    (pageContext.reportingPeriod && pageContext.reportingPeriod !== "mock-data"
      ? pageContext.reportingPeriod
      : null);

  const TOOLTIP_WIDTH = 256; // w-64

  // Renders in a document.body portal with viewport-fixed coordinates, so it
  // can never be clipped by an ancestor's `overflow-y-auto` (like <main> in
  // dashboard-shell.tsx, which — per the CSS overflow spec — also clips the
  // X axis once overflow-y is non-visible) or visually covered by the
  // sidebar's own stacking context. Position is computed from the info
  // button's live bounding rect and clamped to stay within the viewport.
  const showTooltip = () => {
    const rect = infoWrapRef.current?.getBoundingClientRect();
    if (rect) {
      const left = Math.min(
        Math.max(rect.right - TOOLTIP_WIDTH, 8),
        window.innerWidth - TOOLTIP_WIDTH - 8,
      );
      setTooltipPos({ top: rect.bottom + 8, left });
    }
    setShowInfo(true);
  };
  const hideTooltip = () => setShowInfo(false);

  return (
    <div
      className={`group/card relative rounded-xl transition-all ${
        isSelected ? "ring-2 ring-offset-2" : ""
      } ${className ?? ""}`}
      style={
        isSelected
          ? ({ "--tw-ring-color": B } as React.CSSProperties)
          : undefined
      }
    >
      {children}

      {/* ── Info trigger icon (visible on hover) — explains data source / metric meaning ── */}
      {infoText && (
        <div
          ref={infoWrapRef}
          className="absolute right-11 top-2.5 z-10"
          onMouseEnter={showTooltip}
          onMouseLeave={hideTooltip}
        >
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            title="About this widget"
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all active:scale-95 ${
              showInfo
                ? "opacity-100"
                : "opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100"
            }`}
            style={{
              background: "#ffffff",
              border: "1px solid rgba(0,0,0,0.08)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            }}
          >
            <Info className="h-3.5 w-3.5" strokeWidth={1.8} style={{ color: "#6b7280" }} />
          </button>

          {showInfo &&
            tooltipPos &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                role="tooltip"
                className="fixed z-[9999] w-64 rounded-lg p-3 text-xs leading-relaxed text-white shadow-lg"
                style={{
                  top: tooltipPos.top,
                  left: tooltipPos.left,
                  background: "rgba(17,24,39,0.97)",
                }}
              >
                <div className="mb-1 font-semibold" style={{ color: B }}>
                  {widget.title}
                </div>
                <p className="whitespace-pre-line text-gray-100">{infoText}</p>
                {reportingPeriod && (
                  <div className="mt-2 border-t border-white/10 pt-1.5 text-[11px] text-gray-400">
                    Reporting period: <span className="text-gray-200">{reportingPeriod}</span>
                  </div>
                )}
              </div>,
              document.body,
            )}
        </div>
      )}

      {/* ── Copilot trigger icon (visible on hover, or when selected) ── */}
      <button
        type="button"
        onClick={handleToggle}
        title={isSelected ? "Deselect from Copilot" : "Ask Copilot about this card"}
        aria-pressed={isSelected}
        className={`absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-lg transition-all active:scale-95 ${
          isSelected
            ? "opacity-100"
            : "opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100"
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
