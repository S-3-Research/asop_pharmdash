"use client";

import { useState } from "react";
import { BarChart2, LayoutList, MoreHorizontal } from "lucide-react";

import type { SocialMentionByApp } from "../../types";
import { useWidgetData } from "../../copilot/copilot-context";
import { APP_COLORS } from "./config";

interface MentionsChartCardProps {
  mentionsByApp: SocialMentionByApp[];
}

const MAX_ITEMS = 7;

function appColor(app: string): string {
  return APP_COLORS[app] ?? APP_COLORS.default;
}

export function MentionsChartCard({ mentionsByApp }: MentionsChartCardProps) {
  const [view, setView] = useState<"chart" | "table">("chart");

  useWidgetData(
    "social-mentions-by-app",
    mentionsByApp.map((m) => ({ label: m.app, value: m.count })),
    "Bar chart / table of external app names mentioned inside flagged social media posts (e.g. messaging or payment apps used to move the transaction off-platform). " +
      "The data points here contain ALL mentioned apps; the on-screen chart shows only the top 7. " +
      "Data source: text analysis of flagged post content in the published data release, after the page's category and platform filters.",
  );

  const top      = mentionsByApp.slice(0, MAX_ITEMS);
  const maxCount = Math.max(...top.map((d) => d.count), 1);
  const total    = top.reduce((s, d) => s + d.count, 0);

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col h-[380px]">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-gray-800 text-sm">Mentions by App</h3>
        <MoreHorizontal size={16} className="text-gray-400 cursor-pointer" />
      </div>

      {/* Toggle */}
      <div className="flex bg-gray-100 p-1 rounded-lg mb-4 w-max">
        <button
          onClick={() => setView("table")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            view === "table" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"
          }`}
        >
          <LayoutList size={13} /> Table
        </button>
        <button
          onClick={() => setView("chart")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            view === "chart" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"
          }`}
        >
          <BarChart2 size={13} /> Chart
        </button>
      </div>

      {view === "chart" ? (
        <div className="flex-1 flex flex-col gap-3 justify-center">
          {top.map(({ app, count }) => {
            const color = appColor(app);
            const pct   = (count / maxCount) * 100;
            return (
              <div key={app} className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500 w-20 text-right truncate flex-shrink-0">
                  {app}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-3.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-gray-700 w-7 text-right flex-shrink-0">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-gray-500 border-b border-gray-100">
              <tr>
                <th className="pb-2 font-medium">App</th>
                <th className="pb-2 font-medium text-right">Mentions</th>
                <th className="pb-2 font-medium text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {top.map(({ app, count }) => (
                <tr key={app} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 text-gray-700">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span
                        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: appColor(app) }}
                      />
                      {app}
                    </span>
                  </td>
                  <td className="py-2 text-right text-gray-700">{count}</td>
                  <td className="py-2 text-right text-gray-400 text-xs">
                    {total > 0 ? ((count / total) * 100).toFixed(1) : "0.0"}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
