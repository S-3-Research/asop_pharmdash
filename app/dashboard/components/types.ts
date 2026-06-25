import type Highcharts from "highcharts";

export type SubPageKey =
  | "top-products"
  | "domain-insights"
  | "social-media-insights";

export type TrendDirection = "up" | "down" | "flat";

export type ListingSource = "online" | "social";

export interface Listing {
  id: string;
  detectedAt: Date;
  source: ListingSource;
  primaryCategory: string; // e.g., "GLP-1", "Cancer Med", "CNS Med", "Pain Med"
  secondaryCategory: string; // e.g., "Ozempic", "Olaparib"
  quarter: string; // e.g., "Q2-2024"
  month: string; // e.g., "June-2024"
}

export interface ListingAggregation {
  totalListings: number;
  bySource: Record<ListingSource, number>;
  byPrimaryCategory: Record<string, number>;
  bySecondaryCategory: Record<string, number>;
  byPrimaryCategoryAndSource: Record<string, Record<ListingSource, number>>;
}

export interface PieChartNodeData {
  id: string;
  name: string;
  value: number;
  percentage: number;
  color?: string;
  isLeaf?: boolean;
  children?: PieChartNodeData[];
}

export interface SubPageNavItem {
  key: SubPageKey;
  label: string;
  description: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  isTop?: boolean;
  color?: string;
}

export interface MetricCardData {
  id: string;
  label: string;
  value: string;
  /** null = no prior period available */
  change: string | null;
  direction: TrendDirection | null;
  /** Replaces the 'vs prior quarter' footer label when set */
  changeLabel?: string;
}

export interface ChartCardData {
  id: string;
  title: string;
  subtitle?: string;
  options: Highcharts.Options;
}

export interface RankedItem {
  id: string;
  name: string;
  value: string;
  /** null = no prior period available */
  change: string | null;
  direction: TrendDirection | null;
}

/** Listing shape returned by the API (detectedAt omitted — not needed by UI) */
export type ApiListing = Omit<Listing, "detectedAt">;

export interface SubPageData {
  key: SubPageKey;
  title: string;
  summary: string;
  metrics: MetricCardData[];
  charts: ChartCardData[];
  rankedItems: RankedItem[];
  categories?: CategoryOption[];
  drillablePieData?: PieChartNodeData[];
  listings?: Listing[];
}
