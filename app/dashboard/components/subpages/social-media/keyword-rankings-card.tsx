"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";
import useSWR from "swr";

import type { SocialKeywordCountPayload, SocialKeywordRanking } from "../../types";
import { useWidgetData } from "../../copilot/copilot-context";

interface KeywordRankingsCardProps {
  rankings: SocialKeywordRanking[];
  platform: string;
  /** Selected category ids (e.g. ["GLP-1"]) — forwarded to the raw-count
   *  lookup so it matches the same category filter used to build `rankings`. */
  categories: string[];
}

const PAGE_SIZE = 4;

const countFetcher = (url: string) =>
  fetch(url).then((r) => r.json() as Promise<SocialKeywordCountPayload>);

export function KeywordRankingsCard({ rankings, platform, categories }: KeywordRankingsCardProps) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(rankings.length / PAGE_SIZE));
  const start   = (page - 1) * PAGE_SIZE;
  const visible = rankings.slice(start, start + PAGE_SIZE);

  // Fetch rawCount for the keywords visible on the current page
  const pageKeywords = visible.map((r) => r.keyword).join(",");
  const kwParams = new URLSearchParams({ keywords: pageKeywords });
  if (platform !== "all") kwParams.set("platform", platform);
  if (categories.length > 0) kwParams.set("categories", categories.join(","));

  const { data: countData } = useSWR<SocialKeywordCountPayload>(
    pageKeywords ? `/api/social-media/keyword-count?${kwParams}` : null,
    countFetcher,
    { revalidateOnFocus: false },
  );

  const rawCountMap = new Map(
    (countData?.results ?? []).map((r) => [r.keyword, r.rawCount]),
  );

  useWidgetData(
    "social-keyword-rankings",
    rankings.map((r) => {
      const rawCount = rawCountMap.get(r.keyword);
      const ratioPart =
        rawCount != null && rawCount > 0
          ? `, ratio ${((r.signalCount / rawCount) * 100).toFixed(1)}% of ${rawCount} raw hits`
          : rawCount === 0
            ? ", raw hits: 0"
            : "";
      return {
        label: r.keyword,
        value: `${r.signalCount} signals${ratioPart}${r.growthRate != null ? ` (growth ${r.growthRate}%)` : ""}`,
      };
    }),
    "Paginated table ranking monitored keywords by signal count, with growth rate vs the prior period and a raw-mention count fetched per keyword. " +
      "Meaning: for each keyword, we search that platform using the keyword and retrieve a set of 'raw' results/mentions (rawCount); " +
      "'signalCount' is the number of those raw results that were detected/classified as illegal-selling signals (e.g. rogue pharmacy listings or solicitations). " +
      "So rawCount is the total search hits for the keyword, and signalCount is the subset flagged as actual illegal-selling signals within that raw data. " +
      "IMPORTANT for prioritization: what matters most is the RELATIVE SIZE of signalCount vs rawCount (i.e. the signal-to-raw ratio/'hit rate'), not the absolute numbers alone. " +
      "A keyword with a small rawCount but a high signalCount/rawCount ratio is a concentrated, high-confidence signal and deserves attention even if its raw volume is low; " +
      "a keyword with a huge rawCount but a low ratio (mostly noise) is lower priority despite a large signalCount. " +
      "When asked which keywords are worth watching, compare signalCount against rawCount (not signalCount in isolation) and call out keywords with an unusually high or rising ratio. " +
      "NOTE: rawCount/ratio is only shown above for keywords on the currently-viewed table page (fetched live from the keyword-count API) — for keywords without a ratio shown, the raw count simply hasn't been fetched yet, not that it's zero or unavailable. " +
      "The data points here contain the COMPLETE keyword ranking (all pages), not just the visible page. " +
      "Data source: keyword signal aggregates from the published data release, after the page's category/platform filter selection; raw counts come from the live keyword-count API.",
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
              <th className="pb-3 font-medium text-right">Signal</th>
              <th className="pb-3 font-medium text-right">Raw Count</th>
              <th className="pb-3 font-medium text-right">Growth</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const rawCount = rawCountMap.get(row.keyword);
              return (
                <tr key={row.keyword} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5">
                    <span
                      className="px-2 py-1 rounded-md text-xs font-semibold"
                      style={{ backgroundColor: row.color + "22", color: row.color }}
                    >
                      {row.keyword}
                    </span>
                  </td>
                  <td className="py-2.5 text-right text-gray-700 font-medium text-xs">{row.signalCount}</td>
                  <td className="py-2.5 text-right text-gray-500 text-xs">
                    {rawCount !== undefined ? (
                      rawCount.toLocaleString()
                    ) : (
                      <span className="text-gray-300">…</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    {row.growthRate !== null ? (
                      <span className="flex items-center justify-end gap-0.5 text-emerald-500 font-medium text-xs">
                        <ArrowUp size={11} /> {row.growthRate}%
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
        <span>
          Showing {start + 1}–{Math.min(start + PAGE_SIZE, rankings.length)} of {rankings.length}
        </span>
        <div className="flex items-center gap-2">
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
    </div>
  );
}
