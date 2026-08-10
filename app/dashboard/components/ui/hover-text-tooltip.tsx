"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface HoverTextTooltipProps {
  /** Trigger element — typically the truncated/clamped text node. */
  children: ReactNode;
  /** Rich content rendered inside the tooltip (full text, keyword chips, etc). */
  content: ReactNode;
  className?: string;
}

/**
 * Wraps `children` and shows a rich, non-clipped tooltip on hover/focus.
 *
 * Rendered via a React portal into `document.body` so it is never cut off by
 * an ancestor's `overflow: hidden` (e.g. a scrollable card list) — the same
 * reasoning as Highcharts' `tooltip.outside` option.
 */
export function HoverTextTooltip({ children, content, className }: HoverTextTooltipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; openUp: boolean }>({
    top: 0,
    left: 0,
    openUp: false,
  });
  const triggerRef = useRef<HTMLDivElement>(null);

  const show = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const openUp = rect.top > window.innerHeight / 2;
    setPos({
      top: openUp ? rect.top - 8 : rect.bottom + 8,
      left: Math.min(Math.max(rect.left, 12), window.innerWidth - 12),
      openUp,
    });
    setOpen(true);
  };
  const hide = () => setOpen(false);

  return (
    <div
      ref={triggerRef}
      className={className}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      tabIndex={0}
    >
      {children}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[100] w-80 max-w-[calc(100vw-24px)] rounded-xl border border-gray-100 bg-white p-3.5 shadow-xl"
            style={{
              top: pos.top,
              left: pos.left,
              transform: pos.openUp ? "translateY(-100%)" : undefined,
            }}
            role="tooltip"
          >
            {content}
          </div>,
          document.body,
        )}
    </div>
  );
}
