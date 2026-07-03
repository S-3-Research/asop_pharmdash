"use client";

import type { MetricCardData, SocialMetrics } from "../../types";
import { MetricCard } from "../../ui/metric-card";
import { SelectableCard } from "../../ui/selectable-card";

interface StatsRowProps {
  metrics: SocialMetrics;
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
        <SelectableCard
          key={item.id}
          className="h-full"
          widget={{
            widgetId: `social-${item.id}`,
            title: item.label,
            type: "metric-card",
            description: `Social media signal metric for the current CBU window`,
            dataPoints: [{ label: item.label, value: item.value }],
          }}
        >
          <MetricCard item={item} />
        </SelectableCard>
      ))}
    </div>
  );
}
