"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";

import type { SocialMediaPayload } from "../types";
import { MultiCategoryDropdown } from "../ui/multi-category-dropdown";
import { useCopilot } from "../copilot/copilot-context";
import type { FilterAction } from "../copilot/types";
import { SelectableCard } from "../ui/selectable-card";
import { SOCIAL_PRIMARY_CATEGORIES } from "./social-media/config";
import { StatsRow }               from "./social-media/stats-row";
import { PlatformTabs }           from "./social-media/platform-tabs";
import { KeywordRankingsCard }    from "./social-media/keyword-rankings-card";
import { MentionsChartCard }      from "./social-media/mentions-chart-card";
import { SignalSamplesCard }      from "./social-media/signal-samples-card";
import { KeywordPerformanceCard } from "./social-media/keyword-performance-card";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch");
    return r.json() as Promise<SocialMediaPayload>;
  });

export function SocialMediaInsightsSubpage() {
  // selectedIds = CategoryOption.id values = primaryCategory names (e.g. "GLP-1")
  const [selectedIds, setSelectedIds]           = useState<string[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const { updatePageContext, registerFilterHandler } = useCopilot();

  // Build API query string
  const params = new URLSearchParams();
  if (selectedIds.length > 0) params.set("categories", selectedIds.join(","));
  if (selectedPlatform !== "all") params.set("platform", selectedPlatform);

  const { data, isValidating, error } = useSWR<SocialMediaPayload>(
    `/api/social-media?${params}`,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  function handleToggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
    setSelectedPlatform("all");
  }

  function handleClear() {
    setSelectedIds([]);
    setSelectedPlatform("all");
  }

  // ── Register filter handler for Copilot ──────────────────────────────────
  const applyFilter = useCallback((action: FilterAction) => {
    if (action.type === "SET_CATEGORIES") {
      setSelectedIds(action.categories);
      setSelectedPlatform("all");
    } else if (action.type === "SET_PLATFORM") {
      setSelectedPlatform(action.platform);
    } else if (action.type === "CLEAR_FILTERS") {
      setSelectedIds([]);
      setSelectedPlatform("all");
    }
  }, []);

  useEffect(() => {
    registerFilterHandler(applyFilter);
  }, [registerFilterHandler, applyFilter]);

  // ── Sync page context ────────────────────────────────────────────────────
  useEffect(() => {
    const m = data?.metrics;
    updatePageContext({
      page: "social-media-insights",
      pageTitle: "Social Media Insights",
      // Mock social posts carry no release metadata — label as mock data.
      reportingPeriod: "mock-data",
      filters: {
        categories: selectedIds,
        platform: selectedPlatform !== "all" ? selectedPlatform : undefined,
      },
      stats: m
        ? [
            { label: "Posts / Comments", value: m.totalPosts },
            { label: "Unique Accounts", value: m.uniqueAccounts },
            { label: "Active Signals", value: m.activeCount },
            { label: "Active Keywords", value: m.activeKeywords },
          ]
        : [],
    });
  }, [updatePageContext, selectedIds, selectedPlatform, data?.metrics]);

  return (
    <section>
      {/* ── Header ── */}
      <div className="mb-5 flex flex-col justify-between items-start gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Social Media Insights</h2>
          <p className="mt-1 text-sm text-slate-500">
            Platform trends, keyword signals, and mention activity across drug categories.
          </p>
        </div>
        <div className="w-full sm:w-auto min-w-[200px]">
          <MultiCategoryDropdown
            categories={SOCIAL_PRIMARY_CATEGORIES}
            selectedIds={selectedIds}
            onToggle={handleToggle}
            onClear={handleClear}
          />
        </div>
      </div>

      {/* ── Platform Tab Bar ── */}
      <div className="mb-5">
        <PlatformTabs
          tabs={data?.platformTabs ?? []}
          selected={selectedPlatform}
          onSelect={setSelectedPlatform}
        />
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="text-sm text-rose-500 text-center py-12">
          Failed to load data. Please try again.
        </div>
      )}

      {/* ── Dashboard Grid — always mounted once data arrives; overlay on revalidate ── */}
      {!error && (
        <div className="relative">
          {/* Subtle revalidation overlay — no unmount flicker */}
          {isValidating && (
            <div className="absolute inset-0 z-10 bg-white/40 rounded-2xl pointer-events-none transition-opacity" />
          )}

          {!data ? (
            <div className="text-sm text-slate-400 text-center py-12">Loading social media data…</div>
          ) : (
            <>
              {/* Row 1: Stats (5) + Keyword Rankings (7) */}
              <div className="grid grid-cols-12 gap-4 mb-4">
                <div className="col-span-12 lg:col-span-5 h-[300px]">
                  <StatsRow metrics={data.metrics} />
                </div>
                <div className="col-span-12 lg:col-span-7 h-[300px]">
                  <SelectableCard
                    className="h-full"
                    widget={{
                      widgetId: "social-keyword-rankings",
                      title: "Keyword Rankings",
                      type: "ranked-list",
                      description: "Top keywords ranked by signal count and growth rate",
                    }}
                  >
                    <KeywordRankingsCard rankings={data.keywordRankings} platform={selectedPlatform} />
                  </SelectableCard>
                </div>
              </div>

              {/* Row 2: Mentions (4) + Samples (4) + Performance (4) */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-4">
                  <SelectableCard
                    widget={{
                      widgetId: "social-mentions-by-app",
                      title: "Mentions by App",
                      type: "chart",
                      description: "External app mention counts derived from post text analysis",
                    }}
                  >
                    <MentionsChartCard mentionsByApp={data.mentionsByApp} />
                  </SelectableCard>
                </div>
                <div className="col-span-12 lg:col-span-4">
                  <SelectableCard
                    widget={{
                      widgetId: "social-signal-samples",
                      title: "Signal Samples",
                      type: "table",
                      description: "Sample posts flagged as pharmaceutical signals",
                    }}
                  >
                    <SignalSamplesCard categories={selectedIds} platform={selectedPlatform} />
                  </SelectableCard>
                </div>
                <div className="col-span-12 lg:col-span-4">
                  <SelectableCard
                    widget={{
                      widgetId: "social-keyword-performance",
                      title: "Keyword Performance",
                      type: "chart",
                      description: "Bubble chart of keyword signal volume and distribution",
                    }}
                  >
                    <KeywordPerformanceCard bubbles={data.keywordBubbles} platform={selectedPlatform} />
                  </SelectableCard>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
