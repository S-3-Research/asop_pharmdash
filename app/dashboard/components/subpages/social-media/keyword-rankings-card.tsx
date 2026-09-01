"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";

import type { SocialKeywordRanking } from "../../types";
import { useWidgetData } from "../../copilot/copilot-context";
import { KeyTakeaway, KEY_TAKEAWAY_SUPPRESSED } from "../../ui/key-takeaway";

interface KeywordRankingsCardProps {
  rankings: SocialKeywordRanking[];
  platform: string;
  /** Selected category ids (e.g. ["GLP-1"]) — kept for widget-context parity
   *  with the rest of the page, even though this card no longer fetches a
   *  separate raw-count lookup itself. */
  categories: string[];
}

const PAGE_SIZE = 4;

export function KeywordRankingsCard({ rankings }: KeywordRankingsCardProps) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(rankings.length / PAGE_SIZE));
  const start   = (page - 1) * PAGE_SIZE;
  const visible = rankings.slice(start, start + PAGE_SIZE);

  useWidgetData(
    "social-keyword-rankings",
    rankings.map((r) => ({
      label: r.keyword,
      value: `${r.signalCount} selling posts/comments${r.growthRate != null ? ` (growth ${r.growthRate}%)` : ""}`,
    })),
    "Paginated table ranking monitored keywords by RAW VOLUME — total selling posts/comments count — with growth rate vs the prior reporting period. " +
      "This ranks keywords by absolute output volume, which is different from the Keyword Performance chart on this page (which ranks by hit rate / search yield, i.e. signal share of raw search results) — a keyword can rank high here on volume alone while having a low hit rate, or vice versa. " +
      "Growth rate shows how a keyword's volume is trending period over period, which can signal emerging or declining illicit-seller activity/language for that term. " +
      "The data points here contain the COMPLETE keyword ranking (all pages), not just the visible page. " +
      "Data source: keyword aggregates from the published data release, after the page's category/platform filter selection.",
  );

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800 text-sm">Keyword Rankings</h3>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-gray-500 border-b border-gray-100">
            <tr>
              <th className="pb-3 font-medium">Keyword</th>
              <th className="pb-3 font-medium text-right whitespace-nowrap w-px">Selling Content</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.keyword} className="border-b border-gray-50 last:border-0">
                <td className="py-2.5 w-full max-w-0">
                  <span
                    title={row.keyword}
                    className="inline-block max-w-full truncate align-middle px-2 py-1 rounded-md text-xs font-semibold"
                    style={{ backgroundColor: row.color + "22", color: row.color }}
                  >
                    {row.keyword}
                  </span>
                </td>
                <td className="py-2.5 text-right">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-gray-700 font-medium text-xs">{row.signalCount}</span>
                    {row.growthRate !== null ? (
                      <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-600">
                        <ArrowUp size={10} /> {row.growthRate}%
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium bg-gray-50 text-gray-400">
                        -%
                      </span>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-0 pt-3 flex flex-nowrap justify-between items-center gap-3 text-xs text-gray-400">
        <span className="truncate min-w-0">
          Showing {start + 1}–{Math.min(start + PAGE_SIZE, rankings.length)} of {rankings.length}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="cursor-pointer disabled:opacity-30 hover:text-gray-600"
          >
            &lt;
          </button>
          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">{page}</span>
          <span>of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="cursor-pointer font-bold text-gray-600 disabled:opacity-30"
          >
            &gt;
          </button>
        </div>
      </div>

      {!KEY_TAKEAWAY_SUPPRESSED && (
        <div className="mt-3 border-t border-gray-100 pt-2.5">
          <KeyTakeaway>
            3 keywords show rising selling posts/comments this period. (example data)
          </KeyTakeaway>
        </div>
      )}
    </div>
  );
}

