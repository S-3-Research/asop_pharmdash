"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface MethodologySection {
  title: string;
  body: string;
}

const SECTIONS: MethodologySection[] = [
  {
    title: "Scope of Project",
    body:
      "This dashboard surveils illegal online sale of prescription medications across two drug " +
      "categories — metabolic and cancer medications — spanning rogue e-commerce " +
      "domains and major social-media platforms. Monitoring is ongoing across successive rolling " +
      "3-month reporting periods.",
  },
  {
    title: "General Method",
    body:
      "Listings are discovered via automated keyword/marketplace crawling and platform search, then " +
      "classified into a primary drug category and a specific product (secondary category). Each " +
      "listing is tagged to the reporting period in which it was observed, then aggregated for the " +
      "counts, rankings, and trends shown throughout this page.",
  },
  {
    title: "Disclaimer",
    body:
      "Figures reflect only what could be publicly discovered and classified at the time of scanning; " +
      "domain/account status, pricing, and availability can change at any time. Inclusion in this " +
      "dashboard is not a legal determination of wrongdoing and should not be relied upon as such.",
  },
];

export function MethodologyCard() {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
      >
        <span className="text-sm font-semibold text-slate-800">
          Scope, Method &amp; Disclaimer
        </span>
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        className={`grid transition-all duration-200 ease-in-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3 border-t border-gray-100 px-4 pb-4 pt-3">
            {SECTIONS.map((s) => (
              <div key={s.title}>
                <h4 className="text-xs font-semibold text-slate-700">{s.title}</h4>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
