"use client";

import type { MetricCardData, SocialMetrics } from "../../types";
import { MetricCard } from "../../ui/metric-card";
import { SelectableCard } from "../../ui/selectable-card";
import { useWidgetData } from "../../copilot/copilot-context";

interface StatsRowProps {
  metrics: SocialMetrics;
}

const METRIC_PROMPTS: Record<string, string> = {
  "total-posts":
    "Single metric: total number of social media posts and comments flagged as pharmaceutical signals in the current reporting period. " +
    "Data source: social media signal records in the published data release, after the page's category and platform filters.",
  "unique-accounts":
    "Single metric: number of distinct social media accounts that produced flagged signals. " +
    "Data source: deduplicated account IDs from the signal records in the published data release, after the page's category and platform filters.",
  "active-signals":
    "Single metric: number of signals currently classified as active (still live/visible on the platform). " +
    "Data source: the active flag on signal records in the published data release, after the page's category and platform filters.",
  "active-keywords":
    "Single metric: number of distinct monitored keywords that have at least one active signal. " +
    "Data source: keyword field of active signal records in the published data release, after the page's category and platform filters.",
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
        description: `Social media signal metric for the current rpt. period`,
      }}
    >
      <MetricCard item={item} />
    </SelectableCard>
  );
}

export function StatsRow({ metrics }: StatsRowProps) {
  const cards: MetricCardData[] = [
    {
      id: "total-posts",
      label: "Posts / Comments",
      value: metrics.totalPosts.toLocaleString(),
      change: null,
      direction: null,
    },
    {
      id: "unique-accounts",
      label: "Unique Accounts",
      value: metrics.uniqueAccounts.toLocaleString(),
      change: null,
      direction: null,
    },
    {
      id: "active-signals",
      label: "Active Signals",
      value: metrics.activeCount.toLocaleString(),
      change: null,
      direction: null,
    },
    {
      id: "active-keywords",
      label: "Active Keywords",
      value: metrics.activeKeywords.toLocaleString(),
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
