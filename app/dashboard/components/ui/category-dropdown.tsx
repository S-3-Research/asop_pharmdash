"use client";

import { useState } from "react";
import type { CategoryOption } from "../types";

interface CategoryDropdownProps {
  categories: CategoryOption[];
  selectedId?: string;
  onSelect: (categoryId: string) => void;
}

export function CategoryDropdown({
  categories,
  selectedId = "all",
  onSelect,
}: CategoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedCategory = categories.find((c) => c.id === selectedId);

  return (
    <div className="relative inline-block w-full max-w-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 text-left bg-white border border-slate-200 rounded-lg hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 flex items-center justify-between"
      >
        <span className="text-sm font-medium text-slate-700">
          {selectedCategory?.name || "All Categories"}
        </span>
        <svg
          className={`w-4 h-4 text-slate-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
          <div className="max-h-64 overflow-y-auto">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  onSelect(category.id);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                  selectedId === category.id
                    ? "bg-slate-100"
                    : "hover:bg-slate-50"
                } ${category.id === "all" ? "border-b border-slate-200" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {category.color && (
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                    )}
                    <span
                      className={
                        category.isTop
                          ? "font-semibold text-slate-900"
                          : "text-slate-700"
                      }
                    >
                      {category.name}
                    </span>
                  </div>
                  {category.isTop && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      TOP 1
                    </span>
                  )}
                  {selectedId === category.id && (
                    <svg
                      className="w-4 h-4 text-slate-900"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
