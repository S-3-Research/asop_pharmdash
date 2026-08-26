"use client";

import type { MetricCardData, SocialMetrics } from "../../types";
import { MetricCard } from "../../ui/metric-card";
import { SelectableCard } from "../../ui/selectable-card";
import { useWidgetData } from "../../copilot/copilot-context";

interface StatsRowProps {
  metrics: SocialMetrics;
}

const METRIC_PROMPTS: Record<string, string> = {
  "total-raw-signals":
    "Single metric: total raw search-hit volume collected across all monitored keywords (sum of keyword_stats[].raw_num), regardless of whether each hit was ultimately flagged as a selling post/comment. " +
    "Data source: keyword_stats aggregates from the published data release, after the page's category/platform filter selection.",
  "unique-accounts":
    "Single metric: number of distinct social media accounts that produced flagged selling posts/comments. " +
    "Data source: deduplicated account IDs from the selling-post records in the published data release, after the page's category/platform filter selection.",
  "total-posts":
    "Single metric: total number of social media posts and comments flagged as illegal selling posts/comments in the current reporting period. " +
    "Data source: social media selling-post records in the published data release, after the page's category/platform filter selection.",
  "num-interactions":
    "Single metric: sum of comments + likes/reactions (num_comments + num_likes) across every flagged selling post/comment. " +
    "Data source: social media selling-post records in the published data release, after the page's category/platform filter selection.",
};

/** Short, customer-facing summary shown in the hover Info tooltip \u2014 kept
 *  separate from METRIC_PROMPTS (the technical text sent to Copilot) so
 *  each can be tuned for its own audience without drifting. */
const METRIC_DESCRIPTIONS: Record<string, string> = {
  "total-raw-signals":
    "Total raw search hits collected across all monitored keywords this period, before filtering for actual illicit content \u2014 the overall volume of data being scanned.",
  "unique-accounts":
    "Number of distinct social media accounts that posted flagged illegal selling content. Helps gauge how many different sellers are active, not just how many posts exist.",
  "total-posts":
    "Total number of individual posts and comments flagged as illegal drug-selling activity this reporting period \u2014 the core measure of detected illicit selling volume.",
  "num-interactions":
    "Total comments and likes/reactions on flagged selling posts/comments \u2014 a measure of how much audience engagement the detected illicit content is drawing.",
};

function SelectableStat({ item }: { item: MetricCardData }) {
  useWidgetData(
    `social-${item.id}`,
    [{ label: item.label, value: item.value }],
    METRIC_PROMPTS[item.id],
  );
  return (
    <SelectableCard
      className="h-full"
      widget={{
        widgetId: `social-${item.id}`,
        title: item.label,
        type: "metric-card",
        description: METRIC_DESCRIPTIONS[item.id],
      }}
    >
      <MetricCard item={item} />
    </SelectableCard>
  );
}

export function StatsRow({ metrics }: StatsRowProps) {
  const cards: MetricCardData[] = [
    {
      id: "total-raw-signals",
      label: "Total Data Collected",
      // `totalRawCount` may be missing from older cached API responses
      // (added after some releases' aggregate tables were precomputed) —
      // fall back to 0 instead of crashing on `.toLocaleString()`.
      value: (metrics.totalRawCount ?? 0).toLocaleString(),
      change: null,
      direction: null,
    },
    {
      id: "unique-accounts",
      label: "Unique Social Media Sellers",
      value: (metrics.uniqueAccounts ?? 0).toLocaleString(),
      change: null,
      direction: null,
    },
    {
      id: "total-posts",
      label: "Total Selling Posts/Comments",
      value: (metrics.totalPosts ?? 0).toLocaleString(),
      change: null,
      direction: null,
    },
    {
      id: "num-interactions",
      label: "Number of Interactions",
      // `numInteractions` may be missing from older cached API responses
      // (added with the 2026-08-25 schema's num_comments/num_likes fields) —
      // fall back to 0 instead of crashing on `.toLocaleString()`.
      value: (metrics.numInteractions ?? 0).toLocaleString(),
      change: null,
      direction: null,
    },
  ];


  return (
    <div className="grid grid-cols-2 gap-4 h-full">
      {cards.map((item) => (
        <SelectableStat key={item.id} item={item} />
      ))}
    </div>
  );
}
