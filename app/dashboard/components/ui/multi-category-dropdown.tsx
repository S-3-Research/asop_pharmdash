"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import type { CategoryOption } from "../types";

interface MultiCategoryDropdownProps {
  categories: CategoryOption[];          // excludes the "all" sentinel
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}

// Max number of selection pills to render before collapsing the rest into
// a single "+N" pill (hover for the full list via tooltip).
const MAX_VISIBLE_PILLS = 2;

export function MultiCategoryDropdown({
  categories,
  selectedIds,
  onToggle,
  onClear,
}: MultiCategoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const visibleIds = selectedIds.slice(0, MAX_VISIBLE_PILLS);
  const overflowIds = selectedIds.slice(MAX_VISIBLE_PILLS);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const label =
    selectedIds.length === 0
      ? "All Categories"
      : selectedIds.length === 1
        ? (categories.find((c) => c.id === selectedIds[0])?.name ?? "1 selected")
        : `${selectedIds.length} selected`;

  return (
    <div ref={ref} className="flex w-full flex-nowrap items-center justify-end gap-1.5">
      {/* Selected pills: normal-flow flex items (not absolutely positioned),
          placed before the trigger so they visually extend to its left.
          Only the first MAX_VISIBLE_PILLS are rendered directly; anything
          beyond that collapses into a single "+N" pill with a hover
          tooltip, so this row never wraps or pushes sibling elements. */}
      {visibleIds.map((id) => {
        const cat = categories.find((c) => c.id === id);
        if (!cat) return null;
        return (
          <span
            key={id}
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm"
          >
            {cat.color && (
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: cat.color }}
              />
            )}
            {cat.name}
            <button
              type="button"
              onClick={() => onToggle(id)}
              className="ml-0.5 text-slate-400 hover:text-slate-700"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}

      {overflowIds.length > 0 && (
        <span className="group relative inline-flex items-center whitespace-nowrap rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm">
          +{overflowIds.length}

          {/* Tooltip: lists the overflowed categories, each removable. */}
          <div className="invisible absolute bottom-full right-0 z-40 mb-1.5 w-max max-w-[16rem] rounded-lg border border-slate-200 bg-white p-1.5 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100">
            <ul className="flex flex-col gap-0.5">
              {overflowIds.map((id) => {
                const cat = categories.find((c) => c.id === id);
                if (!cat) return null;
                return (
                  <li
                    key={id}
                    className="flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    {cat.color && (
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                    )}
                    <span className="flex-1 whitespace-nowrap text-left">{cat.name}</span>
                    <button
                      type="button"
                      onClick={() => onToggle(id)}
                      className="shrink-0 text-slate-400 hover:text-slate-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </span>
      )}

      {/* Dropdown trigger: fixed width so it never grows/shrinks based on
          how many selection pills are rendered to its left. Matches the
          20rem (min-w-xs) width used by the single-select CategoryDropdown
          on the Top Products page. */}
      <div className="relative w-80 shrink-0">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2 rounded-lg border border-slate-200 bg-white shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <span className="text-sm font-medium text-slate-700">{label}</span>
          <svg
            className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1.5 rounded-lg border border-slate-200 bg-white shadow-lg">
            <ul className="max-h-60 overflow-y-auto py-1">
              {categories.map((cat) => {
                const checked = selectedIds.includes(cat.id);
                return (
                  <li key={cat.id}>
                    <button
                      type="button"
                      onClick={() => onToggle(cat.id)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
                        checked ? "text-slate-900" : "text-slate-600"
                      }`}
                    >
                      {/* Checkbox */}
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          checked
                            ? "border-transparent bg-slate-700 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {checked && (
                          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-current">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>

                      {/* Color dot */}
                      {cat.color && (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                      )}

                      <span className={cat.isTop ? "font-semibold" : ""}>{cat.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {selectedIds.length > 0 && (
              <div className="border-t border-slate-100 px-3 py-2">
                <button
                  type="button"
                  onClick={() => { onClear(); setIsOpen(false); }}
                  className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
