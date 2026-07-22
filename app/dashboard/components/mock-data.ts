import type Highcharts from "highcharts";

import { ALL_PRIMARY, CATEGORY_COLORS } from "./subpages/top-products/config";
import type {
  CategoryOption,
  Domain,
  DomainGeoLocation,
  DomainPaymentInfo,
  DomainPlatform,
  DomainType,
  DomainWhois,
  Listing,
  MetricCardData,
  RankedItem,
  SocialMediaPost,
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
  // Generate listings across two reporting periods
  const rptPeriods = [
    // { reportingPeriodId: "2026-RPT-01", count: 97 },
    { reportingPeriodId: "2026-RPT-02", count: 58 },
  ];

  for (const rptPeriod of rptPeriods) {
    for (let i = 0; i < rptPeriod.count; i++) {
      const primaryCat =
        primaryCategories[Math.floor(seededRandom() * primaryCategories.length)];
      const secondaryCat =
        secondaryByPrimary[primaryCat][
          Math.floor(seededRandom() * secondaryByPrimary[primaryCat].length)
        ];

      listings.push({
        id: `listing-${id}`,
        detectedAt: new Date(2026, (parseInt(rptPeriod.reportingPeriodId.slice(-2), 10) - 1) * 3, Math.floor(seededRandom() * 28) + 1),
        source: sources[Math.floor(seededRandom() * 2)],
        primaryCategory: primaryCat,
        secondaryCategory: secondaryCat,
        reportingPeriodId: rptPeriod.reportingPeriodId,
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

// ── Domain mock data ──────────────────────────────────────────────────────────

const CITY_GEO: Record<string, DomainGeoLocation> = {
  Vancouver:   { city: "Vancouver",   state: "BC",  country: "Canada",        lat: 49.28, lng: -123.12 },
  Calgary:     { city: "Calgary",     state: "AB",  country: "Canada",        lat: 51.04, lng: -114.07 },
  Chicago:     { city: "Chicago",     state: "IL",  country: "United States", lat: 41.88, lng: -87.63  },
  "New York":  { city: "New York",    state: "NY",  country: "United States", lat: 40.71, lng: -74.01  },
  "Los Angeles": { city: "Los Angeles", state: "CA", country: "United States", lat: 34.05, lng: -118.24 },
};

const REGISTRARS = ["GoDaddy", "Namecheap", "Tucows", "Other"] as const;

const PAYMENT_COMBOS: DomainPaymentInfo[] = [
  { type: "Credit Card", provider: "Visa" },
  { type: "Credit Card", provider: "Mastercard" },
  { type: "Credit Card", provider: "Amex" },
  { type: "Crypto",      provider: "BTC" },
  { type: "Crypto",      provider: "ETH" },
  { type: "Bank Transfer", provider: "Wire" },
  { type: "Bank Transfer", provider: "ACH" },
];

const DOMAIN_TYPES: DomainType[] = [
  "rogue-pharmacy", "social-media", "counterfeit", "unregistered",
];

const SOCIAL_PROFILE_PLATFORMS = ["facebook", "instagram", "reddit", "telegram", "whatsapp"] as const;

/** Generates a trailing 6-month click history ending at the current real
 *  month, mirroring the "Mon 'YY" label format used by seo_info.history_click_us. */
function buildMockClickHistory(): { date: string; organicClicks: number; paidClicks: number }[] {
  const now = new Date();
  const points: { date: string; organicClicks: number; paidClicks: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = `${d.toLocaleString("en-US", { month: "short" })} '${String(d.getFullYear()).slice(-2)}`;
    points.push({
      date: label,
      organicClicks: Math.round(domainSeeded() * 80),
      paidClicks: Math.round(domainSeeded() * 20),
    });
  }
  return points;
}

const PLATFORMS: DomainPlatform[] = [
  "Google", "Bing", "DuckDuckGo", "Social", "Manual Insert",
];

const KEYWORDS_BY_PRIMARY: Record<string, string[]> = {
  "GLP-1":       ["buy ozempic online", "cheap semaglutide", "ozempic no rx", "wegovy discount"],
  "Cancer Med":  ["buy olaparib", "pembrolizumab online", "cheap nivolumab"],
  "CNS Med":     ["aripiprazole without prescription", "risperidone cheap"],
  "Pain Med":    ["tramadol online", "gabapentin no rx", "pregabalin cheap"],
};

const SECONDARY_BY_PRIMARY: Record<string, string[]> = {
  "GLP-1":      ["Ozempic", "Mounjaro", "Wegovy", "Rybelsus"],
  "Cancer Med": ["Olaparib", "Pembrolizumab", "Nivolumab"],
  "CNS Med":    ["Aripiprazole", "Risperidone", "Olanzapine"],
  "Pain Med":   ["Tramadol", "Gabapentin", "Pregabalin"],
};

const domainSeeded = (() => {
  let s = 137;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
})();

const pick = <T>(arr: readonly T[]): T =>
  arr[Math.floor(domainSeeded() * arr.length)];

function generateDomains(): Domain[] {
  const cities = Object.keys(CITY_GEO);
  const domains: Domain[] = [];
  const primaryCategories = Object.keys(SECONDARY_BY_PRIMARY);
  const rptPeriods = ["2026-RPT-01", "2026-RPT-02"] as const;

  // distribute: 12 in RPT-01, 15 in RPT-02
  const rptPeriodCounts: Record<string, number> = { "2026-RPT-02": 15 };

  let idx = 1;
  for (const rptPeriodId of rptPeriods) {
    for (let i = 0; i < rptPeriodCounts[rptPeriodId]; i++) {
      const primaryCategory = pick(primaryCategories);
      const secondaryCategory = pick(SECONDARY_BY_PRIMARY[primaryCategory]);
      const registrar = pick(REGISTRARS);
      const city = pick(cities);
      const rptPeriodNum = parseInt(rptPeriodId.slice(-2), 10);
      // createDate within the rpt. period window (3-month window starting at month (rptPeriodNum-1)*3)
      const monthOffset = (rptPeriodNum - 1) * 3 + Math.floor(domainSeeded() * 3);
      const day = 1 + Math.floor(domainSeeded() * 27);
      const createDate = `2026-${String(monthOffset + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const createTimestamp = Math.floor(new Date(`${createDate}T00:00:00Z`).getTime() / 1000);
      const numPlatforms = 1 + Math.floor(domainSeeded() * 3);
      const platformSet = new Set<DomainPlatform>();
      while (platformSet.size < numPlatforms) platformSet.add(pick(PLATFORMS));
      const kws = KEYWORDS_BY_PRIMARY[primaryCategory];
      const numKw = 1 + Math.floor(domainSeeded() * kws.length);
      const keyword = Array.from({ length: numKw }, () =>
        domainSeeded() > 0.1 ? pick(kws) : null,
      );

      domains.push({
        domain: `${secondaryCategory.toLowerCase().replace(/\s+/g, "-")}-${idx}.example`,
        platforms: [...platformSet],
        resource: domainSeeded() > 0.5 ? `social_account_${idx}` : `search_result_${idx}`,
        createDate,
        isLive: domainSeeded() > 0.2,
        createTimestamp,
        whois: {
          registrar,
          createdDate: `${2024 + Math.floor(domainSeeded() * 2)}-${String(1 + Math.floor(domainSeeded() * 12)).padStart(2, "0")}-01`,
          expiryDate:  `${2027 + Math.floor(domainSeeded() * 2)}-${String(1 + Math.floor(domainSeeded() * 12)).padStart(2, "0")}-01`,
          registrant:  domainSeeded() > 0.4 ? `Registrant ${idx}` : undefined,
        } as DomainWhois,
        sem: {
          keywords: keyword.filter(Boolean) as string[],
          adSpend:  domainSeeded() > 0.5 ? Math.round(domainSeeded() * 5000) : undefined,
          impressions: domainSeeded() > 0.5 ? Math.round(domainSeeded() * 50000) : undefined,
        },
        seoClickHistory: buildMockClickHistory(),
        primaryCategory,
        secondaryCategory,
        categories: [{ primary: primaryCategory, secondary: secondaryCategory }],
        domainType: pick(DOMAIN_TYPES),
        paymentInfo: [pick(PAYMENT_COMBOS)],
        socialProfiles: domainSeeded() > 0.6
          ? [{ platform: pick(SOCIAL_PROFILE_PLATFORMS), url: `https://example.com/${idx}` }]
          : [],
        geoLocation: CITY_GEO[city],
        associatedBusinessName: domainSeeded() > 0.5 ? `Pharma Co. ${idx}` : null,
        keyword,
        products: { primaryCategory, secondaryCategory },
        reportingPeriodId: rptPeriodId,
      });
      idx++;
    }
  }
  return domains;
}

export const mockDomains: Domain[] = generateDomains();

// ── Social Media mock data ────────────────────────────────────────────────────

const socialSeeded = (() => {
  let s = 7373;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
})();

const socialRngPick = <T>(arr: readonly T[]): T =>
  arr[Math.floor(socialSeeded() * arr.length)];

const socialRngPickN = <T>(arr: readonly T[], n: number): T[] => {
  const copy = [...arr];
  const result: T[] = [];
  const count = Math.min(n, copy.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(socialSeeded() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
};

const SOCIAL_PLATFORMS_POOL = [
  "Reddit", "X", "YouTube", "Instagram", "TikTok",
  "Telegram", "Discord", "Quora",
] as const;

const EXTERNAL_APPS = [
  "WhatsApp", "Venmo", "Snapchat", "Signal", "Cash App",
  "Zelle", "PayPal", "Wickr", "Telegram", "Kik",
] as const;

const SOCIAL_KW_BY_PRIMARY: Record<string, string[]> = {
  "GLP-1":      ["ozempic", "semaglutide", "wegovy", "mounjaro", "tirzepatide", "glp-1"],
  "Cancer Med": ["olaparib", "pembrolizumab", "nivolumab", "keytruda", "immunotherapy"],
  "CNS Med":    ["aripiprazole", "adderall", "vyvanse", "xanax", "benzodiazepine", "risperidone"],
  "Pain Med":   ["tramadol", "gabapentin", "pregabalin", "fentanyl", "opioids"],
};

const SECONDARY_SOCIAL_BY_PRIMARY: Record<string, string[]> = {
  "GLP-1":      ["Ozempic", "Mounjaro", "Wegovy", "Rybelsus"],
  "Cancer Med": ["Olaparib", "Pembrolizumab", "Nivolumab"],
  "CNS Med":    ["Aripiprazole", "Risperidone", "Adderall", "Vyvanse"],
  "Pain Med":   ["Tramadol", "Gabapentin", "Pregabalin"],
};

const SOCIAL_TEXTS: Record<string, string[]> = {
  "GLP-1": [
    "Lost 25lbs with {kw}! My supplier accepts {app1} and {app2}. DM for info 💉",
    "Anyone selling {kw} without Rx? Pay via {app1}, message on {app2} 👇",
    "Quality {kw} pens available $150 each. {app1} accepted, contact via {app2}",
    "{kw} in stock! Fast shipping worldwide. {app1} or {app2} payments only",
    "Selling {kw} 2mg pens. DM. {app1} or {app2} accepted. Discreet packaging",
    "My {kw} journey week 12 update — sourced via {app1}. Contact {app2} for supplier",
  ],
  "Cancer Med": [
    "{kw} at 60% off retail price. {app1} payments. Contact on {app2}",
    "Generic {kw} shipped internationally. {app1} or {app2} for orders",
    "Need {kw} urgently — anyone have a source? Will pay via {app1} or {app2}",
    "Bulk {kw} available. {app1} only. Message me on {app2}",
    "{kw} without prescription available. {app1} payment method. {app2} for details",
  ],
  "CNS Med": [
    "{kw} 60mg available. HMU on {app2}. {app1} or {app2} accepted 💊",
    "Need {kw} for exams, anyone? Pay via {app1}. Contact on {app2}",
    "Selling {kw} bars — {app1} or {app2} only. Discreet shipping",
    "{kw} script for sale. {app1} payments only. Details on {app2}",
    "Got {kw} 30mg left. DM via {app2}. {app1} or {app2} accepted",
  ],
  "Pain Med": [
    "{kw} no Rx needed. Ships anywhere. {app1} payment. Contact: {app2}",
    "Chronic pain? {kw} available discreetly. {app1} or {app2} for payment",
    "Quality {kw} 300mg in stock. {app1} payments. Message on {app2}",
    "{kw} available — {app1} only. Hit me up on {app2} for details",
    "Selling {kw} 50mg tabs. {app1} or {app2} accepted. Worldwide shipping",
  ],
};

const SOCIAL_USERNAMES: Record<string, string[]> = {
  Reddit:    ["u/pharmbro_99", "u/health_seeker", "u/rx_deals_daily", "u/medinfo_hub", "u/ozempic_fan", "u/swmfox", "u/brisbanegreen"],
  X:         ["@pharmwatch", "@healthhacks_", "@rx_street", "@medsupply_ok", "@discountmeds24"],
  YouTube:   ["PharmaReview", "MedDealsDaily", "HealthSourcerTV", "RxGuideChannel"],
  Instagram: ["@medshop.online", "@pharma_direct", "@discount_meds_official"],
  TikTok:    ["@medtok_official", "@pharmalife", "@rx_street_tok"],
  Telegram:  ["t.me/rxsupply", "t.me/pharmdeal", "t.me/medshop_global"],
  Discord:   ["pharmacist#1234", "medsource#5678", "rxdealer#9012", "healthhub#3456"],
  Quora:     ["John_Pharma", "MedWatcher_Q", "HealthSeeker99", "PharmaExpert"],
};

function buildSocialText(
  primaryCategory: string,
  keyword: string,
): { text: string; mentions: string[] } {
  const templates = SOCIAL_TEXTS[primaryCategory] ?? SOCIAL_TEXTS["Pain Med"];
  const template = socialRngPick(templates);
  const app1 = socialRngPick(EXTERNAL_APPS);
  let app2 = socialRngPick(EXTERNAL_APPS);
  while (app2 === app1) app2 = socialRngPick(EXTERNAL_APPS);
  const text = template
    .replace("{kw}", keyword)
    .replace("{app1}", app1)
    .replace("{app2}", app2);
  const mentions = [...new Set([app1, app2].filter((a) => text.includes(a)))];
  return { text, mentions };
}

function generateSocialPosts(): SocialMediaPost[] {
  const posts: SocialMediaPost[] = [];
  const primaryCategories = Object.keys(SOCIAL_KW_BY_PRIMARY);

  for (let i = 0; i < 120; i++) {
    const primaryCategory = socialRngPick(primaryCategories);
    const secondaryCategory = socialRngPick(SECONDARY_SOCIAL_BY_PRIMARY[primaryCategory]);

    // 30% chance of a second category association (cross-category posts)
    const categories: Array<{ primaryCategory: string; secondaryCategory: string }> = [
      { primaryCategory, secondaryCategory },
    ];
    if (socialSeeded() < 0.3) {
      const p2 = socialRngPick(primaryCategories);
      const s2 = socialRngPick(SECONDARY_SOCIAL_BY_PRIMARY[p2]);
      if (p2 !== primaryCategory || s2 !== secondaryCategory) {
        categories.push({ primaryCategory: p2, secondaryCategory: s2 });
      }
    }

    const platform = socialRngPick(SOCIAL_PLATFORMS_POOL) as string;
    const keyword = socialRngPick(SOCIAL_KW_BY_PRIMARY[primaryCategory]);
    const { text, mentions } = buildSocialText(primaryCategory, keyword);
    const usernames = SOCIAL_USERNAMES[platform] ?? ["user_unknown"];
    const username = socialRngPick(usernames);

    // Random timestamp within last 180 days from 2026-06-30
    const daysAgo = Math.floor(socialSeeded() * 180);
    const ts = new Date(2026, 5, 30);
    ts.setDate(ts.getDate() - daysAgo);

    const status: "active" | "inactive" = socialSeeded() > 0.28 ? "active" : "inactive";
    const kwPool = SOCIAL_KW_BY_PRIMARY[primaryCategory];
    const numKw = 1 + Math.floor(socialSeeded() * 3);
    const keywords = socialRngPickN(kwPool, numKw);

    posts.push({
      id: `social-${i + 1}`,
      link: `https://${platform.toLowerCase().replace(/[^a-z0-9]/g, "")}.com/post/${1000 + i}`,
      platform,
      text,
      mentions,
      username,
      userlink: `https://${platform.toLowerCase().replace(/[^a-z0-9]/g, "")}.com/${username.replace(/[@#/u]/g, "")}`,
      timestamp: ts.toISOString(),
      status,
      keywords,
      categories,
    });
  }
  return posts;
}

export const mockSocialPosts: SocialMediaPost[] = generateSocialPosts();

// ── Keyword raw-count mock (reporting period, per platform) ──────────────────
// Simulates search-result counts for each keyword on each platform during
// the current reporting period (2026-RPT-02).
// Intentionally larger than signalCount — represents broader search universe.
const kwRawCountSeeded = (() => {
  let s = 5571;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
})();

const ALL_TRACKED_KEYWORDS_LIST = [
  "ozempic", "semaglutide", "wegovy", "mounjaro", "tirzepatide", "glp-1",
  "olaparib", "pembrolizumab", "nivolumab", "keytruda", "immunotherapy",
  "aripiprazole", "adderall", "vyvanse", "xanax", "benzodiazepine", "risperidone",
  "tramadol", "gabapentin", "pregabalin", "fentanyl", "opioids",
] as const;

const TRACKED_PLATFORMS_LIST = [
  "Reddit", "X", "YouTube", "Instagram", "TikTok", "Telegram", "Discord", "Quora",
] as const;

function generateKwRawCounts(): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const kw of ALL_TRACKED_KEYWORDS_LIST) {
    result[kw] = {};
    let allTotal = 0;
    for (const platform of TRACKED_PLATFORMS_LIST) {
      const count = Math.round(kwRawCountSeeded() * 1800 + 200); // 200–2000
      result[kw][platform] = count;
      allTotal += count;
    }
    result[kw]["all"] = allTotal;
  }
  return result;
}

/** Pre-computed reporting-period search-result counts: keyword → platform → count */
export const mockKwRawCounts: Record<string, Record<string, number>> = generateKwRawCounts();

