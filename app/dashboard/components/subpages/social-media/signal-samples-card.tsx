"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { CheckCircle2, MoreHorizontal } from "lucide-react";

import type { SocialSamplesPayload } from "../../types";
import { useWidgetData } from "../../copilot/copilot-context";
import { PLATFORM_COLORS } from "./config";

const PAGE_SIZE = 8;

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch samples");
    return r.json() as Promise<SocialSamplesPayload>;
  });

interface SignalSamplesCardProps {
  /** Array of primaryCategory names already resolved (e.g. ["GLP-1"]) */
  categories: string[];
  platform: string;
}

export function SignalSamplesCard({ categories, platform }: SignalSamplesCardProps) {
  const [loadedPages, setLoadedPages] = useState(1);

  // Reset pagination whenever filters change
  useEffect(() => {
    setLoadedPages(1);
  }, [categories.join(","), platform]);

  const params = new URLSearchParams({
    page: "1",
    pageSize: String(PAGE_SIZE * loadedPages),
  });
  if (categories.length > 0) params.set("categories", categories.join(","));
  if (platform !== "all") params.set("platform", platform);

  const { data, isLoading } = useSWR<SocialSamplesPayload>(
    `/api/social-media/samples?${params}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const samples = data?.samples ?? [];
  const total   = data?.total ?? 0;
  const hasMore = samples.length < total;

  useWidgetData(
    "social-signal-samples",
    [
      { label: "Total Matching Samples", value: total },
      { label: "Loaded on Screen", value: samples.length },
      ...samples.map((s, i) => ({
        label: `Sample ${i + 1} [${s.platform}]`,
        value: s.text,
      })),
    ],
    "Feed of sample social media posts/comments flagged as pharmaceutical signals, with platform badges; paginated via a 'load more' button. " +
      "Data points include the total matching count and the full text of every currently loaded sample. " +
      "Data source: live samples API backed by the published data release, filtered by the page's category and platform selection.",
  );

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col h-[380px]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800 text-sm">
          Signal Samples
          {total > 0 && (
            <span className="ml-2 text-[11px] text-gray-400 font-normal">{total} total</span>
          )}
        </h3>
        <MoreHorizontal size={16} className="text-gray-400 cursor-pointer" />
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
        {isLoading && samples.length === 0 && (
          <div className="text-xs text-gray-400 text-center py-8">Loading…</div>
        )}

        {samples.map((post) => {
          const color = PLATFORM_COLORS[post.platform] ?? PLATFORM_COLORS.default;
          const ts    = new Date(post.timestamp);
          return (
            <div
              key={post.id}
              className="border border-gray-100 rounded-xl p-3.5 bg-gray-50/50 flex-shrink-0"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {post.platform.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-800 leading-tight">{post.username}</p>
                    <p className="text-[10px] text-gray-400">
                      {post.platform} · {ts.toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span
                  className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    post.status === "active"
                      ? "text-emerald-600 bg-emerald-50"
                      : "text-slate-400 bg-slate-100"
                  }`}
                >
                  {post.status === "active" && <CheckCircle2 size={9} />}
                  {post.status}
                </span>
              </div>

              <p className="text-xs text-gray-700 leading-relaxed mb-2 line-clamp-2">{post.text}</p>

              {post.categories.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {post.categories.map((cat) => (
                    <span
                      key={`${cat.primaryCategory}-${cat.secondaryCategory}`}
                      className="bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded text-[10px] font-medium"
                    >
                      {cat.secondaryCategory}
                    </span>
                  ))}
                </div>
              )}

              {post.keywords && post.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {post.keywords.map((kw) => (
                    <span
                      key={kw}
                      className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-medium"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {hasMore && (
          <button
            onClick={() => setLoadedPages((p) => p + 1)}
            disabled={isLoading}
            className="text-xs text-blue-500 font-medium py-2 text-center hover:underline flex-shrink-0 disabled:opacity-50"
          >
            {isLoading ? "Loading…" : `Load more (${total - samples.length} remaining)`}
          </button>
        )}

        {!isLoading && samples.length === 0 && (
          <div className="text-xs text-gray-400 text-center py-8">No samples found.</div>
        )}
      </div>
    </div>
  );
}
