import type Highcharts from "highcharts";

import { ALL_PRIMARY, CATEGORY_COLORS } from "./subpages/top-products/config";
import type {
  CategoryOption,
  Listing,
  MetricCardData,
  RankedItem,
  SubPageData,
  SubPageKey,
  SubPageNavItem,
} from "./types";


const sharedChartStyle = {
  fontFamily: "var(--font-geist-sans)",
};

// Seeded random number generator for consistent mock data
const seededRandom = (() => {
  let seed = 42;
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
})();
const buildLineOptions = (
  categories: string[],
  series: Highcharts.SeriesLineOptions[],
): Highcharts.Options => ({
  chart: {
    type: "line",
    height: 300,
    backgroundColor: "transparent",
    style: sharedChartStyle,
  },
  title: { text: undefined },
  xAxis: {
    categories,
    tickLength: 0,
    lineColor: "#e2e8f0",
    labels: {
      rotation: -45,
      style: { color: "#6b7280", fontSize: "11px" },
    },
  },
  yAxis: {
    title: { text: undefined },
    gridLineColor: "#e5e7eb",
    gridLineDashStyle: "Dash",
    labels: {
      style: { color: "#6b7280", fontSize: "11px" },
    },
  },
  legend: {
    align: "center",
    verticalAlign: "bottom",
    itemStyle: { fontSize: "11px", fontWeight: "500" },
  },
  credits: { enabled: false },
  accessibility: { enabled: false },
  plotOptions: {
    line: {
      marker: { enabled: true, radius: 3 },
      lineWidth: 2.2,
    },
  },
  tooltip: {
    shared: true,
  },
  series,
});

const buildColumnOptions = (
  categories: string[],
  series: Highcharts.SeriesColumnOptions[],
): Highcharts.Options => ({
  chart: {
    type: "column",
    height: 300,
    backgroundColor: "transparent",
    style: sharedChartStyle,
  },
  title: { text: undefined },
  xAxis: {
    categories,
    lineColor: "#e2e8f0",
    labels: {
      style: { color: "#6b7280", fontSize: "11px" },
    },
  },
  yAxis: {
    title: { text: undefined },
    gridLineColor: "#e2e8f0",
    labels: {
      style: { color: "#6b7280", fontSize: "11px" },
    },
  },
  credits: { enabled: false },
  accessibility: { enabled: false },
  legend: { enabled: true },
  plotOptions: {
    column: {
      borderRadius: 4,
      borderWidth: 0,
    },
  },
  tooltip: { shared: true },
  series,
});

const buildDonutOptions = (
  series: Highcharts.SeriesPieOptions,
): Highcharts.Options => ({
  chart: {
    type: "pie",
    height: 300,
    backgroundColor: "transparent",
    style: sharedChartStyle,
  },
  title: { text: undefined },
  credits: { enabled: false },
  accessibility: { enabled: false },
  legend: {
    align: "right",
    verticalAlign: "middle",
    layout: "vertical",
    itemStyle: { fontSize: "11px", fontWeight: "500" },
  },
  tooltip: {
    pointFormat: "<b>{point.y}</b> ({point.percentage:.1f}%)",
  },
  plotOptions: {
    pie: {
      innerSize: "58%",
      borderWidth: 2,
      dataLabels: {
        enabled: false,
      },
    },
  },
  series: [series],
});

export const sidebarItems: SubPageNavItem[] = [
  {
    key: "top-products",
    label: "Top Products",
    description: "Trending products and categories",
  },
  {
    key: "domain-insights",
    label: "Domain Insights",
    description: "Website traffic and domain trend",
  },
  {
    key: "social-media-insights",
    label: "Social Media Insights",
    description: "Platform-wise mention statistics",
  },
];

// Raw listing data - finest granularity
const generateListings = (): Listing[] => {
  const listings: Listing[] = [];
  const primaryCategories = ["GLP-1", "Cancer Med", "CNS Med", "Pain Med"];
  const secondaryByPrimary: Record<string, string[]> = {
    "GLP-1": ["Ozempic", "Mounjaro", "Wegovy", "Rybelsus"],
    "Cancer Med": ["Olaparib", "Pembrolizumab", "Nivolumab"],
    "CNS Med": ["Aripiprazole", "Risperidone", "Olanzapine"],
    "Pain Med": ["Tramadol", "Gabapentin", "Pregabalin"],
  };
  const sources: ("online" | "social")[] = ["online", "social"];

  let id = 1;
  // Generate listings for Q2 2024 (April, May, June)
  const months = [
    { name: "April-2024", count: 45 },
    { name: "May-2024", count: 52 },
    { name: "June-2024", count: 58 },
  ];

  for (const month of months) {
    // Derive year, month index, quarter, and days-in-month from the month key itself
    const dashIdx = month.name.lastIndexOf("-");
    const monthName = month.name.slice(0, dashIdx);
    const year = parseInt(month.name.slice(dashIdx + 1), 10);
    const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth(); // 0-based
    const quarterNum = Math.floor(monthIndex / 3) + 1;
    const quarter = `Q${quarterNum}-${year}`;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    for (let i = 0; i < month.count; i++) {
      const primaryCat =
        primaryCategories[Math.floor(seededRandom() * primaryCategories.length)];
      const secondaryCat =
        secondaryByPrimary[primaryCat][
          Math.floor(seededRandom() * secondaryByPrimary[primaryCat].length)
        ];

      listings.push({
        id: `listing-${id}`,
        detectedAt: new Date(year, monthIndex, Math.floor(seededRandom() * daysInMonth) + 1),
        source: sources[Math.floor(seededRandom() * 2)],
        primaryCategory: primaryCat,
        secondaryCategory: secondaryCat,
        quarter,
        month: month.name,
      });
      id++;
    }
  }

  return listings;
};

const topProductsListings = generateListings();

// Generate drillable pie chart data structure
const getDrillablePieData = () => {
  const total = topProductsListings.length;
  const secondaryByPrimary: Record<string, string[]> = {
    "GLP-1": ["Ozempic", "Mounjaro", "Wegovy", "Rybelsus"],
    "Cancer Med": ["Olaparib", "Pembrolizumab", "Nivolumab"],
    "CNS Med": ["Aripiprazole", "Risperidone", "Olanzapine"],
    "Pain Med": ["Tramadol", "Gabapentin", "Pregabalin"],
  };

  return [...ALL_PRIMARY].map((primaryCat) => {
    const primaryCount = topProductsListings.filter(
      (l) => l.primaryCategory === primaryCat
    ).length;
    const primaryPercentage = Math.round((primaryCount / total) * 100);

    const children = secondaryByPrimary[primaryCat].map((secondaryCat) => {
      const secondaryCount = topProductsListings.filter(
        (l) =>
          l.primaryCategory === primaryCat &&
          l.secondaryCategory === secondaryCat
      ).length;
      const secondaryPercentage =
        secondaryCount > 0
          ? Math.round((secondaryCount / primaryCount) * 100)
          : 0;

      return {
        id: `${primaryCat}-${secondaryCat}`,
        name: secondaryCat,
        value: secondaryCount,
        percentage: secondaryPercentage,
        color: CATEGORY_COLORS[primaryCat],
      };
    });

    return {
      id: primaryCat.replace(/\s+/g, "-"),
      name: primaryCat,
      value: primaryCount,
      percentage: primaryPercentage,
      color: CATEGORY_COLORS[primaryCat],
      children,
    };
  });
};

const drillablePieData = getDrillablePieData();

const topProductsCategories: CategoryOption[] = [
  { id: "all", name: "All Categories" },
  { id: "cns-med", name: "CNS Med", isTop: true, color: "#a855f7" },
  { id: "glp-1", name: "GLP-1", color: "#3b82f6" },
  { id: "cancer-med", name: "Cancer Med", color: "#10b981" },
  { id: "pain-med", name: "Pain Med", color: "#f59e0b" },
];

const domainInsightsMetrics: MetricCardData[] = [
  {
    id: "new-domains",
    label: "New Domains",
    value: "132",
    change: "+12.4%",
    direction: "up",
  },
  {
    id: "flagged-domains",
    label: "Flagged Domains",
    value: "27",
    change: "-3.1%",
    direction: "down",
  },
  {
    id: "avg-daily-visits",
    label: "Avg Daily Visits",
    value: "24,100",
    change: "+6.8%",
    direction: "up",
  },
  {
    id: "bounce-rate",
    label: "Bounce Rate",
    value: "31%",
    change: "-0.9%",
    direction: "down",
  },
];

const domainInsightsRankedItems: RankedItem[] = [
  {
    id: "pharmasale-01",
    name: "pharmasale-01.example",
    value: "8,420 visits",
    change: "+11.2%",
    direction: "up",
  },
  {
    id: "rx-market",
    name: "rx-market.example",
    value: "7,108 visits",
    change: "+3.5%",
    direction: "up",
  },
  {
    id: "cheap-meds",
    name: "cheap-meds.example",
    value: "5,321 visits",
    change: "-4.9%",
    direction: "down",
  },
  {
    id: "prime-rx",
    name: "prime-rx.example",
    value: "4,982 visits",
    change: "-0.8%",
    direction: "down",
  },
];

const socialMetrics: MetricCardData[] = [
  {
    id: "total-mentions",
    label: "Total Mentions",
    value: "32,400",
    change: "+14.2%",
    direction: "up",
  },
  {
    id: "engagement-rate",
    label: "Engagement Rate",
    value: "7.2%",
    change: "+0.9%",
    direction: "up",
  },
  {
    id: "negative-sentiment",
    label: "Negative Sentiment",
    value: "11%",
    change: "-1.4%",
    direction: "down",
  },
  {
    id: "new-creators",
    label: "New Creators",
    value: "126",
    change: "+5.6%",
    direction: "up",
  },
];

const socialRankedItems: RankedItem[] = [
  {
    id: "reddit",
    name: "Reddit",
    value: "9,800 mentions",
    change: "+18.0%",
    direction: "up",
  },
  {
    id: "x",
    name: "X (Twitter)",
    value: "8,100 mentions",
    change: "+4.1%",
    direction: "up",
  },
  {
    id: "youtube",
    name: "YouTube",
    value: "6,000 mentions",
    change: "-2.2%",
    direction: "down",
  },
  {
    id: "tiktok",
    name: "TikTok",
    value: "5,300 mentions",
    change: "+9.7%",
    direction: "up",
  },
];

export const subPageDataMap: Record<SubPageKey, SubPageData> = {
  "top-products": {
    key: "top-products",
    title: "Top Products",
    summary: "Track category volume, product trend and top-ranked products.",
    // metrics, rankedItems, charts are derived client-side from listings via useMemo
    metrics: [],
    charts: [],
    rankedItems: [],
    categories: topProductsCategories,
    drillablePieData,
    listings: topProductsListings,
  },
  "domain-insights": {
    key: "domain-insights",
    title: "Domain Insights",
    summary: "Monitor domain activity and suspicious growth patterns.",
    metrics: domainInsightsMetrics,
    charts: [
      {
        id: "domain-traffic-trend",
        title: "Domain Traffic Trend",
        subtitle: "Weekly visits and unique users",
        options: buildLineOptions(
          ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"],
          [
            {
              type: "line",
              name: "Visits",
              data: [12000, 13100, 12800, 14200, 15700, 16300, 17100, 18200],
              color: "#0ea5e9",
            },
            {
              type: "line",
              name: "Unique Users",
              data: [6000, 6800, 6400, 7200, 8100, 8600, 9200, 9800],
              color: "#2563eb",
            },
          ],
        ),
      },
      {
        id: "domain-source-share",
        title: "Source Share",
        subtitle: "Traffic source composition",
        options: buildColumnOptions(
          ["Direct", "Organic", "Referral", "Social", "Paid"],
          [
            {
              type: "column",
              name: "This Month",
              data: [3200, 4900, 1600, 2300, 900],
              color: "#0891b2",
            },
            {
              type: "column",
              name: "Last Month",
              data: [3000, 4500, 1400, 2000, 1100],
              color: "#94a3b8",
            },
          ],
        ),
      },
    ],
    rankedItems: domainInsightsRankedItems,
  },
  "social-media-insights": {
    key: "social-media-insights",
    title: "Social Media Insights",
    summary: "Observe platform trends and sentiment movement.",
    metrics: socialMetrics,
    charts: [
      {
        id: "mentions-by-platform",
        title: "Mentions by Platform",
        subtitle: "Weekly mention volume",
        options: buildColumnOptions(
          ["Week 1", "Week 2", "Week 3", "Week 4"],
          [
            { type: "column", name: "Reddit", data: [2100, 2300, 2500, 2900], color: "#f97316" },
            { type: "column", name: "X", data: [1800, 1950, 2000, 2350], color: "#0ea5e9" },
            { type: "column", name: "YouTube", data: [1400, 1500, 1420, 1680], color: "#ef4444" },
          ],
        ),
      },
      {
        id: "sentiment-split",
        title: "Sentiment Split",
        subtitle: "Positive / Neutral / Negative",
        options: buildDonutOptions({
          type: "pie",
          name: "Sentiment",
          data: [
            { name: "Positive", y: 58, color: "#22c55e" },
            { name: "Neutral", y: 31, color: "#64748b" },
            { name: "Negative", y: 11, color: "#ef4444" },
          ],
        }),
      },
    ],
    rankedItems: socialRankedItems,
  },
};
