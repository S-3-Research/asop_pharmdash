"use client";

import { useState, useMemo } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import type { PieChartNodeData } from "../types";

interface DrillablePieChartProps {
  data: PieChartNodeData[];
  title?: string;
  subtitle?: string;
  /** When provided, automatically drills into the category with this id on mount */
  initiallyDrilledId?: string;
}

export function DrillablePieChart({
  data,
  title,
  subtitle,
  initiallyDrilledId,
}: DrillablePieChartProps) {
  // Lazy initial state: if a category is pre-selected, start already drilled in
  const [drillLevel, setDrillLevel] = useState<number>(() =>
    initiallyDrilledId && data.find((d) => d.id === initiallyDrilledId) ? 1 : 0
  );
  const [selectedCategory, setSelectedCategory] = useState<PieChartNodeData | null>(() =>
    initiallyDrilledId ? (data.find((d) => d.id === initiallyDrilledId) ?? null) : null
  );

  const chartOptions = useMemo(() => {
    const isFirstLevel = drillLevel === 0;
    const currentData = isFirstLevel ? data : selectedCategory?.children || [];
    const chartData = currentData.map((item) => ({
      name: item.name,
      y: item.percentage,
      color: item.color,
      id: item.id,
      drilldown: !isFirstLevel ? undefined : item.id,
    }));

    return {
      chart: {
        type: "pie",
        height: 250,
        backgroundColor: "transparent",
        style: { fontFamily: "var(--font-geist-sans)" },
      },
      title: { text: undefined },
      subtitle: { text: undefined },
      credits: { enabled: false },
      accessibility: { enabled: false },
      legend: {
        align: "right" as const,
        verticalAlign: "middle" as const,
        layout: "vertical" as const,
        itemStyle: { fontSize: "11px", fontWeight: "500" },
      },
      tooltip: {
        pointFormat: "<b>{point.y}%</b>",
      },
      plotOptions: {
        pie: {
          innerSize: "58%",
          borderWidth: 2,
          dataLabels: {
            enabled: true,
            format: "{point.y}%",
            style: { fontSize: "11px", fontWeight: "500" },
          },
          point: {
            events: {
              click: function () {
                if (isFirstLevel && (this as any).drilldown) {
                  const item = data.find((d) => d.id === (this as any).id);
                  if (item) {
                    setSelectedCategory(item);
                    setDrillLevel(1);
                  }
                }
              },
            },
          },
        },
      },
      series: [{ name: "Listings", data: chartData }],
    } as Highcharts.Options;
  }, [data, selectedCategory, drillLevel]);

  return (
    <div>
      {drillLevel > 0 && selectedCategory && (
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => {
              setDrillLevel(0);
              setSelectedCategory(null);
            }}
            className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded text-slate-700 transition-colors"
          >
            ← Back
          </button>
          <span className="text-sm text-slate-600">
            {selectedCategory.name} Details
          </span>
        </div>
      )}
      <div className="space-y-2 mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && (
          <p className="text-xs text-slate-500">{subtitle}</p>
        )}
        {drillLevel > 0 && (
          <p className="text-xs text-slate-600">
            Showing secondary category breakdown for{" "}
            <span className="font-medium">{selectedCategory?.name}</span>
          </p>
        )}
      </div>
      <HighchartsReact highcharts={Highcharts} options={chartOptions} />
    </div>
  );
}
