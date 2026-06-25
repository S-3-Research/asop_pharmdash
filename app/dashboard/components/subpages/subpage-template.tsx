import type { SubPageData } from "../types";

import { AlertsCard } from "../alerts-card";
import { HighchartsCard } from "../charts/highcharts-card";
import { RankedListCard } from "../ranked-list-card";
import { MetricCard } from "../ui/metric-card";

type SubPageTemplateProps = {
  data: SubPageData;
};

export function SubPageTemplate({ data }: SubPageTemplateProps) {
  const primaryMetrics = data.metrics.slice(0, 2);

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-800">{data.title}</h2>
        <p className="mt-1 text-sm text-slate-500">{data.summary}</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 space-y-6 lg:col-span-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {primaryMetrics.map((item) => (
              <MetricCard key={item.id} item={item} />
            ))}
          </div>

          <RankedListCard
            title="Top Ranked Items"
            subtitle="List trend overview"
            items={data.rankedItems}
          />

          <AlertsCard />
        </div>

        <div className="col-span-12 space-y-6 lg:col-span-6">
          {data.charts.map((chart) => (
            <HighchartsCard key={chart.id} chart={chart} />
          ))}
        </div>
      </div>
    </section>
  );
}
