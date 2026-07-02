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

export function MultiCategoryDropdown({
  categories,
  selectedIds,
  onToggle,
  onClear,
}: MultiCategoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
    <div ref={ref} className="flex flex-wrap items-center gap-2 justify-end">
      {/* Selected pills */}
      {selectedIds.map((id) => {
        const cat = categories.find((c) => c.id === id);
        if (!cat) return null;
        return (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm"
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

      {/* Dropdown trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          {label}
          <svg
            className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full z-30 mt-1.5 w-52 rounded-lg border border-slate-200 bg-white shadow-lg">
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
