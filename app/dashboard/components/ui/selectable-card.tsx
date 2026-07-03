"use client";

import type { ReactNode } from "react";

import { useCopilot } from "../copilot/copilot-context";
import type { SelectedWidget } from "../copilot/types";

interface SelectableCardProps {
  widget: SelectedWidget;
  children: ReactNode;
  className?: string;
}

/**
 * Thin wrapper that makes any card selectable.
 * Clicking it sets the widget in the CopilotContext and opens the panel.
 */
export function SelectableCard({
  widget,
  children,
  className,
}: SelectableCardProps) {
  const { selectedWidget, setSelectedWidget, openPanel } = useCopilot();
  const isSelected = selectedWidget?.widgetId === widget.widgetId;

  const handleSelect = () => {
    if (isSelected) {
      setSelectedWidget(null);
    } else {
      setSelectedWidget(widget);
      openPanel();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSelect();
        }
      }}
      title={isSelected ? "Deselect card" : "Select for Copilot"}
      className={`cursor-pointer rounded-xl outline-none transition-all focus-visible:ring-2 focus-visible:ring-indigo-400 ${
        isSelected
          ? "ring-2 ring-indigo-400 ring-offset-2"
          : "hover:ring-1 hover:ring-indigo-200 hover:ring-offset-1"
      } ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
