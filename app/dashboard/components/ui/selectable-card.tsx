"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info, Maximize2, Sparkles, X } from "lucide-react";

import { useCopilot } from "../copilot/copilot-context";
import type { SelectedWidget } from "../copilot/types";

const B = "#64D6D8"; // Copilot brand color (matches panel header / top-nav button)

interface SelectableCardProps {
  widget: SelectedWidget;
  children: ReactNode;
  className?: string;
  /** Opt-in: shows a "maximize" button that pops the card's content into a
   *  large modal (useful for charts/tables/maps that benefit from more
   *  screen space). Off by default — most cards (e.g. small metric cards)
   *  don't need it. */
  expandable?: boolean;
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
  expandable = false,
}: SelectableCardProps) {
  const { selectedWidget, setSelectedWidget, openPanel, pageContext } = useCopilot();
  const isSelected = selectedWidget?.widgetId === widget.widgetId;
  const [showInfo, setShowInfo] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const infoWrapRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

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

  // Lock body scroll while the modal is open, and let Escape close it —
  // mirrors common modal UX conventions used elsewhere in the app.
  useEffect(() => {
    if (!expanded) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);

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

  // Separate state for the modal's own Info button — kept independent from
  // the inline card's Info button/tooltip above so the two can't clash
  // (e.g. hovering one while the other is mid-transition).
  const [showModalInfo, setShowModalInfo] = useState(false);
  const [modalTooltipPos, setModalTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const modalInfoWrapRef = useRef<HTMLDivElement>(null);
  const showModalTooltip = () => {
    const rect = modalInfoWrapRef.current?.getBoundingClientRect();
    if (rect) {
      const left = Math.min(
        Math.max(rect.right - TOOLTIP_WIDTH, 8),
        window.innerWidth - TOOLTIP_WIDTH - 8,
      );
      setModalTooltipPos({ top: rect.bottom + 8, left });
    }
    setShowModalInfo(true);
  };
  const hideModalTooltip = () => setShowModalInfo(false);

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
      {/* While expanded, children render only inside the modal (below) — not
       *  here — so there's a single live instance of the card's content and
       *  its internal state (pagination, tabs, chart hover, etc.) stays
       *  continuous across expand/collapse. No placeholder is rendered in
       *  its place: every card in this app sits inside an ancestor with an
       *  explicit fixed height/row-height (h-[Npx] / auto-rows-[Npx]), so an
       *  empty child here doesn't collapse or reflow the surrounding grid. */}
      {!expanded && children}

      {/* ── Maximize trigger icon (visible on hover) — pops content into a modal ── */}
      {expandable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
          }}
          title="Expand"
          className={`absolute right-[78px] top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-lg transition-all active:scale-95 ${
            "opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100"
          }`}
          style={{
            background: "#ffffff",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}
        >
          <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.8} style={{ color: "#6b7280" }} />
        </button>
      )}

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

      {/* ── Expanded modal — same content, single live instance ── */}
      {expanded &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={widget.title}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 sm:p-8"
            onClick={() => setExpanded(false)}
          >
            <div
              className="relative flex h-[85vh] w-[90vw] max-w-6xl flex-col rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Info trigger (same look as the inline card's Info button) ── */}
              {infoText && (
                <div
                  ref={modalInfoWrapRef}
                  className="absolute right-12 top-3 z-10"
                  onMouseEnter={showModalTooltip}
                  onMouseLeave={hideModalTooltip}
                >
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    title="About this widget"
                    className="flex h-7 w-7 items-center justify-center rounded-lg transition-all active:scale-95"
                    style={{
                      background: "#ffffff",
                      border: "1px solid rgba(0,0,0,0.08)",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    }}
                  >
                    <Info className="h-3.5 w-3.5" strokeWidth={1.8} style={{ color: "#6b7280" }} />
                  </button>

                  {showModalInfo &&
                    modalTooltipPos &&
                    typeof document !== "undefined" &&
                    createPortal(
                      <div
                        role="tooltip"
                        className="fixed z-[10000] w-64 rounded-lg p-3 text-xs leading-relaxed text-white shadow-lg"
                        style={{
                          top: modalTooltipPos.top,
                          left: modalTooltipPos.left,
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

              <button
                type="button"
                onClick={() => setExpanded(false)}
                title="Close"
                className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg transition-all active:scale-95"
                style={{
                  background: "#ffffff",
                  border: "1px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                }}
              >
                <X className="h-4 w-4" strokeWidth={1.8} style={{ color: "#6b7280" }} />
              </button>
              <div className="min-h-0 flex-1 overflow-auto p-15">{children}</div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
